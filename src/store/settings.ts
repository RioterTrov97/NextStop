import { useSyncExternalStore } from 'react'
import { MODES } from '../lib/lines'

export type WalkPace = 'fast' | 'normal' | 'slow'
export const WALK_PACES: { key: WalkPace; label: string; hint: string }[] = [
  { key: 'fast', label: 'Quick', hint: 'Shorter walks and tighter transfers' },
  { key: 'normal', label: 'Normal', hint: 'Standard walking pace' },
  { key: 'slow', label: 'Relaxed', hint: 'Longer walks and roomier transfers' },
]

export interface Settings {
  /** Saved trip cards show upcoming departures only while there are at most this many trips; 0 turns them off. */
  expandUpTo: number
  /** Transport modes pre-selected for new searches; empty means every mode. */
  preferredModes: string[]
  /** Longest walk allowed after the last ride, in minutes; 0 only shows trips that end at the destination. */
  maxEndWalk: number
  /** Walking pace used by the trip planner when it sizes transfers and walks. */
  walkPace: WalkPace
  /** How many followed trips and searches are kept, each. */
  historyLimit: number
}

export const DEFAULT_SETTINGS: Settings = { expandUpTo: 3, preferredModes: [], maxEndWalk: 0, walkPace: 'normal', historyLimit: 25 }
export const END_WALK_OPTIONS = [0, 5, 10, 15, 20, 30]
export const HISTORY_OPTIONS = [10, 25, 50, 100]
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
      ...(WALK_PACES.some((w) => w.key === parsed.walkPace) ? { walkPace: parsed.walkPace } : {}),
      ...(typeof parsed.historyLimit === 'number' && HISTORY_OPTIONS.includes(parsed.historyLimit)
        ? { historyLimit: parsed.historyLimit }
        : {}),
      ...(typeof parsed.maxEndWalk === 'number' && END_WALK_OPTIONS.includes(parsed.maxEndWalk) ? { maxEndWalk: parsed.maxEndWalk } : {}),
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
  get: read,
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
