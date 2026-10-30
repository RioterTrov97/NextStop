import type { Journey, Leg, StopPoint } from '../api/types'
import type { CurrentTrip, TripAnchor } from '../store/currentTrip'
import { isFromDepartureBoard } from './departure'
import { isTransit, stationName, summarize, transferFits, transfers } from './journey'

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
    const fresh = pool.get(legKey(l))
    if (!fresh || fresh === l) return l
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
  const anchors: TripAnchor[] = (trip.anchors ?? []).filter((a) => a.keep > 0 && a.keep < legs.length).sort((a, b) => a.keep - b.keep)
  const starts = [{ keep: 0, fromId: trip.fromId, when: undefined as string | undefined }, ...anchors]
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
}

/** The next place the user could change plans: the trip origin before boarding, otherwise the stop where the current or last ride ends. */
export function replanPoint(trip: CurrentTrip, journey: Journey, now: number): ReplanPoint | undefined {
  const legs = journey.legs
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

/** The best alternative from the replan point, when it's worth switching to: the plan is broken, or it arrives clearly sooner. */
export function findReplan(journey: Journey, point: ReplanPoint, alternatives: Journey[], minTransferMin: number): Replan | undefined {
  const remaining = journey.legs.slice(point.keep)
  const current = arrivalMs(journey)
  const broken = brokenReason(journey, point.keep)
  // At an interchange the user still needs time to reach the next platform; the planner's own walk legs cover the rest.
  const earliest = point.readyAt + (point.keep > 0 ? minTransferMin * 60_000 : -30_000)
  const sameRoute = routeKey(remaining)

  let best: { route: Journey; arrival: number; leaves: number } | undefined
  for (const route of alternatives) {
    const firstRide = route.legs.find(isTransit)
    if (!firstRide || depMs(firstRide) < earliest) continue
    if (route.legs.some(isCancelled) || !transferFits(route, minTransferMin)) continue
    if (routeKey(route.legs) === sameRoute) continue
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
    journey: { ...journey, legs: [...journey.legs.slice(0, point.keep), ...best.route.legs] },
    arrival: best.arrival,
    savedMs,
  }
}

/** The trip as it should be stored after switching to a replan. */
export function applyReplan(trip: CurrentTrip, replan: Replan): CurrentTrip {
  const { keep } = replan.point
  if (keep === 0) return { ...trip, journey: replan.route, anchors: undefined }
  const anchors = (trip.anchors ?? []).filter((a) => a.keep < keep)
  const when = segmentStart(replan.route.legs) ?? new Date(replan.point.readyAt).toISOString()
  return { ...trip, journey: replan.journey, anchors: [...anchors, { keep, fromId: replan.point.stopId, when }] }
}
