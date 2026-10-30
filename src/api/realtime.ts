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

const isLive = (q: { queryKey: readonly unknown[]; getObserversCount: () => number }) =>
  isRealtimeKey(q.queryKey) && q.getObserversCount() > 0

/** Refetches every on-screen realtime query together and restarts the shared countdown. */
export function refreshRealtime(qc: QueryClient) {
  nextAt = Date.now() + REALTIME_MS
  nextVehiclesAt = Date.now() + VEHICLES_MS
  return qc.refetchQueries({ predicate: isLive }).finally(() => {
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
      if (Date.now() >= nextAt) void refreshRealtime(qc)
      else if (Date.now() >= nextVehiclesAt) {
        // Positions and carriage loads move faster than delays do, so they get an extra refresh between full ones.
        nextVehiclesAt = Date.now() + VEHICLES_MS
        void qc.refetchQueries({ predicate: (q) => isLive(q) && q.queryKey[0] === 'vehicles' })
      }
    }
    // Any trip or departure query starting to fetch (new route, changed modes, ...) restarts the countdown. Vehicle
    // refreshes don't, or their shorter cycle would keep pushing the trip refresh back forever.
    const unsubscribe = qc.getQueryCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'fetch' && isTimetableKey(e.query.queryKey)) resetRefreshTimer()
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
