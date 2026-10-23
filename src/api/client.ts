import type { VehicleInfo, VehicleMode } from '../../shared/vehicles'
import { toAddInfoDate, toItd } from '../lib/time'
import type { Alert, Journey, Place, StopEvent } from './types'

async function get<T>(path: string, params: Record<string, string | undefined>, signal?: AbortSignal): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, v)
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
  return (data.locations ?? []).filter((l) => l.type === 'stop' || l.type === 'platform' || l.type === 'poi' || !l.type)
}

export interface TripQuery {
  from: string
  to: string
  mode: 'dep' | 'arr'
  when?: Date
  excluded: Record<string, string>
  count?: number
}

export async function fetchTrips(q: TripQuery, signal?: AbortSignal): Promise<Journey[]> {
  const itd = toItd(q.when ?? new Date())
  const data = await get<{ journeys?: Journey[] }>(
    'tp/trip',
    {
      depArrMacro: q.mode,
      ...itd,
      type_origin: 'any',
      name_origin: q.from,
      type_destination: 'any',
      name_destination: q.to,
      calcNumberOfTrips: String(q.count ?? 6),
      TfNSWTR: 'true',
      ...q.excluded,
    },
    signal,
  )
  return data.journeys ?? []
}

export async function fetchDepartures(stopId: string, signal?: AbortSignal): Promise<StopEvent[]> {
  const data = await get<{ stopEvents?: StopEvent[] }>(
    'tp/departure_mon',
    { mode: 'direct', type_dm: 'stop', name_dm: stopId, ...toItd(new Date()), departureMonitorMacro: 'true', TfNSWDM: 'true' },
    signal,
  )
  return data.stopEvents ?? []
}

export async function fetchAlerts(signal?: AbortSignal): Promise<Alert[]> {
  const data = await get<{ infos?: { current?: Alert[] } | Alert[] }>(
    'tp/add_info',
    { filterDateValid: toAddInfoDate(new Date()), filterPublicationStatus: 'current' },
    signal,
  )
  const infos = data.infos
  return Array.isArray(infos) ? infos : (infos?.current ?? [])
}

export async function fetchVehicles(mode: VehicleMode, trips: string[], signal?: AbortSignal): Promise<VehicleInfo[]> {
  const data = await get<{ vehicles: VehicleInfo[] }>('vehicles', { mode, trips: trips.join(',') }, signal)
  return data.vehicles
}
