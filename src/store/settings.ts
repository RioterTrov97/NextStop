import { useSyncExternalStore } from 'react'

export interface Settings {
  /** Saved trip cards show upcoming departures only while there are at most this many trips; 0 turns them off. */
  expandUpTo: number
}

export const DEFAULT_SETTINGS: Settings = { expandUpTo: 3 }
export const EXPAND_OPTIONS = [0, 1, 2, 3, 4, 5]

const KEY = 'nextstop.settings.v1'
const listeners = new Set<() => void>()
let cache: Settings | undefined

function read(): Settings {
  if (cache) return cache
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>
    const n = parsed.expandUpTo
    cache = { ...DEFAULT_SETTINGS, ...(typeof n === 'number' && EXPAND_OPTIONS.includes(n) ? { expandUpTo: n } : {}) }
  } catch {
    cache = DEFAULT_SETTINGS
  }
  return cache
}

window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return
  cache = undefined
  listeners.forEach((l) => l())
})

export const settings = {
  set(patch: Partial<Settings>) {
    cache = { ...read(), ...patch }
    localStorage.setItem(KEY, JSON.stringify(cache))
    listeners.forEach((l) => l())
  },
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_SETTINGS)
}
