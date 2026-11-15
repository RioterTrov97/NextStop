import type { Journey, Leg, StopPoint } from '../api/types'
import type { CurrentTrip, TripAnchor } from '../store/currentTrip'
import { isFromDepartureBoard } from './departure'
import { isTransit, stationName, summarize, transferFits, transfers } from './journey'
import { endRideAt, rideNow, stationIdOf, stopAhead, tripIdOf } from './ride'

/** A replan has to beat the current arrival by this much to be worth a change of plan. */
export const FASTER_BY_MS = 3 * 60_000

const ms = (iso?: string) => (iso ? Date.parse(iso) : NaN)
const depMs = (l: Leg) => ms(l.origin.departureTimeEstimated ?? l.origin.departureTimePlanned)
const arrMs = (l: Leg) => ms(l.destination.arrivalTimeEstimated ?? l.destination.arrivalTimePlanned)
const placeKey = (p: StopPoint) => p.id ?? p.name ?? ''

export const isCancelled = (l: Leg) => l.properties?.isCancelled === true || !!l.realtimeStatus?.some((s) => /CANCEL/i.test(s))

export function arrivalMs(j: Journey): number {
  const s = summarize(j)
  return ms(s.arrEstimated ?? s.arrPlanned)
}

/** Identifies the same ride or walk across separate planner responses. */
function legKey(l: Leg): string {
  if (!isTransit(l)) return `w:${placeKey(l.origin)}>${placeKey(l.destination)}`
  const t = l.transportation
  return `t:${t?.properties?.RealtimeTripId ?? `${t?.id}@${l.origin.departureTimePlanned}`}@${placeKey(l.origin)}`
}

/**
 * Swaps each stored leg for its freshest copy from any live response, so delays, platforms and cancellations
 * stay current even when the planner no longer offers the journey as a whole (e.g. after a missed connection,
 * or for a route the user switched to mid-trip).
 */
export function withLiveLegs(stored: Journey, live: Journey[]): Journey {
  const pool = new Map<string, Leg>()
  // Planner legs win over departure-board ones for the same ride, since they carry stops and arrival times too.
  for (const j of live)
    for (const l of j.legs) {
      const have = pool.get(legKey(l))
      if (!have || (isFromDepartureBoard(have) && !isFromDepartureBoard(l))) pool.set(legKey(l), l)
    }
  let changed = false
  const legs = stored.legs.map((l) => {
    let fresh = pool.get(legKey(l))
    if (!fresh || fresh === l) return l
    // The same ride to somewhere else: the traveller gets off earlier (a switch mid-ride) or later than this lookup.
    if (isTransit(l) && !isFromDepartureBoard(fresh) && stationIdOf(fresh.destination) !== stationIdOf(l.destination)) {
      const end = (fresh.stopSequence ?? []).findIndex((st, i) => i > 0 && stationIdOf(st) === stationIdOf(l.destination))
      if (end < 0) return l
      fresh = endRideAt(fresh, end)
    }
    changed = true
    // A departure board only knows the departure: take its times, platform and status, keep everything else.
    if (isFromDepartureBoard(fresh) && !isFromDepartureBoard(l)) {
      return {
        ...l,
        origin: { ...l.origin, ...fresh.origin },
        realtimeStatus: fresh.realtimeStatus,
        isRealtimeControlled: fresh.isRealtimeControlled,
      }
    }
    return fresh
  })
  return changed ? { ...stored, legs } : stored
}

/** When a run of legs leaves: its first leg if timed (walks often are), else its first ride. */
function segmentStart(legs: Leg[]): string | undefined {
  return legs[0]?.origin.departureTimePlanned ?? legs.find(isTransit)?.origin.departureTimePlanned
}

export interface TrackSegment {
  fromId: string
  /** Planned departure of the segment's first leg. */
  when?: string
  start: number
  end: number
}

