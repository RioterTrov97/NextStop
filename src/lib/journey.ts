import type { VehicleMode } from '../../shared/vehicles'
import type { InfoLink, Journey, Leg, StopPoint } from '../api/types'
import { modeForClass } from './lines'
import { occupancyFromEnum, occupancyFromName, type OccupancyLevel } from './occupancy'
import { WALK_SPEED_KMH, type WalkPace } from '../store/settings'

export const isTransit = (l: Leg) => (l.transportation?.product?.class ?? 99) < 99

const MIN_TAIL_WALK_SEC = 120

/** Walk time for a distance at the given pace. */
export const walkSeconds = (metres: number, pace: WalkPace) => Math.round(metres / (WALK_SPEED_KMH[pace] / 3.6))

/** A walk in whole minutes, as the walk badge shows it (at least 1 for any walk, 0 for none). */
export const walkMinutes = (sec: number | undefined) => (sec ? Math.max(1, Math.round(sec / 60)) : 0)

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

/**
 * The walk before the first ride, when a trip starts from an address or a stop away from the boarding point. Short
 * in-station walks don't count. Duration comes from distance at the user's pace.
 */
export function leadingWalk(j: Journey, pace: WalkPace = 'normal'): { durationSec: number; distanceM: number; from: string } | undefined {
  let sec = 0
  let metres = 0
  let i = 0
  for (; i < j.legs.length && !isTransit(j.legs[i]); i++) {
    sec += j.legs[i].duration ?? 0
    metres += j.legs[i].distance ?? 0
  }
  // A journey that is all walking has no first ride to walk to.
  if (i === 0 || i === j.legs.length) return undefined
  if (metres > 0) sec = walkSeconds(metres, pace)
  return sec >= MIN_TAIL_WALK_SEC ? { durationSec: sec, distanceM: metres, from: j.legs[0].origin.name ?? '' } : undefined
}

/**
 * When to set off: the first ride's departure (live time first) less the walk to it, as epoch milliseconds. Without a
 * walk at the start, it is the departure itself.
 */
export function leaveAt(j: Journey, pace: WalkPace = 'normal'): number {
  const first = j.legs.find(isTransit)
  const dep = Date.parse(first?.origin.departureTimeEstimated ?? first?.origin.departureTimePlanned ?? '')
  return dep - (leadingWalk(j, pace)?.durationSec ?? 0) * 1000
}

export interface SetOff {
  /** When to leave (ISO), if the trip starts with a walk. */
  leave?: string
  /** What the countdown counts to: the time to leave until shortly after it passes, then the first ride's departure. */
  countTo?: string
  /** Whether the countdown is to leaving rather than to the ride. */
  leaving: boolean
  walk?: { durationSec: number; distanceM: number }
}

/** The countdown target for a trip card: leaving the door for trips that start with a walk, else the ride itself. */
export function setOff(j: Journey, pace: WalkPace, now: number): SetOff {
  const s = summarize(j)
  const dep = s.depEstimated ?? s.depPlanned
  const walk = leadingWalk(j, pace)
  if (!walk) return { countTo: dep, leaving: false }
  const at = leaveAt(j, pace)
  const leave = Number.isFinite(at) ? new Date(at).toISOString() : undefined
  // The countdown shows "Now" for a minute after the time passes; after that, the train is what matters.
  const leaving = !!leave && now < at + 60_000
  return { leave, countTo: leaving ? leave : dep, leaving, walk }
}

/** A change must leave at least this long after the platform walk, even when the user allows very tight changes. */
/**
 * How much longer the planner's walks are at each pace than at "fast", measured on its answers (2026-11-16, Lidcombe):
 * street walks of 424m and 533m took 240s and 360s fast, 420s and 660s normal, 600s and 1080s slow; in-station changes
 * 60-180s fast, 120-300s normal.
 */
const PLANNER_WALK_FACTOR: Record<WalkPace, number> = { fast: 1, normal: 1.8, slow: 2.7 }

const shiftIso = (iso: string | undefined, sec: number) => (iso ? new Date(Date.parse(iso) + sec * 1000).toISOString() : iso)

/**
 * A journey the planner worked out at the fast pace, with its walks stretched to `pace`: street walks, in-station
 * footpaths (which decide whether a change fits), and the times at the two ends. The rides keep their times.
 */
