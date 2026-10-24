import { useSyncExternalStore } from 'react'
import type { Journey } from '../api/types'
import { slim } from './currentTrip'
import type { SavedTrip } from './savedTrips'
import { settings } from './settings'

export interface HistoryEntry extends Pick<SavedTrip, 'fromId' | 'fromName' | 'toId' | 'toName' | 'modes'> {
  /** When it was recorded. */
  at?: number
  /** Followed trips keep the journey they followed, without map geometry. */
  journey?: Journey
}

const listeners = new Set<() => void>()

export const routeKey = (t: Pick<HistoryEntry, 'fromId' | 'toId'>) => `${t.fromId}>${t.toId}`

/** Most recent first, one entry per route. */
export function dedupeRoutes<T extends Pick<HistoryEntry, 'fromId' | 'toId'>>(list: T[]): T[] {
  const seen = new Set<string>()
  return list.filter((t) => {
    const k = routeKey(t)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** A followed trip is one scheduled departure; a search is just a route. */
export const tripEntryKey = (e: HistoryEntry) =>
  e.journey ? `${routeKey(e)}|${e.journey.legs[0]?.origin.departureTimePlanned ?? ''}` : routeKey(e)

function createList(key: string, keyOf: (e: HistoryEntry) => string) {
  let cache: HistoryEntry[] | undefined
  const read = (): HistoryEntry[] => {
    if (cache) return cache
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
      cache = Array.isArray(parsed)
        ? (parsed as HistoryEntry[]).filter((e) => e && typeof e.fromId === 'string' && typeof e.toId === 'string')
        : []
    } catch {
      cache = []
    }
    return cache
  }
  const write = (next: HistoryEntry[]) => {
    cache = next
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Storage full: keep the newest half rather than losing the new entry.
      cache = next.slice(0, Math.ceil(next.length / 2))
      localStorage.setItem(key, JSON.stringify(cache))
    }
    listeners.forEach((l) => l())
  }
  window.addEventListener('storage', (e) => {
    if (e.key !== key) return
    cache = undefined
    listeners.forEach((l) => l())
  })
  return {
    read,
    add(e: HistoryEntry) {
      const entry = { ...e, at: e.at ?? Date.now() }
      const rest = read().filter((x) => keyOf(x) !== keyOf(entry))
      write([entry, ...rest].slice(0, settings.get().historyLimit))
    },
    remove(e: HistoryEntry) {
      write(read().filter((x) => keyOf(x) !== keyOf(e)))
    },
    removeRoute(e: Pick<HistoryEntry, 'fromId' | 'toId'>) {
      write(read().filter((x) => routeKey(x) !== routeKey(e)))
    },
    trim() {
      const max = settings.get().historyLimit
      if (read().length > max) write(read().slice(0, max))
    },
    clear() {
      write([])
    },
  }
}

const searches = createList('nextstop.searchHistory.v1', routeKey)
const trips = createList('nextstop.tripHistory.v1', tripEntryKey)

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

const empty: HistoryEntry[] = []

export const history = {
  searches: searches.read,
  addSearch: searches.add,
  addTrip: (e: Omit<HistoryEntry, 'journey'> & { journey: Journey }) => trips.add({ ...e, journey: slim(e.journey) }),
  removeSearch: searches.remove,
  removeTrip: trips.remove,
  /** Removes every entry for a route from both lists. */
  removeRoute(e: Pick<HistoryEntry, 'fromId' | 'toId'>) {
    trips.removeRoute(e)
    searches.removeRoute(e)
  },
  trim() {
    trips.trim()
    searches.trim()
  },
  clearSearches: searches.clear,
  clearTrips: trips.clear,
}

export const useSearchHistory = () => useSyncExternalStore(subscribe, searches.read, () => empty)
export const useTripHistory = () => useSyncExternalStore(subscribe, trips.read, () => empty)
