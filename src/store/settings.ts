import { useSyncExternalStore } from 'react'
import { MODES } from '../lib/lines'

export interface Settings {
  /** Saved trip cards show upcoming departures only while there are at most this many trips; 0 turns them off. */
  expandUpTo: number
  /** Transport modes pre-selected for new searches; empty means every mode. */
  preferredModes: string[]
}

export const DEFAULT_SETTINGS: Settings = { expandUpTo: 3, preferredModes: [] }
export const EXPAND_OPTIONS = [0, 1, 2, 3, 4, 5]

const KEY = 'nextstop.settings.v1'
const listeners = new Set<() => void>()
let cache: Settings | undefined

function read(): Settings {
  if (cache) return cache
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>
    const n = parsed.expandUpTo
    const known = MODES.map((m) => m.key as string)
    const modes = Array.isArray(parsed.preferredModes) ? parsed.preferredModes.filter((m) => known.includes(m)) : []
    cache = {
      ...DEFAULT_SETTINGS,
      ...(typeof n === 'number' && EXPAND_OPTIONS.includes(n) ? { expandUpTo: n } : {}),
      preferredModes: modes,
    }
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
