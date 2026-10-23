import type { VehicleMode } from '../../shared/vehicles'
import type { InfoLink, Journey, Leg } from '../api/types'
import { modeForClass } from './lines'

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
  return {
    firstTransit,
    depPlanned: dep.departureTimePlanned,
    depEstimated: dep.departureTimeEstimated,
    arrPlanned: last.destination.arrivalTimePlanned,
    arrEstimated: last.destination.arrivalTimeEstimated,
    durationSec: j.legs.reduce((s, l) => s + (l.duration ?? 0), 0),
    realtime: transit.some((l) => l.isRealtimeControlled),
    changes: Math.max(0, transit.length - 1),
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

export const platformOf = (l: Leg) => {
  const p = l.origin.properties?.plannedPlatformName ?? l.origin.properties?.platform
  return typeof p === 'string' ? p : undefined
}

export const stripHtml = (s?: string) => (s ? s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '')
