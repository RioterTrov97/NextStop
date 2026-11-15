import { useSettings } from '../store/settings'
import { isAddressId, railEnds } from '../lib/hubs'
import { resolvePlaceId, useSavedPlaces, type SavedPlaces } from '../store/places'
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import type { VehicleInfo, VehicleMode } from '../../shared/vehicles'
import { departureLeg } from '../lib/departure'
import { isTransit, legOccupancy, vehicleModeForLeg } from '../lib/journey'
import { stationIdOf, stopAhead, tripIdOf, withRideAhead } from '../lib/ride'
import { useNow } from '../lib/hooks'
import { exclusionParams, modeForClass } from '../lib/lines'
import {
  fetchAlerts,
  fetchDepartures,
  fetchTripsDirect,
  fetchTripsVia,
  fetchVehicles,
  mergeTrips,
  searchStops,
  type TripQuery,
} from './client'
import type { Journey, StopEvent } from './types'

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

// Live queries have no timer of their own: useRealtimeScheduler refetches them all together every REALTIME_MS.
// Measured against TfNSW: train delays (which drive the trip planner's estimates) update every 15s, so polling trips
// faster only re-reads the same data. Vehicle positions and loads update every 10s (metro every 6s), so they refresh
// on their own shorter cycle in between.
export const REALTIME_MS = 15_000
export const VEHICLES_MS = 10_000
/**
 * The extra via and split-at-interchange searches only add alternative routes, which rarely change, so the shared timer
 * refreshes them once a minute instead of every 15s (the API key allows 5 requests/second for everyone).
 */
export const VIA_MS = 60_000
const REALTIME_KEYS = new Set(['trips', 'departures', 'vehicles'])
export const isRealtimeKey = (key: readonly unknown[]) => REALTIME_KEYS.has(key[0] as string)
/** Trips and departures: the data the 15s countdown tracks. Vehicles refresh on their own shorter cycle. */
export const isTimetableKey = (key: readonly unknown[]) => isRealtimeKey(key) && key[0] !== 'vehicles'

type TripPart = 'direct' | 'via'

/** The address behind "home" or "work", so changing it refetches; unset places keep their id and fail in the planner. */
function resolved(id: string, places: SavedPlaces): string {
  try {
    return resolvePlaceId(id, places)
  } catch {
    return id
  }
}

interface TripSettings {
  walkPace: TripQuery['walkPace']
  minTransfer: number
  places: SavedPlaces
}

/** Whether the extra searches need the direct answer first: an address end is planned from where its trips board. */
const needsDirect = (q: TripQuery, places: SavedPlaces) => isAddressId(resolved(q.from, places)) || isAddressId(resolved(q.to, places))

interface TripsQueryOptions {
  /** The stations an address end's trips board and leave at, for the extra searches. */
  ends?: { from?: string; to?: string }
  /** A static historical snapshot: left out of the realtime refresh cycle and the refresh-button spinner. */
  past?: boolean
}

function tripsQuery(
  query: TripQuery,
  settings: TripSettings,
  part: TripPart,
  enabled = true,
  { ends, past = false }: TripsQueryOptions = {},
) {
  const { walkPace, minTransfer, places } = settings
  const q = { ...query, walkPace }
  // Split trips are stitched with the user's minimum change time, so only the 'via' part depends on it. The part stays
  // at index 8: the cache persister reads it there.
  const extra = part === 'via' ? [minTransfer, ends?.from ?? '', ends?.to ?? ''] : []
  return {
    queryKey: [
      'trips',
      q.from,
      q.to,
      q.mode,
      q.when?.getTime() ?? 'now',
      q.count ?? 6,
      q.excluded,
      walkPace,
      part,
      resolved(q.from, places),
      resolved(q.to, places),
      ...extra,
    ] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      part === 'direct' ? fetchTripsDirect(q, signal) : fetchTripsVia(q, minTransfer, signal, ends),
    enabled,
    staleTime: part === 'via' ? VIA_MS : REALTIME_MS,
    ...(past && { meta: { past: true } }),
  }
}

interface TripsOptions {
  /** Keep showing the last results while the search moves to a new time, e.g. a replan search that follows the clock. */
  keepPrevious?: boolean
  /** Only the planner's own answer, without the via-hub alternatives: enough to look up one known service. */
  directOnly?: boolean
}

/**
 * A trip search in two parts: the planner's direct answer shows as soon as it lands, and the slower via-hub and
 * split-at-interchange alternatives merge in when they arrive, so the list never waits on them.
 */
export function useTrips(query: TripQuery, enabled = true, { keepPrevious = false, directOnly = false }: TripsOptions = {}) {
  const { walkPace, minTransfer } = useSettings()
  const places = useSavedPlaces()
  const settings = { walkPace, minTransfer, places }
  // Growing the list keeps the current trips on screen instead of dropping back to skeletons.
  const placeholderData = <T>(prev: T | undefined, prevQuery?: { queryKey: readonly unknown[] }) => {
    const k = prevQuery?.queryKey
    if (!k || k[1] !== query.from || k[2] !== query.to || k[3] !== query.mode) return undefined
    return keepPrevious || k[4] === (query.when?.getTime() ?? 'now') ? prev : undefined
  }
  const direct = useQuery({ ...tripsQuery(query, settings, 'direct', enabled), placeholderData })
  // From an address, the extra searches start from the station the direct trips board at, so they wait for those.
  const addressEnd = needsDirect(query, places)
  const ends = useMemo(() => (addressEnd && direct.data ? railEnds(direct.data) : undefined), [addressEnd, direct.data])
  const via = useQuery({
    ...tripsQuery(query, settings, 'via', enabled && !directOnly && (!addressEnd || !!ends), { ends }),
    placeholderData,
  })
  const data = useMemo(() => direct.data && mergeTrips(direct.data, via.data ?? []), [direct.data, via.data])
  return {
    data,
    error: direct.error,
    isLoading: direct.isLoading,
    isFetching: direct.isFetching || via.isFetching,
    /** The via-hub alternatives are still on their way for this search. */
    isLoadingMore: !!direct.data && via.isFetching && (via.isPlaceholderData || !via.data),
    isPlaceholderData: direct.isPlaceholderData,
    dataUpdatedAt: direct.dataUpdatedAt,
    fetchStatus: direct.fetchStatus,
    refetch: () => Promise.all([direct.refetch(), via.refetch()]),
  }
}

