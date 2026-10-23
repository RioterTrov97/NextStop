import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { VehicleInfo, VehicleMode } from '../../shared/vehicles'
import { vehicleModeForLeg } from '../lib/journey'
import { fetchAlerts, fetchDepartures, fetchTrips, fetchVehicles, searchStops, type TripQuery } from './client'
import type { Journey } from './types'

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function useStopSearch(text: string) {
  const q = useDebounced(text.trim())
  return useQuery({
    queryKey: ['stops', q],
    queryFn: ({ signal }) => searchStops(q, signal),
    enabled: q.length >= 2,
    staleTime: 24 * 3600_000,
    placeholderData: keepPreviousData,
  })
}

export function useTrips(q: TripQuery, enabled = true) {
  return useQuery({
    queryKey: ['trips', q.from, q.to, q.mode, q.when?.getTime() ?? 'now', q.count ?? 6, q.excluded],
    queryFn: ({ signal }) => fetchTrips(q, signal),
    enabled,
    refetchInterval: 30_000,
  })
}

export function useDepartures(stopId: string) {
  return useQuery({
    queryKey: ['departures', stopId],
    queryFn: ({ signal }) => fetchDepartures(stopId, signal),
    refetchInterval: 20_000,
  })
}

export function useAlerts() {
  return useQuery({ queryKey: ['alerts'], queryFn: ({ signal }) => fetchAlerts(signal), refetchInterval: 120_000, staleTime: 60_000 })
}

export function useVehicles(mode: VehicleMode | undefined, trips: string[], enabled = true) {
  return useQuery({
    queryKey: ['vehicles', mode, trips],
    queryFn: ({ signal }) => fetchVehicles(mode!, trips, signal),
    enabled: enabled && !!mode && trips.length > 0,
    refetchInterval: 15_000,
    // Live positions are worthless once stale, so never persist them.
    meta: { persist: false },
  })
}

// One whole-feed query per rail mode, shared by every list, card and sheet; callers pick their trips via `select`.
function useRailVehicles(mode: 'train' | 'metro', trips: string[]) {
  const wanted = new Set(trips)
  return useQuery({
    queryKey: ['vehicles', mode],
    queryFn: ({ signal }) => fetchVehicles(mode, [], signal),
    enabled: trips.length > 0,
    staleTime: 15_000,
    refetchInterval: 30_000,
    select: (all) => all.filter((v) => wanted.has(v.tripId)),
    meta: { persist: false },
  })
}

/** One batched request per rail mode for every trip in the list, instead of one per leg. */
export function useJourneyVehicles(journeys: Journey[]) {
  const ids = { train: new Set<string>(), metro: new Set<string>(), bus: new Set<string>(), lightrail: new Set<string>() }
  for (const j of journeys) {
    for (const l of j.legs) {
      const mode = vehicleModeForLeg(l)
      const id = l.transportation?.properties?.RealtimeTripId
      if (mode && mode in ids && id) ids[mode as keyof typeof ids].add(id)
    }
  }
  const train = useRailVehicles('train', [...ids.train].sort())
  const metro = useRailVehicles('metro', [...ids.metro].sort())
  const bus = useVehicles('bus', [...ids.bus].sort())
  const lightrail = useVehicles('lightrail', [...ids.lightrail].sort())
  const vehicles = new Map<string, VehicleInfo>()
  for (const v of [...(train.data ?? []), ...(metro.data ?? []), ...(bus.data ?? []), ...(lightrail.data ?? [])]) vehicles.set(v.tripId, v)
  return { vehicles, isLoading: train.isLoading || metro.isLoading || bus.isLoading || lightrail.isLoading }
}
