import type { Journey, Leg } from '../api/types'
import { isTransit, summarize } from './journey'

const ms = (iso?: string) => (iso ? Date.parse(iso) : NaN)
const tripIdOf = (l?: Leg) => l?.transportation?.properties?.RealtimeTripId

/** At most this many changes in a stitched journey; beyond that nobody would pick it over the planner's answer. */
export const MAX_STITCHED_CHANGES = 3

/** When a journey reaches its end, live time first; walks after the last ride count. */
function arrives(j: Journey): number {
  const s = summarize(j)
  return ms(s.arrEstimated ?? s.arrPlanned)
}

/** When its first ride leaves, live time first. */
function leaves(j: Journey): number {
  const first = j.legs.find(isTransit)
  return ms(first?.origin.departureTimeEstimated ?? first?.origin.departureTimePlanned)
}

/**
 * Joins trips to an interchange with trips on from it: each way of getting there is paired with the onward trip that
 * arrives first among those leaving at least `minChangeSec` after it gets in (equal arrivals take the later departure,
 * for a roomier change). Pairs where the onward ride is the same train are skipped: staying on board is the planner's
 * own direct answer. Arrivals later than the last known onward departure are skipped too, since a better connection
 * may exist beyond what was fetched.
 */
export function stitchAtHub(toHub: Journey[], fromHub: Journey[], minChangeSec: number): Journey[] {
  const onward = fromHub
    .map((j) => ({ j, dep: leaves(j), arr: arrives(j), firstRide: j.legs.find(isTransit) }))
    .filter((o) => Number.isFinite(o.dep) && Number.isFinite(o.arr) && o.firstRide)
  if (!onward.length) return []
  const lastDep = Math.max(...onward.map((o) => o.dep))
  const out: Journey[] = []
  for (const first of toHub) {
    const rides = first.legs.filter(isTransit)
    const there = arrives(first)
    if (!rides.length || !Number.isFinite(there)) continue
    const ready = there + minChangeSec * 1000
    if (ready > lastDep) continue
    const lastRide = rides[rides.length - 1]
    let best: (typeof onward)[number] | undefined
    for (const o of onward) {
      if (o.dep < ready) continue
      const sameTrain = !!tripIdOf(lastRide) && tripIdOf(lastRide) === tripIdOf(o.firstRide)
      if (sameTrain) continue
      if (!best || o.arr < best.arr || (o.arr === best.arr && o.dep > best.dep)) best = o
    }
    if (!best) continue
    const changes = rides.length + best.j.legs.filter(isTransit).length - 1
    if (changes > MAX_STITCHED_CHANGES) continue
    out.push({ legs: [...first.legs, ...best.j.legs] })
  }
  return out
}