/** The planner lookups needed to keep every unfinished part of the trip live: the original search plus one per switch. */
export function trackSegments(trip: CurrentTrip, now: number): TrackSegment[] {
  const legs = trip.journey.legs
  const anchors: TripAnchor[] = (trip.anchors ?? []).filter((a) => a.keep >= 0 && a.keep < legs.length).sort((a, b) => a.keep - b.keep)
  // A switch made on the first ride re-anchors the trip itself (looked up from the stop where it was made).
  const starts = anchors[0]?.keep === 0 ? anchors : [{ keep: 0, fromId: trip.fromId, when: undefined as string | undefined }, ...anchors]
  return starts
    .map((a, i) => {
      const end = starts[i + 1]?.keep ?? legs.length
      return { fromId: a.fromId, when: a.when ?? segmentStart(legs.slice(a.keep, end)), start: a.keep, end }
    })
    .filter((s) => legs.slice(s.start, s.end).some((l) => !(arrMs(l) < now - 2 * 60_000)))
}

export interface ReplanPoint {
  /** Legs kept as they are; a replan replaces everything from here on. */
  keep: number
  stopId: string
  stopName: string
  /** When the traveller can leave from that stop. */
  readyAt: number
  /**
   * Set while riding: the stop is the ride's next stop, where the traveller could stay on or get off. Leg `leg` is the
   * ride itself (kept up to `stop` of its stopSequence); `keep` equals `leg`.
   */
  ride?: { leg: number; stop: number; tripId: string }
}

/**
 * The next place the user could change plans: on a ride, its next stop with a known time (stay on, or get off for
 * something faster); before boarding, the trip origin; otherwise the stop where the last ride ended.
 */
export function replanPoint(trip: CurrentTrip, journey: Journey, now: number): ReplanPoint | undefined {
  const legs = journey.legs
  const riding = rideNow(journey, now)
  const tripId = riding >= 0 ? tripIdOf(legs[riding]) : undefined
  const ahead = tripId ? stopAhead(legs[riding], now) : undefined
  if (ahead && tripId) {
    return {
      keep: riding,
      stopId: ahead.stationId,
      stopName: stationName(ahead.point),
      readyAt: ahead.at,
      ride: { leg: riding, stop: ahead.stop, tripId },
    }
  }
  const next = legs.findIndex((l) => isTransit(l) && !(depMs(l) <= now))
  if (next < 0) return undefined
  let prev = -1
  for (let i = next - 1; i >= 0; i--) {
    if (isTransit(legs[i])) {
      prev = i
      break
    }
  }
  if (prev < 0) {
    // Before boarding, only look around the time the user planned to leave, not at earlier trips they chose not to take.
    const planned = ms(legs[next].origin.departureTimePlanned)
    const readyAt = Math.max(now, Number.isFinite(planned) ? planned - 2 * 60_000 : now)
    return { keep: 0, stopId: trip.fromId, stopName: trip.fromName.split(',')[0], readyAt }
  }
  const station = legs[prev].destination
  const arrival = arrMs(legs[prev])
  return {
    keep: prev + 1,
    stopId: (station.parent?.type === 'stop' && station.parent.id) || station.id || stationName(station),
    stopName: stationName(station),
    readyAt: Math.max(now, Number.isFinite(arrival) ? arrival : now),
  }
}

export type ReplanReason = 'cancelled' | 'missed' | 'faster'

export interface Replan {
  reason: ReplanReason
  point: ReplanPoint
  /** The alternative from the replan stop to the destination. */
  route: Journey
  /** The whole trip with the alternative stitched on after the kept legs. */
  journey: Journey
  arrival: number
  /** How much earlier than the current plan; negative when the current plan is broken and this is merely the best option. */
  savedMs: number
}

/** Why the remaining plan can't be trusted, if it can't: a cancelled ride, or a change that live times no longer allow. */
export function brokenReason(journey: Journey, keep: number): 'cancelled' | 'missed' | undefined {
  if (journey.legs.some((l, i) => i >= keep && isTransit(l) && isCancelled(l))) return 'cancelled'
  // Missed when, on live times, the walk to the next platform takes longer than the gap.
  if (transfers(journey).some((t) => t.index >= keep && t.gapSec < t.walkSec)) return 'missed'
}

const routeKey = (legs: Leg[]) => legs.filter(isTransit).map(legKey).join('|')
/** The services a route rides, wherever each is boarded: a lookup from mid-ride boards the current train at a later stop. */
const serviceKey = (legs: Leg[]) =>
  legs
    .filter(isTransit)
    .map((l) => tripIdOf(l) ?? legKey(l))
    .join('|')

