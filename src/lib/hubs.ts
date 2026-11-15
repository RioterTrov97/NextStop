import type { TripQuery } from '../api/client'
import type { Journey, StopPoint } from '../api/types'
import { bandAt } from './bands'
import { changePlan, type HubOption, type NetworkData } from './network'

/**
 * Which extra searches a trip gets besides the planner's own answer, chosen so no API call is wasted.
 *
 * Between two train or metro stations, the bundled timetable model (`changePlan` in ./network) names the interchanges
 * where changing could beat or rival staying on, at this time of day, and each is searched as two trips stitched
 * together (`fetchTripsSplit`). Lidcombe to Wynyard gets Strathfield, where expresses and the T9 join; Parramatta to
 * Penrith gets nothing, as no change helps.
 *
 * From or to an address, the planner's own answer shows which station the trip boards and leaves the rail network at
 * (`railEnds`); the model then plans between those, and the split searches still start and end at the address. When
 * an end is a bus stop the model can't say, so the trip is routed via the city hubs as before.
 */

/** City interchanges, searched with the planner's via option only when an end is outside the rail network. */
export const CITY_HUBS = ['200060', '200070', '201510', '200080'] // Central, Town Hall, Redfern, Wynyard

let network: Promise<NetworkData> | undefined
/** The rail network model, loaded once on first use (about 15KB compressed). */
export const loadNetwork = () =>
  (network ??= import('../data/network.json')
    .then((m) => m.default as unknown as NetworkData)
    .catch((e: unknown) => {
      network = undefined
      throw e
    }))

export interface SearchPlan {
  /** Interchanges to split the trip at. */
  split: HubOption[]
  /** Hubs to route via with the planner's own via option. */
  via: string[]
}

const excludes = (q: Pick<TripQuery, 'excluded'>, cls: number) => `exclMOT_${cls}` in q.excluded

/** Whether an id is a place rather than a stop: an address, a landmark or a position (stop ids have no colon). */
export const isAddressId = (id: string) => id.includes(':')

/** The station a point belongs to: the parent of a platform, or the point itself. */
const stationOf = (p: StopPoint) => (p.parent?.type === 'stop' && p.parent.id ? p.parent.id : p.id)

/** The most common of the values, first seen winning ties. */
function mostCommon(values: (string | undefined)[]): string | undefined {
  const n = new Map<string, number>()
  for (const v of values) if (v) n.set(v, (n.get(v) ?? 0) + 1)
  return [...n.entries()].reduce<[string, number] | undefined>((best, e) => (!best || e[1] > best[1] ? e : best), undefined)?.[0]
}

/** Where the planner's trips usually board their first ride and leave their last, for trips from or to an address. */
export function railEnds(journeys: Journey[]): { from?: string; to?: string } {
  const rides = journeys.map((j) => j.legs.filter((l) => (l.transportation?.product?.class ?? 99) < 99)).filter((r) => r.length)
  return {
    from: mostCommon(rides.map((r) => stationOf(r[0].origin))),
    to: mostCommon(rides.map((r) => stationOf(r[r.length - 1].destination))),
  }
}

export function searchPlan(
  data: NetworkData,
  q: Pick<TripQuery, 'from' | 'to' | 'when' | 'excluded'>,
  minTransferMin: number,
  /** Boarding and alighting stations from the direct answer, standing in for address ends. */
  ends: { from?: string; to?: string } = {},
): SearchPlan {
  const modes = [1, 2].filter((c) => !excludes(q, c))
  const address = isAddressId(q.from) || isAddressId(q.to)
  const from = isAddressId(q.from) ? ends.from : q.from
  const to = isAddressId(q.to) ? ends.to : q.to
  const plan =
    modes.length && from && to
      ? changePlan(data, from, to, { band: bandAt(q.when ?? new Date()), changeMin: minTransferMin + 1, modes })
      : undefined
  if (plan) return { split: plan.hubs, via: [] }
  // From an address, a trip the model can't place is a bus or a walk; four city searches would rarely help it.
  if (address) return { split: [], via: [] }
  // Outside the network (or with trains and metro off): the old way, unless every rail mode is off too.
  const known = data.stations.includes(q.from) && data.stations.includes(q.to)
  const via = known || [1, 2, 4].every((c) => excludes(q, c)) ? [] : CITY_HUBS.filter((id) => id !== q.from && id !== q.to)
  return { split: [], via }
}
