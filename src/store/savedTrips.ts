import { useSyncExternalStore } from 'react'

export interface SavedTrip {
  id: string
  fromId: string
  fromName: string
  toId: string
  toName: string
  modes: string[]
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
    write([...read(), { ...t, id }])
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