/** Does this route carry on in the train the traveller is already on? */
export const staysOn = (point: ReplanPoint, route: Journey) => {
  const first = route.legs[0]
  return !!point.ride && !!first && isTransit(first) && tripIdOf(first) === point.ride.tripId
}

/** The whole trip with `route` taking over at the replan point. */
function stitch(journey: Journey, point: ReplanPoint, route: Journey): Journey {
  const legs = journey.legs
  if (!point.ride) return { ...journey, legs: [...legs.slice(0, point.keep), ...route.legs] }
  const { leg, stop } = point.ride
  const current = legs[leg]
  if (staysOn(point, route)) {
    // Still the same train: one ride from where the user boarded to wherever the new route leaves it.
    const [first, ...rest] = route.legs
    const joined: Leg = {
      ...first,
      origin: current.origin,
      stopSequence: [...(current.stopSequence ?? []).slice(0, stop), ...(first.stopSequence ?? [])],
      coords: undefined,
      duration: undefined,
    }
    return { ...journey, legs: [...legs.slice(0, leg), joined, ...rest] }
  }
  return { ...journey, legs: [...legs.slice(0, leg), endRideAt(current, stop), ...route.legs] }
}

/** The best alternative from the replan point, when it's worth switching to: the plan is broken, or it arrives clearly sooner. */
export function findReplan(journey: Journey, point: ReplanPoint, alternatives: Journey[], minTransferMin: number): Replan | undefined {
  const remaining = journey.legs.slice(point.keep)
  const current = arrivalMs(journey)
  const broken = brokenReason(journey, point.keep)
  // Getting off, or at an interchange, the user still needs time to reach the next platform; the planner's own walk
  // legs cover the rest. Staying on the current train needs no time at all.
  const earliest = point.readyAt + (point.keep > 0 || point.ride ? minTransferMin * 60_000 : -30_000)
  const key = point.ride ? serviceKey : routeKey
  const sameRoute = key(remaining)

  let best: { route: Journey; arrival: number; leaves: number } | undefined
  for (const route of alternatives) {
    const firstRide = route.legs.find(isTransit)
    if (!firstRide || (depMs(firstRide) < earliest && !staysOn(point, route))) continue
    if (route.legs.some(isCancelled) || !transferFits(route, minTransferMin)) continue
    if (key(route.legs) === sameRoute) continue
    if (brokenReason(route, 0)) continue
    const arrival = arrivalMs(route)
    if (!Number.isFinite(arrival)) continue
    // Equal arrivals go to the earlier departure: usually the train the user is already waiting for.
    const leaves = depMs(firstRide)
    if (!best || arrival < best.arrival || (arrival === best.arrival && leaves < best.leaves)) best = { route, arrival, leaves }
  }
  if (!best) return undefined

  const savedMs = Number.isFinite(current) ? current - best.arrival : 0
  const reason: ReplanReason | undefined = broken ?? (savedMs >= FASTER_BY_MS ? 'faster' : undefined)
  if (!reason) return undefined
  return {
    reason,
    point,
    route: best.route,
    journey: stitch(journey, point, best.route),
    arrival: best.arrival,
    savedMs,
  }
}

/** The trip as it should be stored after switching to a replan. */
export function applyReplan(trip: CurrentTrip, replan: Replan): CurrentTrip {
  const { point, route } = replan
  const when = segmentStart(route.legs) ?? new Date(point.readyAt).toISOString()
  if (point.ride) {
    // From here on the trip is looked up from the stop where the switch happens. Staying on, that lookup also covers
    // the current ride (boarded there at a later stop); getting off, it starts with the new route.
    const keep = staysOn(point, route) ? point.ride.leg : point.ride.leg + 1
    const anchors = (trip.anchors ?? []).filter((a) => a.keep < keep)
    return { ...trip, journey: replan.journey, anchors: [...anchors, { keep, fromId: point.stopId, when }] }
  }
  const { keep } = point
  if (keep === 0) return { ...trip, journey: route, anchors: undefined }
  const anchors = (trip.anchors ?? []).filter((a) => a.keep < keep)
  return { ...trip, journey: replan.journey, anchors: [...anchors, { keep, fromId: point.stopId, when }] }
}
