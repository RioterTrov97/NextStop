import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { REALTIME_MS, isRealtimeKey } from './hooks'

let nextAt = Date.now() + REALTIME_MS
export const getNextRefreshAt = () => nextAt

/** Restarts the countdown, e.g. after the user changes what is being shown. */
export const resetRefreshTimer = () => {
  nextAt = Date.now() + REALTIME_MS
}

const isLive = (q: { queryKey: readonly unknown[]; getObserversCount: () => number }) =>
  isRealtimeKey(q.queryKey) && q.getObserversCount() > 0

/** Refetches every on-screen realtime query together and restarts the shared countdown. */
export function refreshRealtime(qc: QueryClient) {
  nextAt = Date.now() + REALTIME_MS
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
        return
      }
      if (document.visibilityState === 'visible' && Date.now() >= nextAt) void refreshRealtime(qc)
    }
    // Any live query starting to fetch (new route, changed modes, ...) restarts the countdown.
    const unsubscribe = qc.getQueryCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'fetch' && isRealtimeKey(e.query.queryKey)) resetRefreshTimer()
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
