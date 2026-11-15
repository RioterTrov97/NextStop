import type { Place } from '../api/types'

/**
 * What a place is, for icons, grouping and labels. The stop finder answers with stations, bus and light rail stops,
 * street addresses ("singlehouse"), whole streets and points of interest; the trip planner takes any of their ids.
 */
export type PlaceKind = 'station' | 'stop' | 'address' | 'place'

const RAIL = [1, 2]

export function placeKind(p: Pick<Place, 'type' | 'modes'>): PlaceKind {
  if ((p.type === 'stop' || p.type === 'platform' || !p.type) && p.modes?.some((m) => RAIL.includes(m))) return 'station'
  if (p.type === 'stop' || p.type === 'platform') return 'stop'
  if (p.type === 'singlehouse' || p.type === 'street' || p.type === 'address') return 'address'
  return 'place'
}

/** Kinds the trip planner can start or end at. Suburbs and regions are too vague to plan to. */
const PLANNABLE = new Set(['stop', 'platform', 'poi', 'singlehouse', 'street', 'address'])
export const isPlannable = (p: Pick<Place, 'type'>) => !p.type || PLANNABLE.has(p.type)

// Within the same match quality: stops first (people mostly want transport), then exact addresses, places, and
// whole streets last, since a street can be kilometres long.
const ORDER: Record<string, number> = { stop: 0, platform: 0, singlehouse: 1, address: 1, poi: 2, street: 3 }

/**
 * Stop finder results, best first: train and metro stations, then by the finder's own match quality, which its list
 * order ignores (pubs in Armidale ahead of Central Station for "central"), then by kind.
 */
export function rankPlaces(places: Place[]): Place[] {
  return places
    .filter(isPlannable)
    .map((p, i) => ({ p, i, rail: placeKind(p) === 'station' ? 0 : 1 }))
    .sort(
      (a, b) =>
        a.rail - b.rail ||
        (b.p.matchQuality ?? 0) - (a.p.matchQuality ?? 0) ||
        (ORDER[a.p.type ?? ''] ?? 2) - (ORDER[b.p.type ?? ''] ?? 2) ||
        a.i - b.i,
    )
    .map((x) => x.p)
}

/** The short form of a name for headers and cards: "72 Joseph St" from "72 Joseph St, Lidcombe". */
export const shortPlaceName = (name: string) => name.split(',')[0].trim()
