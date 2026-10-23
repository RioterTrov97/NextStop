import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { VehicleMode } from '../../shared/vehicles'
import { fetchAlerts, fetchDepartures, fetchTrips, fetchVehicles, searchStops, type TripQuery } from './client'

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
