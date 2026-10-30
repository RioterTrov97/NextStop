import type { Journey, Leg, StopEvent } from '../api/types'

/**
 * A departure-board entry as a one-ride journey, so it can use the same card, sheet and follow flow as a planned
 * trip. The board knows where and when it leaves but not when it arrives; `fromDepartureBoard` marks that.
 */
export function departureLeg(e: StopEvent): Leg {
  const t = e.transportation
  return {
    origin: { ...e.location, departureTimePlanned: e.departureTimePlanned, departureTimeEstimated: e.departureTimeEstimated },
    destination: { id: t?.destination?.id, name: (t?.destination?.name ?? t?.description ?? '').replace(/ via .*$/i, '') },
    transportation: { ...t, properties: { ...t?.properties, RealtimeTripId: e.properties?.RealtimeTripId } },
    isRealtimeControlled: e.isRealtimeControlled,
    realtimeStatus: e.realtimeStatus,
    infos: e.infos,
    properties: { fromDepartureBoard: true },
  }
}

export const departureJourney = (e: StopEvent): Journey => ({ legs: [departureLeg(e)] })

/**
 * Stable identity for a departure across refreshes. The trip id alone isn't unique on a board: a loop bus can
 * call at two stands of the same station, so the stop and planned time are part of it.
 */
export const departureKey = (e: StopEvent) =>
  `${e.properties?.RealtimeTripId ?? e.transportation?.id}@${e.location?.id ?? ''}@${e.departureTimePlanned}`

export const isFromDepartureBoard = (l: Leg) => l.properties?.fromDepartureBoard === true
