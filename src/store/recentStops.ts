import { useSyncExternalStore } from 'react'
import type { Place } from '../api/types'

const KEY = 'nextstop.recentStops.v1'
const MAX = 6
const listeners = new Set<() => void>()
let cache: Place[] | undefined

function read(): Place[] {
  if (cache) return cache
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    cache = Array.isArray(parsed) ? (parsed as Place[]) : []
  } catch {
    cache = []
  }
  return cache
}

export const recentStops = {
  add(p: Place) {
    cache = [p, ...read().filter((x) => x.id !== p.id)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(cache))
    listeners.forEach((l) => l())
  },
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useRecentStops(): Place[] {
  return useSyncExternalStore(subscribe, read, () => [])
}
