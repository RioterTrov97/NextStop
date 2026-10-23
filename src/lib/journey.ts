import type { VehicleMode } from '../../shared/vehicles'
import type { InfoLink, Journey, Leg, StopPoint } from '../api/types'
import { modeForClass } from './lines'
import { occupancyFromEnum, occupancyFromName, type OccupancyLevel } from './occupancy'

export const isTransit = (l: Leg) => (l.transportation?.product?.class ?? 99) < 99

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
  const arrEstimated = last.destination.arrivalTimeEstimated
  const arrPlanned = last.destination.arrivalTimePlanned
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