export function walksAtPace(j: Journey, pace: WalkPace): Journey {
  const factor = PLANNER_WALK_FACTOR[pace]
  if (factor === 1) return j
  const first = j.legs.findIndex(isTransit)
  const last = j.legs.length - 1 - [...j.legs].reverse().findIndex(isTransit)
  if (first < 0) return j
  let lead = 0
  let tail = 0
  const legs = j.legs.map((l, i) => {
    const out: Leg = { ...l }
    if (Array.isArray(l.footPathInfo))
      out.footPathInfo = (l.footPathInfo as { duration?: number }[]).map((f) =>
        f?.duration ? { ...f, duration: Math.round(f.duration * factor) } : f,
      )
    if (!isTransit(l) && l.duration) {
      out.duration = Math.round(l.duration * factor)
      if (i < first) lead += out.duration - l.duration
      if (i > last) tail += out.duration - l.duration
    }
    return out
  })
  if (lead) {
    const o = legs[0].origin
    legs[0] = {
      ...legs[0],
      origin: {
        ...o,
        departureTimePlanned: shiftIso(o.departureTimePlanned, -lead),
        departureTimeEstimated: shiftIso(o.departureTimeEstimated, -lead),
      },
    }
  }
  if (tail) {
    const end = legs.length - 1
    const d = legs[end].destination
    legs[end] = {
      ...legs[end],
      destination: {
        ...d,
        arrivalTimePlanned: shiftIso(d.arrivalTimePlanned, tail),
        arrivalTimeEstimated: shiftIso(d.arrivalTimeEstimated, tail),
      },
    }
  }
  return { ...j, legs }
}

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

/**
 * Times and totals for a card. Walks at either end count at the user's pace (from their distance), like the walk badges
 * and the leave time, rather than at the planner's slower walking times, so leave time, arrival and total agree.
 */
export function summarize(j: Journey, pace: WalkPace = 'normal'): JourneySummary {
  const transit = j.legs.filter(isTransit)
  const firstTransit = transit[0]
  const last = j.legs[j.legs.length - 1]
  const dep = firstTransit?.origin ?? j.legs[0].origin
  const tail = trailingWalk(j, pace)
  const lead = leadingWalk(j, pace)
  // The last ride's arrival plus the walk; walking legs can lack their own times anyway.
  const arrival = (t: 'arrivalTimeEstimated' | 'arrivalTimePlanned') => {
    const lastRide = transit[transit.length - 1]?.destination[t]
    if (lastRide && tail) return new Date(new Date(lastRide).getTime() + tail.durationSec * 1000).toISOString()
    return last.destination[t] ?? lastRide
  }
  const arrEstimated = arrival('arrivalTimeEstimated')
  const arrPlanned = arrival('arrivalTimePlanned')
  // Door-to-door time, so waits between legs count (summing leg durations would hide them).
  const rideDep = dep.departureTimeEstimated ?? dep.departureTimePlanned
  const start =
    lead && rideDep ? Date.parse(rideDep) - lead.durationSec * 1000 : Date.parse(j.legs[0].origin.departureTimeEstimated ?? j.legs[0].origin.departureTimePlanned ?? '')
  const end = Date.parse(arrEstimated ?? arrPlanned ?? '')
  const elapsed = Number.isFinite(start) && Number.isFinite(end) ? (end - start) / 1000 : 0
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
export function journeyComparator(mode: 'dep' | 'arr', target?: Date, pace: WalkPace = 'normal') {
  const arrivalMs = (s: JourneySummary) => new Date(s.arrEstimated ?? s.arrPlanned ?? 0).getTime()
  const band = (s: JourneySummary) => {
    if (mode !== 'arr' || !target) return Math.floor(arrivalMs(s) / minute)
    const gap = Math.floor((target.getTime() - arrivalMs(s)) / minute)
    return gap < 0 ? 10_000 - gap : Math.floor(gap / ARRIVE_BY_WINDOW_MIN)
  }
  return (a: Journey, b: Journey): number => {
    const sa = summarize(a, pace)
    const sb = summarize(b, pace)
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
  const s = summarize(j, pace)
  const spare = transfers(j).map((t) => t.gapSec - t.walkSec)
  return {
    // Leaving the door later is what counts when trips start with different walks.
    dep: leaveAt(j, pace) || Date.parse(s.depEstimated ?? s.depPlanned ?? '') || 0,
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
  /** Longest walk to the first ride; trips from a station rarely start with one. */
  maxStartWalkMin?: number
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
  // Compared in the whole minutes the walk badge shows, so a walk shown as "20m" is never hidden by a 20 min limit.
  const startOk = (j: Journey) => o.maxStartWalkMin === undefined || walkMinutes(leadingWalk(j, o.pace)?.durationSec) <= o.maxStartWalkMin
  const endOk = (j: Journey) => walkMinutes(trailingWalk(j, o.pace)?.durationSec) <= o.maxEndWalkMin
  const walkOk = (j: Journey) => startOk(j) && endOk(j)
  const changeOk = (j: Journey) => transferFits(j, o.minTransferMin)
  const visible = bestOptions(
    upcoming.filter((j) => walkOk(j) && changeOk(j)),
    o.pace,
  ).sort(journeyComparator(o.mode, o.when, o.pace))
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
    hiddenByStartWalk: hidden.filter((j) => !startOk(j)).length,
    hiddenByWalk: hidden.filter((j) => startOk(j) && !endOk(j)).length,
    hiddenByTransfer: hidden.filter((j) => walkOk(j) && !changeOk(j)).length,
  }
}
