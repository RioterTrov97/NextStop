import { useSyncExternalStore } from 'react'
import { settings } from './settings'

export interface SavedTrip {
  id: string
  fromId: string
  fromName: string
  toId: string
  toName: string
  modes: string[]
  /** When of the day this trip is relevant; missing means all day. */
  period?: TripPeriod
  /** Longest walk after the last ride in minutes; missing follows the global setting. */
  maxEndWalk?: number
}

export type TripPeriod = 'all' | 'morning' | 'afternoon' | 'evening' | 'night'
export const PERIODS: { key: TripPeriod; label: string; hours: string }[] = [
  { key: 'all', label: 'All day', hours: 'Any time' },
  { key: 'morning', label: 'Morning', hours: '6am – 11am' },
  { key: 'afternoon', label: 'Afternoon', hours: '11am – 3pm' },
  { key: 'evening', label: 'Evening', hours: '3pm – 7pm' },
  { key: 'night', label: 'Night', hours: '7pm – midnight' },
]

/** The period a moment falls in; 12am–6am belongs to none. */
export function periodAt(ms: number): TripPeriod | undefined {
  const h = new Date(ms).getHours()
  if (h >= 6 && h < 11) return 'morning'
  if (h >= 11 && h < 15) return 'afternoon'
  if (h >= 15 && h < 19) return 'evening'
  if (h >= 19) return 'night'
  return undefined
}

const KEY = 'nextstop.savedTrips.v1'
const listeners = new Set<() => void>()
let cache: SavedTrip[] | undefined

function read(): SavedTrip[] {
  if (cache) return cache
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    cache = Array.isArray(parsed) ? (parsed as SavedTrip[]) : []
  } catch {
    cache = []
  }
  return cache
}

function write(next: SavedTrip[]) {
  cache = next
  localStorage.setItem(KEY, JSON.stringify(next))
  listeners.forEach((l) => l())
}

// Another tab changed the list.
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return
  cache = undefined
  listeners.forEach((l) => l())
})

export const tripId = (fromId: string, toId: string) => `${fromId}>${toId}`

export const savedTrips = {
  add(t: Omit<SavedTrip, 'id'>) {
    const id = tripId(t.fromId, t.toId)
    if (read().some((x) => x.id === id)) return
    write([...read(), { maxEndWalk: settings.get().maxEndWalk, ...t, id }])
  },
  remove(id: string) {
    write(read().filter((t) => t.id !== id))
  },
  reverse(id: string) {
    write(
      read().map((t) =>
        t.id === id ? { ...t, id: tripId(t.toId, t.fromId), fromId: t.toId, fromName: t.toName, toId: t.fromId, toName: t.fromName } : t,
      ),
    )
  },
  setModes(id: string, modes: string[]) {
    write(read().map((t) => (t.id === id ? { ...t, modes } : t)))
  },
  setEndWalk(id: string, maxEndWalk: number) {
    write(read().map((t) => (t.id === id ? { ...t, maxEndWalk } : t)))
  },
  setPeriod(id: string, period: TripPeriod) {
    write(read().map((t) => (t.id === id ? { ...t, period } : t)))
  },
  reorder(activeId: string, overId: string) {
    const list = [...read()]
    const from = list.findIndex((t) => t.id === activeId)
    const to = list.findIndex((t) => t.id === overId)
    if (from < 0 || to < 0 || from === to) return
    list.splice(to, 0, ...list.splice(from, 1))
    write(list)
  },
  move(id: string, dir: -1 | 1) {
    const list = [...read()]
    const i = list.findIndex((t) => t.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    write(list)
  },
  clear() {
    write([])
  },
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useSavedTrips(): SavedTrip[] {
  return useSyncExternalStore(subscribe, read, () => [])
}
