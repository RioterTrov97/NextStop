// Rebuilds the bundled rail data from the TfNSW GTFS timetables:
// - src/data/stations.json: every train and metro station, so station search can answer before the stop finder does.
// - src/data/network.json: every stopping pattern with its running times and how often it runs at each time of day,
//   so trip search can work out where changing trains could pay off without spending API calls (see src/lib/network.ts).
// Usage: node scripts/generate-stations.ts   (reads TFNSW_API_KEY from the environment or .dev.vars; needs `unzip` on PATH)
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { BANDS } from '../src/lib/bands.ts'

const FEEDS = [
  { mode: 1, path: '/v1/gtfs/schedule/sydneytrains' },
  { mode: 2, path: '/v2/gtfs/schedule/metro' },
]

const key =
  process.env.TFNSW_API_KEY ??
  readFileSync('.dev.vars', 'utf8')
    .match(/^TFNSW_API_KEY=(.*)$/m)?.[1]
    ?.trim()
    .replace(/^"|"$/g, '')
if (!key) throw new Error('TFNSW_API_KEY is not set and not in .dev.vars')

/** Minimal CSV line parser: quoted fields with doubled quotes, no embedded newlines (GTFS files never have them). */
function parseLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

/** Rows of a CSV file inside the zip as objects, streamed: stop_times.txt is over 100MB. */
async function* rows(zip: string, file: string): AsyncGenerator<Record<string, string>> {
  const unzip = spawn('unzip', ['-p', zip, file])
  let cols: string[] | undefined
  for await (const raw of createInterface({ input: unzip.stdout, crlfDelay: Infinity })) {
    const line = cols ? raw : raw.replace(/^﻿/, '')
    if (!line) continue
    const f = parseLine(line)
    if (!cols) {
      cols = f
      continue
    }
    const r: Record<string, string> = {}
    for (let i = 0; i < cols.length; i++) r[cols[i]] = f[i] ?? ''
    yield r
  }
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
/** Which day type a date counts as: weekday, saturday or sunday. */
const dayType = (d: Date) => (d.getUTCDay() === 6 ? 'saturday' : d.getUTCDay() === 0 ? 'sunday' : 'weekday')

const stations = new Map<string, { name: string; modes: Set<number> }>()
interface Pattern {
  mode: number
  stops: string[]
  /** Sum of minutes from the first stop, per stop, over every trip, for the average. */
  offsets: number[]
  trips: number
  /** Trips per day in each band, averaged over the dates the timetable covers. */
  perBand: number[]
}
const patterns = new Map<string, Pattern>()

const dir = mkdtempSync(join(tmpdir(), 'nextstop-gtfs-'))
try {
  for (const feed of FEEDS) {
    const res = await fetch(`https://api.transport.nsw.gov.au${feed.path}`, { headers: { Authorization: `apikey ${key}` } })
    if (!res.ok) throw new Error(`${feed.path}: HTTP ${res.status}`)
    const zip = join(dir, `${feed.mode}.zip`)
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()))

    const parentOf = new Map<string, string>()
    for await (const r of rows(zip, 'stops.txt')) {
      // location_type 1 is a station; its platforms point at it through parent_station. Rail replacement bus stops
      // ("Buxton Bus") are stations in the train feed too, but nobody searches for them as one.
      if (r.location_type === '1' && / Station$/.test(r.stop_name)) {
        const s = stations.get(r.stop_id) ?? { name: r.stop_name, modes: new Set<number>() }
        s.modes.add(feed.mode)
        stations.set(r.stop_id, s)
      }
      parentOf.set(r.stop_id, r.parent_station || r.stop_id)
    }

    // How many dates of each day type every service runs on, over the whole timetable, so one-off trackwork days
    // weigh little and a pattern's frequency is the typical one.
    const calendar = new Map<string, Record<string, string>>()
    for await (const r of rows(zip, 'calendar.txt')) calendar.set(r.service_id, r)
    const starts = [...calendar.values()].map((c) => c.start_date).sort()
    const ends = [...calendar.values()].map((c) => c.end_date).sort()
    const parse = (s: string) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)))
    const dates: Date[] = []
    for (let d = parse(starts[0]); ymd(d) <= ends[ends.length - 1]; d = new Date(d.getTime() + 86_400_000)) dates.push(d)
    const typeCount = { weekday: 0, saturday: 0, sunday: 0 }
    for (const d of dates) typeCount[dayType(d)]++
    const runs = new Map<string, { weekday: number; saturday: number; sunday: number }>()
    for (const [id, c] of calendar) {
      const n = { weekday: 0, saturday: 0, sunday: 0 }
      for (const d of dates) if (c[DAYS[d.getUTCDay()]] === '1' && c.start_date <= ymd(d) && ymd(d) <= c.end_date) n[dayType(d)]++
      runs.set(id, n)
    }
    // Calendar exceptions, where a feed has them (metro's file is usually empty).
    for await (const r of rows(zip, 'calendar_dates.txt')) {
      const n = runs.get(r.service_id)
      if (n) n[dayType(parse(r.date))] += r.exception_type === '1' ? 1 : -1
    }

    const tripInfo = new Map<string, { service: string; block: string }>()
    for await (const r of rows(zip, 'trips.txt')) {
      if (/empty train/i.test(r.trip_headsign)) continue
      tripInfo.set(r.trip_id, { service: r.service_id, block: r.block_id })
    }

    // Trips' stops where passengers can get on or off.
    type Call = { seq: number; stop: string; min: number; dep: number }
    const tripStops = new Map<string, Call[]>()
    for await (const r of rows(zip, 'stop_times.txt')) {
      if (!tripInfo.has(r.trip_id) || (r.pickup_type === '1' && r.drop_off_type === '1')) continue
      const stop = parentOf.get(r.stop_id) ?? r.stop_id
      // Replacement bus stops that aren't stations are left out of the pattern, not the whole trip.
      if (!stations.has(stop)) continue
      const list = tripStops.get(r.trip_id) ?? []
      const min = (t: string) => {
        const [h, m, s] = t.split(':').map(Number)
        return h * 60 + m + (s || 0) / 60
      }
      // Arrival times, so a terminus layover never counts as riding time; the first stop's departure is set below.
      list.push({
        seq: Number(r.stop_sequence),
        stop,
        min: min(r.arrival_time || r.departure_time),
        dep: min(r.departure_time || r.arrival_time),
      })
      tripStops.set(r.trip_id, list)
    }
    const calls = new Map<string, Call[]>()
    for (const [trip, list] of tripStops) {
      list.sort((a, b) => a.seq - b.seq)
      const kept = list.filter((c, i) => c.stop !== list[i - 1]?.stop)
      if (kept.length) kept[0] = { ...kept[0], min: kept[0].dep }
      calls.set(trip, kept)
    }

    // The timetable splits trains that run through the city into separate trips at Central (a Western Line T1 ends
    // there and a new trip carries on to the North Shore), linked only by the block. Passengers stay on board, so
    // join a trip to the next one in its block when it leaves from where the first ended, within 15 minutes, without
    // reversing.
    const byBlock = new Map<string, string[]>()
    for (const [trip, info] of tripInfo) {
      if (!info.block || !calls.get(trip)?.length) continue
      const key = `${info.service}|${info.block}`
      byBlock.set(key, [...(byBlock.get(key) ?? []), trip])
    }
    const continues = new Map<string, string>()
    const joined = new Set<string>()
    for (const trips of byBlock.values()) {
      trips.sort((a, b) => calls.get(a)![0].min - calls.get(b)![0].min)
      for (let i = 0; i + 1 < trips.length; i++) {
        const a = calls.get(trips[i])!
        const b = calls.get(trips[i + 1])!
        const end = a[a.length - 1]
        const reverses = a.length > 1 && b.length > 1 && a[a.length - 2].stop === b[1].stop
        if (end.stop === b[0].stop && b[0].min - end.min >= 0 && b[0].min - end.min <= 15 && !reverses) {
          continues.set(trips[i], trips[i + 1])
          joined.add(trips[i + 1])
        }
      }
    }

    // Whole runs grouped into stopping patterns. A run that comes back through a station (round the City Circle and
    // out through Central again) is cut there into pieces that each visit a station once.
    const add = (trip: string, run: Call[]) => {
      if (run.length < 2) return
      const stops = run.map((c) => c.stop)
      const times = run.map((c) => c.min)
      const k = `${feed.mode}:${stops.join(',')}`
      const p = patterns.get(k) ?? { mode: feed.mode, stops, offsets: stops.map(() => 0), trips: 0, perBand: BANDS.map(() => 0) }
      times.forEach((t, i) => (p.offsets[i] += t - times[0]))
      p.trips++
      const n = runs.get(tripInfo.get(trip)!.service)!
      BANDS.forEach((b, i) => {
        if (times[0] >= b.from * 60 && times[0] < b.to * 60) p.perBand[i] += n[b.days] / typeCount[b.days]
      })
      patterns.set(k, p)
    }
    for (const [trip, first] of calls) {
      if (joined.has(trip)) continue
      const run = [...first]
      for (let next = continues.get(trip); next; next = continues.get(next)) run.push(...calls.get(next)!.slice(1))
      let piece: Call[] = []
      for (const c of run) {
        if (piece.some((x) => x.stop === c.stop)) {
          add(trip, piece)
          piece = [piece[piece.length - 1]]
        }
        piece.push(c)
      }
      add(trip, piece)
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}

// Compact tuples keep the bundle small: [stop id, name, modes].
const list = [...stations.entries()].map(([id, s]) => [id, s.name, [...s.modes].sort()] as const).sort((a, b) => a[1].localeCompare(b[1]))
writeFileSync('src/data/stations.json', JSON.stringify(list) + '\n')

// Patterns as [mode, stop indexes, minutes from the first stop (halves), trips per hour in each band (tenths)], with
// stops indexing the station id list. Patterns that round to no trips in every band are left out.
const ids = list.map((s) => s[0])
const index = new Map(ids.map((id, i) => [id, i]))
const net = [...patterns.values()]
  .map((p) => [
    p.mode,
    p.stops.map((s) => index.get(s)!),
    p.offsets.map((o) => Math.round((o / p.trips) * 2)),
    p.perBand.map((n, i) => Math.round((n / (BANDS[i].to - BANDS[i].from)) * 10)),
  ])
  .filter((p) => (p[3] as number[]).some((r) => r > 0))
writeFileSync('src/data/network.json', JSON.stringify({ stations: ids, patterns: net }) + '\n')
process.stdout.write(`Wrote ${list.length} stations to src/data/stations.json and ${net.length} patterns to src/data/network.json\n`)