/** Several trip searches at once, flattened: used to keep every segment of a followed trip live. */
export function useTripsMany(queries: TripQuery[], directOnly = false, past = false) {
  const { walkPace, minTransfer } = useSettings()
  const places = useSavedPlaces()
  const settings = { walkPace, minTransfer, places }
  // Segments of a followed trip run between stations; an address end only gets the planner's own answer here.
  return useQueries({
    queries: queries.flatMap((q) =>
      (['direct', 'via'] as const)
        .filter((part) => part === 'direct' || (!directOnly && !needsDirect(q, places)))
        .map((part) => ({ ...tripsQuery(q, settings, part, true, { past }), placeholderData: keepPreviousData })),
    ),
    combine: combineTrips,
  })
}

/**
 * The planner stops forecasting a service's load once it has left its first stop, so a running train shows "No data".
 * Planning from a stop it has yet to reach still returns the service with its forecast and live times: look that up
 * (one call per running ride, up to `max`) and fill them in.
 */
export function useRunningForecasts(journeys: Journey[], max = 4): Journey[] {
  const now = useNow(60_000)
  const wanted = useMemo(() => {
    const out: { from: string; to: string; when: number }[] = []
    for (const j of journeys) {
      for (const l of j.legs) {
        if (out.length >= max || !isTransit(l) || !tripIdOf(l) || legOccupancy(l)) continue
        const dep = Date.parse(l.origin.departureTimeEstimated ?? l.origin.departureTimePlanned ?? '')
        const arr = Date.parse(l.destination.arrivalTimeEstimated ?? l.destination.arrivalTimePlanned ?? '')
        if (!(dep <= now) || !(arr > now)) continue
        const ahead = stopAhead(l, now)
        // A little before the train gets there, so the lookup still includes it.
        if (ahead)
          out.push({ from: ahead.stationId, to: stationIdOf(l.destination), when: Math.floor((ahead.at - 60_000) / 60_000) * 60_000 })
      }
    }
    return out
  }, [journeys, now, max])
  const { journeys: found } = useTripsMany(
    wanted.map((w) => ({ from: w.from, to: w.to, mode: 'dep' as const, when: new Date(w.when), excluded: {}, count: 4 })),
    true,
  )
  return useMemo(() => (found.length ? journeys.map((j) => withRideAhead(j, found)) : journeys), [journeys, found])
}

// Module-level so React Query can reuse the combined result between renders while the data is unchanged.
const combineTrips = (results: { data?: Journey[]; isFetching: boolean }[]) => ({
  journeys: results.flatMap((r) => r.data ?? []),
  isFetching: results.some((r) => r.isFetching),
})

export function useDepartures(stopId: string, enabled = true) {
  return useQuery({
    queryKey: ['departures', stopId],
    queryFn: ({ signal }) => fetchDepartures(stopId, signal),
    enabled: enabled && !!stopId,
    staleTime: REALTIME_MS,
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
    staleTime: REALTIME_MS,
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
    staleTime: REALTIME_MS,
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
  // Stable while the data is unchanged, so the cards and sheet that receive it don't re-render on every clock tick.
  const vehicles = useMemo(() => {
    const map = new Map<string, VehicleInfo>()
    for (const v of [...(train.data ?? []), ...(metro.data ?? []), ...(bus.data ?? []), ...(lightrail.data ?? [])]) map.set(v.tripId, v)
    return map
  }, [train.data, metro.data, bus.data, lightrail.data])
  return { vehicles, isLoading: train.isLoading || metro.isLoading || bus.isLoading || lightrail.isLoading }
}

/**
 * The full journey for a departure-board entry: the planner's version of the same service, with its stops,
 * arrival and map, when the planner offers it; otherwise the board's one-ride version. Restricted to the
 * departure's own mode, or the planner would suggest a faster line instead (a T4 rather than the T8 tapped).
 */
export function useDepartureJourney(e: StopEvent | undefined, stationId: string): Journey | undefined {
  const leg = e && departureLeg(e)
  const t = leg?.transportation
  const destId = t?.destination?.id
  const tripId = t?.properties?.RealtimeTripId
  const planned = e?.departureTimePlanned ? Date.parse(e.departureTimePlanned) : NaN
  const { data } = useTrips(
    {
      from: stationId,
      to: destId ?? '',
      mode: 'dep',
      when: Number.isFinite(planned) ? new Date(planned - 60_000) : undefined,
      excluded: exclusionParams([modeForClass(t?.product?.class).key]),
      count: 3,
    },
    !!e && !!destId && !!tripId,
    { directOnly: true },
  )
  return useMemo(() => {
    if (!e) return undefined
    const full = data?.find((j) => {
      const rides = j.legs.filter(isTransit)
      return rides.length === 1 && rides[0].transportation?.properties?.RealtimeTripId === tripId
    })
    return full ?? { legs: [departureLeg(e)] }
  }, [e, data, tripId])
}
