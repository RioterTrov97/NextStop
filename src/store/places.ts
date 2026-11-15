import { useSyncExternalStore } from 'react'
import type { Place } from '../api/types'

/**
 * Home and Work, kept on this device only. Trips refer to them as the ids "home" and "work", resolved to the real
 * address on every request, so a saved "Home → Wynyard" keeps working after the address changes.
 */
export type SavedPlaceKey = 'home' | 'work'
export const SAVED_PLACES: { key: SavedPlaceKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'work', label: 'Work' },
]
export type SavedPlaces = Partial<Record<SavedPlaceKey, Place>>

const KEY = 'nextstop.places.v1'
const listeners = new Set<() => void>()
let cache: SavedPlaces | undefined

const isPlace = (p: unknown): p is Place => !!p && typeof (p as Place).id === 'string' && typeof (p as Place).name === 'string'

function read(): SavedPlaces {
  if (cache) return cache
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    cache = Object.fromEntries(SAVED_PLACES.filter((s) => isPlace(parsed[s.key])).map((s) => [s.key, parsed[s.key]])) as SavedPlaces
  } catch {
    cache = {}
  }
  return cache
}

window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return
  cache = undefined
  listeners.forEach((l) => l())
})

export const savedPlaces = {
  get: read,
  set(key: SavedPlaceKey, place: Place | undefined) {
    const next = { ...read() }
    if (place)
      next[key] = { id: place.id, name: place.name, disassembledName: place.disassembledName, type: place.type, modes: place.modes }
    else delete next[key]
    cache = next
    localStorage.setItem(KEY, JSON.stringify(next))
    listeners.forEach((l) => l())
  },
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useSavedPlaces(): SavedPlaces {
  return useSyncExternalStore(subscribe, read, () => ({}))
}

export const isSavedPlaceId = (id: string): id is SavedPlaceKey => SAVED_PLACES.some((s) => s.key === id)

/** The id the trip planner should get: the saved address for "home" and "work", any other id as it is. */
export function resolvePlaceId(id: string, places: SavedPlaces = read()): string {
  if (!isSavedPlaceId(id)) return id
  const place = places[id]
  if (!place) throw new Error(`Set your ${id === 'home' ? 'Home' : 'Work'} address in Settings to plan this trip.`)
  return place.id
}

/** A saved place as a pickable place: named "Home" or "Work", with the "home"/"work" id trips store. */
export const savedPlaceAsPlace = (key: SavedPlaceKey): Place => ({
  id: key,
  name: SAVED_PLACES.find((s) => s.key === key)!.label,
  type: 'saved',
})

/** Ids the departure board can show: stations and stops, not addresses, places or Home and Work. */
export const isStopId = (id: string) => !isSavedPlaceId(id) && !id.includes(':')
