import type { VehicleInfo, VehicleMode } from '../../shared/vehicles'
import { isAddressId, loadNetwork, searchPlan } from '../lib/hubs'
import { isPlannable, rankPlaces } from '../lib/places'
import { resolvePlaceId } from '../store/places'
import type { HubOption } from '../lib/network'
import { summarize, walksAtPace } from '../lib/journey'
import { stitchAtHub } from '../lib/split'
import { toAddInfoDate, toItd } from '../lib/time'
import type { Alert, Journey, Place, StopEvent } from './types'

// Manual refresh asks the proxy to skip its edge cache for a few seconds.
let freshUntil = 0
export const requestFresh = () => {
  freshUntil = Date.now() + 3000
}

async function get<T>(path: string, params: Record<string, string | undefined>, signal?: AbortSignal): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, v)
  if (Date.now() < freshUntil) qs.set('fresh', '1')
  const res = await fetch(`/api/${path}?${qs}`, { signal })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

/**
 * Stops, addresses and places matching the text. The finder ignores its type filter (`anyObjFilter_sf`) and always
 * answers with everything, so the ranking and filtering happen here.
 */
export async function searchStops(query: string, signal?: AbortSignal): Promise<Place[]> {
  const data = await get<{ locations?: Place[] }>('tp/stop_finder', { type_sf: 'any', name_sf: query, TfNSWSF: 'true' }, signal)
  return rankPlaces(data.locations ?? [])
}

/**
 * The street address at a position, for "Current location": the planner takes its id like any other place, and a
 * saved trip or history entry then names a real address instead of a position that means nothing later.
 * Positions are rounded to about a metre.
 */
export async function addressAt(lat: number, lon: number, signal?: AbortSignal): Promise<Place | undefined> {
  const at = (n: number) => n.toFixed(5)
  const data = await get<{ locations?: Place[] }>(
    'tp/stop_finder',
    { type_sf: 'coord', name_sf: `${at(lon)}:${at(lat)}:EPSG:4326`, TfNSWSF: 'true' },
    signal,
  )
  return data.locations?.find(isPlannable)
}

export interface TripQuery {
  from: string
  to: string
  mode: 'dep' | 'arr'
  when?: Date
  excluded: Record<string, string>
  count?: number
  walkPace?: 'fast' | 'normal' | 'slow'
}

const journeyKey = (j: Journey) =>
  j.legs
    .map(
      (l) =>
        `${l.origin.id ?? l.origin.name}@${l.origin.departureTimePlanned}>${l.destination.id ?? l.destination.name}@${l.destination.arrivalTimePlanned}`,
    )
    .join('|')

const REQUEST_SPACING_MS = 250

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(signal.reason)
    })
  })

// One queue for every trip request on the page, so a followed trip, its replan search and the saved trips together
// still stay under the upstream 5 req/s limit instead of each spacing only its own requests.
let nextSlot = 0
async function tripSlot(signal?: AbortSignal) {
  const now = Date.now()
  const at = Math.max(now, nextSlot)
  nextSlot = at + REQUEST_SPACING_MS
  if (at > now) await delay(at - now, signal)
}

/** Door-to-door time. Walk legs can lack times, so this goes through the same summary the list shows. */
const durationMs = (j: Journey) => summarize(j).durationSec * 1000

function planTrip(q: TripQuery, extra: Record<string, string>, signal?: AbortSignal) {
  return tripSlot(signal).then(() =>
    get<{ journeys?: Journey[] }>(
      'tp/trip',
      {
        depArrMacro: q.mode,
        ...toItd(q.when ?? new Date()),
        type_origin: 'any',
        name_origin: resolvePlaceId(q.from),
        type_destination: 'any',
        name_destination: resolvePlaceId(q.to),
        calcNumberOfTrips: String(q.count ?? 6),
        TfNSWTR: 'true',
        changeSpeed: q.walkPace ?? 'normal',
        // On-demand vans (Bridj) need booking ahead, which the app can't help with, so they never appear as a ride.
        excludedMeans: 'checkbox',
        exclMOT_10: '10',
        ...q.excluded,
        ...extra,
      },
      signal,
    ).then((d) => d.journeys ?? []),
  )
}

/** The planner's own preferred routes: one request, so the list can show as soon as it lands. */
export const fetchTripsDirect = (q: TripQuery, signal?: AbortSignal) => planTrip(q, {}, signal)

/** The earliest (or, arriving by, latest) of a list of times. */
const edge = (times: number[], latest: boolean) => {
  const ok = times.filter(Number.isFinite)
  return ok.length ? (latest ? Math.max(...ok) : Math.min(...ok)) : undefined
}

const rideTime = (j: Journey, end: 'dep' | 'arr') => {
  const s = summarize(j)
  return Date.parse((end === 'dep' ? (s.depEstimated ?? s.depPlanned) : (s.arrEstimated ?? s.arrPlanned)) ?? '')
}

/**
 * The trip split at an interchange: trips to the hub and trips on from it, searched separately and stitched together.
 * The planner never offers a change it can avoid, even when a faster train to the hub and a change there arrive
 * sooner (Lidcombe to Wynyard: T2 or T3 to Strathfield, then an express). The second search starts from the first
 * one's earliest arrival (or, arriving by, ends at the first one's latest departure). The side with fewer trains asks
 * for fewer, so both searches cover about the same stretch of time and every trip found has its connection.
 */
