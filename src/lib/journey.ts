import type { VehicleMode } from '../../shared/vehicles'
import type { InfoLink, Journey, Leg, StopPoint } from '../api/types'
import { modeForClass } from './lines'
import { occupancyFromEnum, occupancyFromName, type OccupancyLevel } from './occupancy'
import { WALK_SPEED_KMH, type WalkPace } from '../store/settings'

export const isTransit = (l: Leg) => (l.transportation?.product?.class ?? 99) < 99

const MIN_TAIL_WALK_SEC = 120

/** Walk time for a distance at the given pace. */
export const walkSeconds = (metres: number, pace: WalkPace) => Math.round(metres / (WALK_SPEED_KMH[pace] / 3.6))

/** Kilometres with at most one decimal. */
export const formatKm = (m: number) => `${Math.max(0.1, Number((m / 1000).toFixed(1)))}km`

/** The walk after the last ride, ignoring short in-station transfers. Duration comes from distance at the user's pace. */
export function trailingWalk(j: Journey, pace: WalkPace = 'normal'): { durationSec: number; distanceM: number; to: string } | undefined {
  let sec = 0
  let metres = 0
  for (let i = j.legs.length - 1; i >= 0 && !isTransit(j.legs[i]); i--) {
    sec += j.legs[i].duration ?? 0
    metres += j.legs[i].distance ?? 0
  }
  if (metres > 0) sec = walkSeconds(metres, pace)
  const last = j.legs[j.legs.length - 1]
  return sec >= MIN_TAIL_WALK_SEC && !isTransit(last) ? { durationSec: sec, distanceM: metres, to: last.destination.name ?? '' } : undefined
}

/** A change must leave at least this long after the platform walk, even when the user allows very tight changes. */
export const MIN_SPARE_SEC = 60

export interface Transfer {
  /** Station where the change happens. */
  at: string
  /** From the arriving ride's arrival to the next ride's departure, using live times when known. */
  gapSec: number
  /** Walking the planner expects in between: the in-station footpath plus any street walk legs. */
  walkSec: number
  /** Index of the ride being changed to. */
  index: number
}

const footPathSec = (l: Leg) =>
  Array.isArray(l.footPathInfo)
    ? (l.footPathInfo as { position?: string; duration?: number }[])
        .filter((f) => f?.position === 'AFTER')
        .reduce((n, f) => n + (f.duration ?? 0), 0)
    : 0

/** Every change in a journey, with live timings, so delays that eat into a connection show up. */
export function transfers(j: Journey): Transfer[] {
  const out: Transfer[] = []
  let prev: Leg | undefined
  let walked = 0
  for (const [index, l] of j.legs.entries()) {
    if (!isTransit(l)) {
      if (prev) walked += l.duration ?? 0
      continue
    }
    if (prev) {
      const arr = Date.parse(prev.destination.arrivalTimeEstimated ?? prev.destination.arrivalTimePlanned ?? '')
      const dep = Date.parse(l.origin.departureTimeEstimated ?? l.origin.departureTimePlanned ?? '')
      if (Number.isFinite(arr) && Number.isFinite(dep)) {
        out.push({ at: stationName(prev.destination), gapSec: (dep - arr) / 1000, walkSec: walked + footPathSec(prev), index })
      }
    }
    prev = l
    walked = 0
  }
  return out
}

/** Shortest gap between one ride arriving and the next departing, walks included; undefined without a change. */
export function shortestTransferSec(j: Journey): number | undefined {
  const t = transfers(j)
  return t.length ? Math.min(...t.map((x) => x.gapSec)) : undefined
}

/**
 * Whether every change leaves at least `minutes` between rides and, after the planner's walk to the next platform,
 * still a minute to spare. Live times are used, so a delayed first train can make a change stop fitting.
 */
export const transferFits = (j: Journey, minutes: number) =>
  transfers(j).every((t) => t.gapSec >= minutes * 60 && t.gapSec - t.walkSec >= MIN_SPARE_SEC)

export interface JourneySummary {
  firstTransit?: Leg
  depPlanned?: string
  depEstimated?: string
  arrPlanned?: string
  arrEstimated?: string
  durationSec: number
  realtime: boolean
  changes: number
}

