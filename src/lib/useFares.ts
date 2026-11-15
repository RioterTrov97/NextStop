import { useMemo, useSyncExternalStore } from 'react'
import type { Journey } from '../api/types'
import { useSettings } from '../store/settings'
import { estimateFare, loadFares, type FareData, type FareEstimate } from './fares'

// One shared copy for every card and sheet: loaded on first use, then read synchronously.
let data: FareData | undefined
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (!data)
    loadFares()
      .then((d) => {
        data = d
        listeners.forEach((l) => l())
      })
      .catch(() => {})
  return () => listeners.delete(cb)
}

/** The fare bands, once loaded. */
export const useFareData = () => useSyncExternalStore(subscribe, () => data)

/**
 * The Opal fare estimate for a journey at the fare type set in Settings. Undefined while loading, or when the trip
 * isn't charged Opal fares. Memoised, as cards re-render every second for their countdowns.
 */
export function useFare(journey: Journey | undefined): FareEstimate | undefined {
  const fares = useFareData()
  const { fareType } = useSettings()
  return useMemo(() => (fares && journey ? estimateFare(fares, journey, fareType) : undefined), [fares, journey, fareType])
}
