import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { REALTIME_MS, VEHICLES_MS, isRealtimeKey, isTimetableKey } from './hooks'

let nextAt = Date.now() + REALTIME_MS
let nextVehiclesAt = Date.now() + VEHICLES_MS
export const getNextRefreshAt = () => nextAt

/** Restarts the countdown, e.g. after the user changes what is being shown. */
export const resetRefreshTimer = () => {
  nextAt = Date.now() + REALTIME_MS
}

/** A sheet being dragged: refreshing then would re-render under the finger and make the drag stutter. */
const isDragging = () => !!document.querySelector('[data-scope="drawer"][data-part="content"][data-dragging]')

const isLive = (q: { queryKey: readonly unknown[]; getObserversCount: () => number; meta?: Record<string, unknown> }) =>
  isRealtimeKey(q.queryKey) && q.getObserversCount() > 0 && !q.meta?.['past']

/**
 * A live query refreshed more recently than its own interval: the shared timer leaves it alone. Trips and departures
 * default to the 15s cycle, vehicles to their 10s one; a query asks for a slower rate with `meta.every` (via and split
 * searches, Home's saved-trip cards, a followed trip that is far off). The timer ticks every 15s, so slower queries
 * refresh on the first tick after they are due.
 */
const notDue = (q: { queryKey: readonly unknown[]; meta?: Record<string, unknown>; state: { dataUpdatedAt: number } }) => {
  const every = (q.meta?.['every'] as number | undefined) ?? (q.queryKey[0] === 'vehicles' ? VEHICLES_MS : REALTIME_MS)
  return Date.now() - q.state.dataUpdatedAt < every - 1500
}

/**
 * Refetches every on-screen realtime query together and restarts the shared countdown. The timer's own refreshes
 * (`scheduled`) skip queries that aren't yet due (`notDue`); the refresh button and route changes don't.
 */
export function refreshRealtime(qc: QueryClient, { scheduled = false } = {}) {
  nextAt = Date.now() + REALTIME_MS
  nextVehiclesAt = Date.now() + VEHICLES_MS
  return qc.refetchQueries({ predicate: (q) => isLive(q) && !(scheduled && notDue(q)) }).finally(() => {
    nextAt = Date.now() + REALTIME_MS
  })
}

/** One shared timer for all live data, so trips, departures and vehicles update in the same tick instead of on their own clocks. */
export function useRealtimeScheduler() {
  const qc = useQueryClient()
  useEffect(() => {
    let hadLive = false
    const tick = () => {
      const live = qc.getQueryCache().findAll({ predicate: isLive }).length > 0
      if (!live || !hadLive) {
        // Freshly mounted queries fetch on their own, so start the countdown from now.
        hadLive = live
        nextAt = Date.now() + REALTIME_MS
        nextVehiclesAt = Date.now() + VEHICLES_MS
        return
      }
      // Hidden, or mid-drag: wait. A due refresh then runs on the first tick after the finger lifts.
      if (document.visibilityState !== 'visible' || isDragging()) return
      if (Date.now() >= nextAt) void refreshRealtime(qc, { scheduled: true })
      else if (Date.now() >= nextVehiclesAt) {
        // Positions and carriage loads move faster than delays do, so they get an extra refresh between full ones.
        nextVehiclesAt = Date.now() + VEHICLES_MS
        void qc.refetchQueries({ predicate: (q) => isLive(q) && q.queryKey[0] === 'vehicles' && !notDue(q) })
      }
    }
    // Any trip or departure query starting to fetch (new route, changed modes, ...) restarts the countdown. Vehicle
    // refreshes don't, or their shorter cycle would keep pushing the trip refresh back forever.
    // Past (historical) queries are excluded: they're not live, so they shouldn't disturb the countdown.
    const unsubscribe = qc.getQueryCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'fetch' && isTimetableKey(e.query.queryKey) && !e.query.meta?.['past'])
        resetRefreshTimer()
    })
    const id = setInterval(tick, 500)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      unsubscribe()
      document.removeEventListener('visibilitychange', tick)
    }
  }, [qc])
}