export function summarize(j: Journey): JourneySummary {
  const transit = j.legs.filter(isTransit)
  const firstTransit = transit[0]
  const last = j.legs[j.legs.length - 1]
  const dep = firstTransit?.origin ?? j.legs[0].origin
  const tail = trailingWalk(j)
  // Walking legs can lack their own times, so the arrival is the last ride's arrival plus the walk.
  const arrival = (t: 'arrivalTimeEstimated' | 'arrivalTimePlanned') => {
    if (last.destination[t]) return last.destination[t]
    const lastRide = transit[transit.length - 1]?.destination[t]
    return lastRide && tail ? new Date(new Date(lastRide).getTime() + tail.durationSec * 1000).toISOString() : lastRide
  }
  const arrEstimated = arrival('arrivalTimeEstimated')
  const arrPlanned = arrival('arrivalTimePlanned')
  // Door-to-door time, so waits between legs count (summing leg durations would hide them).
  const start = j.legs[0].origin.departureTimeEstimated ?? j.legs[0].origin.departureTimePlanned
  const end = arrEstimated ?? arrPlanned
  const elapsed = start && end ? (new Date(end).getTime() - new Date(start).getTime()) / 1000 : 0
  return {
    firstTransit,
    depPlanned: dep.departureTimePlanned,
    depEstimated: dep.departureTimeEstimated,
    arrPlanned,
    arrEstimated,
    durationSec: elapsed > 0 ? elapsed : j.legs.reduce((s, l) => s + (l.duration ?? 0), 0),
    realtime: transit.some((l) => l.isRealtimeControlled),
    changes: Math.max(0, transit.length - 1),
  }
}

export const stopCount = (j: Journey) => j.legs.filter(isTransit).reduce((n, l) => n + Math.max(0, (l.stopSequence?.length ?? 0) - 1), 0)

const minute = 60_000
const ARRIVE_BY_WINDOW_MIN = 5

/**
 * Arrive by: arrivals closest to (and not after) the target time first, in 5-minute bands.
 * Leave now / depart at: earliest arrival first. Ties fall to total time, then changes, then stops.
 */
export function journeyComparator(mode: 'dep' | 'arr', target?: Date) {
  const arrivalMs = (s: JourneySummary) => new Date(s.arrEstimated ?? s.arrPlanned ?? 0).getTime()
  const band = (s: JourneySummary) => {
    if (mode !== 'arr' || !target) return Math.floor(arrivalMs(s) / minute)
    const gap = Math.floor((target.getTime() - arrivalMs(s)) / minute)
    return gap < 0 ? 10_000 - gap : Math.floor(gap / ARRIVE_BY_WINDOW_MIN)
  }
  return (a: Journey, b: Journey): number => {
    const sa = summarize(a)
    const sb = summarize(b)
    return (
      band(sa) - band(sb) ||
      Math.round(sa.durationSec / 60) - Math.round(sb.durationSec / 60) ||
      sa.changes - sb.changes ||
      stopCount(a) - stopCount(b)
    )
  }
}

export function journeyAlerts(j: Journey): InfoLink[] {
  const seen = new Map<string, InfoLink>()
  for (const l of j.legs) for (const i of l.infos ?? []) seen.set(i.id ?? i.subtitle ?? String(seen.size), i)
  return [...seen.values()]
}

export function vehicleModeForLeg(l: Leg): VehicleMode | undefined {
  const key = modeForClass(l.transportation?.product?.class).key
  return key === 'walk' ? undefined : key
}

export const bestDep = (j: Journey) => {
  const s = summarize(j)
  return s.depEstimated ?? s.depPlanned
}

/** Bare platform identifier ("4", "16", "1A") from whichever field the planner filled in. */
export const platformAt = (p: StopPoint): string | undefined => {
  for (const c of [p.properties?.platform, p.properties?.plannedPlatformName, p.name, p.disassembledName]) {
    if (typeof c !== 'string') continue
    const m = c.match(/platform\s*(\w+)/i) ?? c.match(/^[A-Za-z]*?(\d+\w?)$/)
    if (m) return m[1].replace(/^0+(?=\d)/, '')
  }
}

export const platformOf = (l: Leg) => platformAt(l.origin)

export const stationName = (p: StopPoint) => (p.disassembledName ?? p.name ?? '').split(',')[0].replace(/ (Station|Platform).*$/i, '')