export async function fetchTripsSplit(q: TripQuery, hub: HubOption, minTransferMin: number, signal?: AbortSignal): Promise<Journey[]> {
  const change = minTransferMin * 60_000
  const count = q.count ?? 6
  const fewer = (mine: number, theirs: number) => Math.max(2, Math.min(count, Math.round((count * mine) / Math.max(theirs, 1))))
  if (q.mode === 'arr') {
    const onward = await planTrip({ ...q, from: hub.id, count: fewer(hub.onwardPerHour, hub.perHour) }, {}, signal)
    const latest = edge(
      onward.map((j) => rideTime(j, 'dep')),
      true,
    )
    if (latest === undefined) return []
    const toHub = await planTrip({ ...q, to: hub.id, when: new Date(latest - change) }, {}, signal)
    return stitchAtHub(toHub, onward, minTransferMin * 60)
  }
  const toHub = await planTrip({ ...q, to: hub.id, count: fewer(hub.perHour, hub.onwardPerHour) }, {}, signal)
  const earliest = edge(
    toHub.map((j) => rideTime(j, 'arr')),
    false,
  )
  if (earliest === undefined) return []
  const onward = await planTrip({ ...q, from: hub.id, mode: 'dep', when: new Date(earliest + change) }, {}, signal)
  return stitchAtHub(toHub, onward, minTransferMin * 60)
}

/**
 * The alternatives the planner doesn't offer on its own (see src/lib/hubs.ts for how they are chosen): the trip split
 * at the interchanges where changing could pay off, or, for ends outside the rail network, routes via the city hubs.
 * Slower, so they fill in after the direct results. Each search fails on its own without losing the others, and a
 * trip with nothing worth searching costs no requests at all.
 */
export async function fetchTripsVia(
  q: TripQuery,
  minTransferMin: number,
  signal?: AbortSignal,
  /** For address ends: the stations the direct answer boards and leaves at (`railEnds`). */
  ends?: { from?: string; to?: string },
): Promise<Journey[]> {
  const plan = searchPlan(await loadNetwork(), { ...q, from: resolvePlaceId(q.from), to: resolvePlaceId(q.to) }, minTransferMin, ends)
  const viaHub = (id: string) => planTrip(q, { type_via: 'any', name_via: id, maxChanges: '4' }, signal).catch(() => [] as Journey[])
  const split = (hub: HubOption) => fetchTripsSplit(q, hub, minTransferMin, signal).catch(() => [] as Journey[])
  // From or to an address, the planner leaves out stops it thinks too far to walk to at the user's pace, and its normal
  // pace is slow (1.84km took it about 28 min): from 120A Bombay St, Lidcombe it offered only buses, never the train
  // from Lidcombe Station 18 minutes away. Asking at the fast pace finds those; the walks are then stretched back to the
  // user's pace, so the walk limits and change checks still hold.
  const pace = q.walkPace ?? 'normal'
  const wider =
    pace !== 'fast' && (isAddressId(resolvePlaceId(q.from)) || isAddressId(resolvePlaceId(q.to)))
      ? [
          planTrip({ ...q, walkPace: 'fast' }, {}, signal).then(
            (js) => js.map((j) => walksAtPace(j, pace)),
            () => [] as Journey[],
          ),
        ]
      : []
  return (await Promise.all([...plan.split.map(split), ...plan.via.map(viaHub), ...wider])).flat()
}

/** Direct results plus via-hub results that aren't much slower than the best direct one, without duplicates. */
export function mergeTrips(direct: Journey[], via: Journey[]): Journey[] {
  const best = Math.min(...direct.map(durationMs).filter(Number.isFinite), Infinity)
  const viaKeep = (j: Journey) => durationMs(j) <= best * 1.4 + 10 * 60_000
  const seen = new Set<string>()
  return [...direct, ...via.filter(viaKeep)].filter((j) => {
    const k = journeyKey(j)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export async function fetchDepartures(stopId: string, signal?: AbortSignal): Promise<StopEvent[]> {
  const data = await get<{ stopEvents?: StopEvent[] }>(
    'tp/departure_mon',
    { mode: 'direct', type_dm: 'stop', name_dm: stopId, ...toItd(new Date()), departureMonitorMacro: 'true', TfNSWDM: 'true' },
    signal,
  )
  return data.stopEvents ?? []
}

/** Alerts in force on a day: today by default, or e.g. the coming Saturday for weekend trackwork. */
export async function fetchAlerts(signal?: AbortSignal, day: Date = new Date()): Promise<Alert[]> {
  const data = await get<{ infos?: { current?: Alert[] } | Alert[] }>(
    'tp/add_info',
    { filterDateValid: toAddInfoDate(day), filterPublicationStatus: 'current' },
    signal,
  )
  const infos = data.infos
  return Array.isArray(infos) ? infos : (infos?.current ?? [])
}

export async function fetchVehicles(mode: VehicleMode, trips: string[], signal?: AbortSignal): Promise<VehicleInfo[]> {
  const data = await get<{ vehicles: VehicleInfo[] }>('vehicles', { mode, trips: trips.join(',') }, signal)
  return data.vehicles
}
