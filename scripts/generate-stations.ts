// Rebuilds src/data/stations.json from the TfNSW GTFS timetables, so station search can answer before the stop finder does.
// Usage: node scripts/generate-stations.ts   (reads TFNSW_API_KEY from the environment or .dev.vars; needs `unzip` on PATH)
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

/** Minimal CSV line parser: quoted fields with doubled quotes, no embedded newlines (GTFS stops.txt never has them). */
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

const stations = new Map<string, { name: string; modes: Set<number> }>()
const dir = mkdtempSync(join(tmpdir(), 'nextstop-gtfs-'))
try {
  for (const feed of FEEDS) {
    const res = await fetch(`https://api.transport.nsw.gov.au${feed.path}`, { headers: { Authorization: `apikey ${key}` } })
    if (!res.ok) throw new Error(`${feed.path}: HTTP ${res.status}`)
    const zip = join(dir, `${feed.mode}.zip`)
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()))
    const csv = execFileSync('unzip', ['-p', zip, 'stops.txt'], { maxBuffer: 64 * 1024 * 1024 })
      .toString('utf8')
      .replace(/^\uFEFF/, '')
    const [header, ...rows] = csv.split(/\r?\n/).filter(Boolean)
    const cols = parseLine(header)
    const col = (name: string) => cols.indexOf(name)
    const [id, name, type] = [col('stop_id'), col('stop_name'), col('location_type')]
    for (const row of rows) {
      const f = parseLine(row)
      // location_type 1 is a station; its platforms point at it through parent_station. Rail replacement bus stops
      // ("Buxton Bus") are stations in the train feed too, but nobody searches for them as one.
      if (f[type] !== '1' || !/ Station$/.test(f[name])) continue
      const s = stations.get(f[id]) ?? { name: f[name], modes: new Set<number>() }
      s.modes.add(feed.mode)
      stations.set(f[id], s)
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}

// Compact tuples keep the bundle small: [stop id, name, modes].
const list = [...stations.entries()].map(([id, s]) => [id, s.name, [...s.modes].sort()] as const).sort((a, b) => a[1].localeCompare(b[1]))
writeFileSync('src/data/stations.json', JSON.stringify(list) + '\n')
process.stdout.write(`Wrote ${list.length} stations to src/data/stations.json\n`)