/** Predicted occupancy the trip planner attaches to a leg, used before live carriage data exists. */
export function legOccupancy(l: Leg): OccupancyLevel | undefined {
  const bags = [l.properties, l.origin.properties, l.stopSequence?.[0]?.properties]
  for (const bag of bags) {
    const v = bag?.occupancy
    if (typeof v !== 'string' && typeof v !== 'number') continue
    const o = /^\d+$/.test(String(v)) ? occupancyFromEnum(Number(v)) : occupancyFromName(String(v))
    if (o.level) return o
  }
}

export const stripHtml = (s?: string) =>
  s
    ? s
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : ''

interface OptionStats {
  dep: number
  arr: number
  changes: number
  tailSec: number
  spareSec: number
}

function optionStats(j: Journey, pace: WalkPace): OptionStats {
  const s = summarize(j)
  const spare = transfers(j).map((t) => t.gapSec - t.walkSec)
  return {
    dep: Date.parse(s.depEstimated ?? s.depPlanned ?? '') || 0,
    arr: Date.parse(s.arrEstimated ?? s.arrPlanned ?? '') || Infinity,
    changes: s.changes,
    tailSec: trailingWalk(j, pace)?.durationSec ?? 0,
    spareSec: spare.length ? Math.min(...spare) : Infinity,
  }
}

/** A beats B when it leaves no earlier, arrives no later, with no more changes and no longer final walk. */
function beats(a: OptionStats, b: OptionStats): boolean {
  if (a.dep < b.dep || a.arr > b.arr || a.changes > b.changes || a.tailSec > b.tailSec) return false
  const strictly = a.dep > b.dep || a.arr < b.arr || a.changes < b.changes || a.tailSec < b.tailSec
  // Same trains changed at a different station: keep the roomier change.
  return strictly || a.spareSec > b.spareSec
}

/**
 * Drops options nobody should pick. Forcing routes via the city hubs returns the same two trains changed at
 * Central and at Town Hall, or detours that leave with a direct train and arrive later; each is beaten by another option.
 */
export function bestOptions(journeys: Journey[], pace: WalkPace = 'normal'): Journey[] {
  const stats = journeys.map((j) => optionStats(j, pace))
  return journeys.filter((_, i) => !stats.some((o, k) => k !== i && (beats(o, stats[i]) || (k < i && sameStats(o, stats[i])))))
}

const sameStats = (a: OptionStats, b: OptionStats) =>
  a.dep === b.dep && a.arr === b.arr && a.changes === b.changes && a.tailSec === b.tailSec && a.spareSec === b.spareSec

export interface TripListOptions {
  now: number
  /** A chosen time shows trips around it even when they have left; "now" searches hide departed ones. */
  when?: Date
  mode: 'dep' | 'arr'
  maxEndWalkMin: number
  minTransferMin: number
  pace: WalkPace
}

/**
 * The search list: the user's walk and change limits applied, beaten options removed, best first. Hidden counts only
 * include trips that would really have added an option, so the hints never advertise duplicates.
 */
export function tripList(journeys: Journey[], o: TripListOptions) {
  const upcoming = journeys.filter((j) => {
    if (o.when) return true
    const s = summarize(j)
    return Date.parse(s.depEstimated ?? s.depPlanned ?? '') > o.now - 60_000
  })
  const walkOk = (j: Journey) => (trailingWalk(j, o.pace)?.durationSec ?? 0) <= o.maxEndWalkMin * 60
  const changeOk = (j: Journey) => transferFits(j, o.minTransferMin)
  const visible = bestOptions(
    upcoming.filter((j) => walkOk(j) && changeOk(j)),
    o.pace,
  ).sort(journeyComparator(o.mode, o.when))
  const shown = visible.map((j) => optionStats(j, o.pace))
  const hidden = bestOptions(
    upcoming.filter((j) => !walkOk(j) || !changeOk(j)),
    o.pace,
  ).filter((j) => {
    const st = optionStats(j, o.pace)
    return !shown.some((v) => beats(v, st) || sameStats(v, st))
  })
  return {
    visible,
    hiddenByWalk: hidden.filter((j) => !walkOk(j)).length,
    hiddenByTransfer: hidden.filter((j) => walkOk(j) && !changeOk(j)).length,
  }
}
