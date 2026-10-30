import type { VehicleInfo, VehicleMode } from '../../shared/vehicles'
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

export async function searchStops(query: string, signal?: AbortSignal): Promise<Place[]> {
  const data = await get<{ locations?: Place[] }>(
    'tp/stop_finder',
    { type_sf: 'any', name_sf: query, TfNSWSF: 'true', anyObjFilter_sf: '2' },
    signal,
  )
  const places = (data.locations ?? []).filter((l) => l.type === 'stop' || l.type === 'platform' || l.type === 'poi' || !l.type)
  // Train/metro stations first, then by the finder's own match quality: its list order puts pubs in Armidale
  // ahead of Central Station for "central".
  return places
    .map((p, i) => ({ p, i, rank: p.modes?.some((m) => m === 1 || m === 2) ? 0 : 1 }))
    .sort((a, b) => a.rank - b.rank || (b.p.matchQuality ?? 0) - (a.p.matchQuality ?? 0) || a.i - b.i)
    .map((x) => x.p)
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

// Stop IDs from the stop finder.
const REDFERN = '201510'
const CENTRAL = '200060'
const TOWN_HALL = '200070'
const WYNYARD = '200080'
// const STRATHFIELD = '213510'
// const PARRAMATTA = '215020'

// Interchanges where rail, metro and light rail meet.
const VIA_HUBS = [CENTRAL, TOWN_HALL, REDFERN, WYNYARD]

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

const durationMs = (j: Journey) => {
  const first = j.legs[0].origin
  const last = j.legs[j.legs.length - 1].destination
  return Date.parse(last.arrivalTimePlanned ?? '') - Date.parse(first.departureTimePlanned ?? '')
}

function planTrip(q: TripQuery, extra: Record<string, string>, signal?: AbortSignal) {
  return tripSlot(signal).then(() =>
    get<{ journeys?: Journey[] }>(
      'tp/trip',
      {
        depArrMacro: q.mode,
        ...toItd(q.when ?? new Date()),
        type_origin: 'any',
        name_origin: q.from,
        type_destination: 'any',
        name_destination: q.to,
        calcNumberOfTrips: String(q.count ?? 6),
        TfNSWTR: 'true',
        changeSpeed: q.walkPace ?? 'normal',
        ...q.excluded,
        ...extra,
      },
      signal,
    ).then((d) => d.journeys ?? []),
  )
}

/** The planner's own preferred routes: one request, so the list can show as soon as it lands. */
export const fetchTripsDirect = (q: TripQuery, signal?: AbortSignal) => planTrip(q, {}, signal)

export const viaHubsFor = (q: Pick<TripQuery, 'from' | 'to'>) => VIA_HUBS.filter((id) => id !== q.from && id !== q.to)

/**
 * The planner only returns its preferred routes; forcing a via-stop at the major interchanges surfaces the other
 * rail, metro and light rail combinations. Slower, so it fills in after the direct results.
 */
export async function fetchTripsVia(q: TripQuery, signal?: AbortSignal): Promise<Journey[]> {
  const viaHub = (id: string) => planTrip(q, { type_via: 'any', name_via: id, maxChanges: '4' }, signal).catch(() => [] as Journey[])
  return (await Promise.all(viaHubsFor(q).map(viaHub))).flat()
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

export async function fetchTrips(q: TripQuery, signal?: AbortSignal): Promise<Journey[]> {
  const [direct, via] = await Promise.all([fetchTripsDirect(q, signal), fetchTripsVia(q, signal)])
  return mergeTrips(direct, via)
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
