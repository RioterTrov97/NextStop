import type { Journey, Leg, StopPoint } from '../api/types'
import { isTransit } from './journey'

/**
 * Helpers for a ride that is already under way. Once a service has left its first stop the planner stops sending its
 * load forecast, but planning from a stop it has yet to reach still returns it, with its live times and forecast.
 */

const ms = (iso?: string) => (iso ? Date.parse(iso) : NaN)
const depMs = (l: Leg) => ms(l.origin.departureTimeEstimated ?? l.origin.departureTimePlanned)
const arrMs = (l: Leg) => ms(l.destination.arrivalTimeEstimated ?? l.destination.arrivalTimePlanned)

/** When a service reaches a stop (arrival, else departure); NaN for the many stops the planner lists without times. */
export const stopMs = (s: StopPoint) =>
  ms(s.arrivalTimeEstimated ?? s.arrivalTimePlanned ?? s.departureTimeEstimated ?? s.departureTimePlanned)

/** The station a stop or platform belongs to, so platforms of one station compare equal. */
export const stationIdOf = (s: StopPoint) => (s.parent?.type === 'stop' && s.parent.id) || s.id || ''

export const tripIdOf = (l: Leg) => l.transportation?.properties?.RealtimeTripId

/** The ride the traveller is on right now (left, not yet arrived), or -1. */
export function rideNow(j: Journey, now: number): number {
  return j.legs.findIndex((l) => isTransit(l) && depMs(l) <= now && arrMs(l) > now)
}

export interface StopAhead {
  /** Index into the ride's `stopSequence`. */
  stop: number
  point: StopPoint
  stationId: string
  at: number
}

/** The next stop with a known time that the ride has yet to reach, at least `leadMs` away, short of where it ends. */
export function stopAhead(leg: Leg, now: number, leadMs = 60_000): StopAhead | undefined {
  const stops = leg.stopSequence ?? []
  const end = stationIdOf(leg.destination)
  for (let i = 1; i < stops.length; i++) {
    const stationId = stationIdOf(stops[i])
    if (stationId === end) return undefined
    const at = stopMs(stops[i])
    if (stationId && at > now + leadMs) return { stop: i, point: stops[i], stationId, at }
  }
}

/** The ride cut short at one of its stops, for when the traveller gets off early. */
export function endRideAt(leg: Leg, stop: number): Leg {
  const stops = leg.stopSequence ?? []
  const destination = stops[stop]
  const duration = (ms(destination.arrivalTimePlanned ?? destination.departureTimePlanned) - ms(leg.origin.departureTimePlanned)) / 1000
  return {
    ...leg,
    destination,
    stopSequence: stops.slice(0, stop + 1),
    coords: undefined,
    duration: Number.isFinite(duration) ? duration : undefined,
  }
}

const TIMES = ['arrivalTimePlanned', 'arrivalTimeEstimated', 'departureTimePlanned', 'departureTimeEstimated'] as const

function withTimes(stored: StopPoint, fresh: StopPoint): StopPoint {
  let out = stored
  for (const k of TIMES) {
    if (fresh[k] && fresh[k] !== stored[k]) out = { ...out, [k]: fresh[k] }
  }
  return out
}

/** The planner's raw occupancy value on a leg (its own properties, its first stop, or the first listed stop). */
export function rawOccupancy(l: Leg): string | undefined {
  for (const bag of [l.properties, l.origin.properties, l.stopSequence?.[0]?.properties]) {
    const v = bag?.occupancy
    if ((typeof v === 'string' || typeof v === 'number') && String(v) !== '' && String(v) !== '0') return String(v)
  }
}

/**
 * Brings a running ride up to date from a lookup that starts further along it: live times for the stops both know,
 * the arrival when they end at the same station, the realtime status, and the load forecast, which the planner only
 * sends for a service that has yet to reach the lookup's first stop. Returns the stored journey when nothing changed.
 */
export function withRideAhead(stored: Journey, live: Journey[]): Journey {
  const byTrip = new Map<string, Leg[]>()
  for (const j of live)
    for (const l of j.legs) {
      const id = isTransit(l) ? tripIdOf(l) : undefined
      if (id) byTrip.set(id, [...(byTrip.get(id) ?? []), l])
    }
  if (!byTrip.size) return stored

  let changed = false
  const legs = stored.legs.map((l) => {
    const id = tripIdOf(l)
    const stops = l.stopSequence ?? []
    if (!id || !isTransit(l) || !byTrip.has(id)) return l
    const stopIds = stops.map(stationIdOf)
    // The lookup furthest along the ride is the freshest; one starting where the user boarded is handled elsewhere.
    let fresh: Leg | undefined
    let freshAt = 0
    for (const c of byTrip.get(id)!) {
      const at = stopIds.indexOf(stationIdOf(c.origin), 1)
      if (at > freshAt) {
        fresh = c
        freshAt = at
      }
    }
    if (!fresh) return l

    const freshStops = new Map((fresh.stopSequence ?? []).map((s) => [stationIdOf(s), s]))
    const nextStops = stops.map((s) => {
      const f = freshStops.get(stationIdOf(s))
      return f ? withTimes(s, f) : s
    })
    const sameEnd = stationIdOf(fresh.destination) === stationIdOf(l.destination)
    const forecast = rawOccupancy(fresh)
    const next: Leg = {
      ...l,
      destination: sameEnd ? withTimes(l.destination, fresh.destination) : l.destination,
      stopSequence: nextStops.some((s, i) => s !== stops[i]) ? nextStops : l.stopSequence,
      isRealtimeControlled: fresh.isRealtimeControlled ?? l.isRealtimeControlled,
      realtimeStatus: fresh.realtimeStatus ?? l.realtimeStatus,
      properties: forecast ? { ...l.properties, occupancy: forecast } : l.properties,
    }
    const same =
      next.destination === l.destination &&
      next.stopSequence === l.stopSequence &&
      next.isRealtimeControlled === l.isRealtimeControlled &&
      next.realtimeStatus === l.realtimeStatus &&
      next.properties === l.properties
    if (same) return l
    changed = true
    return next
  })
  return changed ? { ...stored, legs } : stored
}
