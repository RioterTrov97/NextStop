import { useSyncExternalStore } from 'react'
import type { Journey } from '../api/types'

/** Where a switched-to route starts: the legs from `keep` onward were planned from this stop at this time. */
export interface TripAnchor {
  keep: number
  fromId: string
  /** Planned departure of the first leg of that segment, used to look the segment up again for live times. */
  when: string
}

export interface CurrentTrip {
  journey: Journey
  fromId: string
  toId: string
  fromName: string
  toName: string
  /** Set once the user switches to a faster route mid-trip; each anchor starts a newer segment. */
  anchors?: TripAnchor[]
  /** Followed from a station's departure board: that board also keeps the ride's times and platform live. */
  boardId?: string
}

const KEY = 'nextstop.currentTrip.v1'
const listeners = new Set<() => void>()
let cache: CurrentTrip | null | undefined

function read(): CurrentTrip | null {
  if (cache !== undefined) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? 'null') as CurrentTrip | null
  } catch {
    cache = null
  }
  return cache
}

function write(next: CurrentTrip | null) {
  cache = next
  if (next) localStorage.setItem(KEY, JSON.stringify(next))
  else localStorage.removeItem(KEY)
  listeners.forEach((l) => l())
}

window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return
  cache = undefined
  listeners.forEach((l) => l())
})

/** Drop the map geometry so the snapshot stays small enough for localStorage. */
export const slim = (j: Journey): Journey => ({
  ...j,
  legs: j.legs.map(({ coords: _coords, footPathInfo: _foot, stopSequence, ...leg }) => ({
    ...leg,
    stopSequence: stopSequence?.slice(0, 1),
  })),
})

export const tripKey = (j: Journey) =>
  j.legs.map((l) => l.transportation?.properties?.RealtimeTripId ?? l.origin.departureTimePlanned).join('|')

export const currentTrip = {
  set(t: CurrentTrip) {
    write({ ...t, journey: slim(t.journey) })
  },
  clear() {
    write(null)
  },
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useCurrentTrip(): CurrentTrip | null {
  return useSyncExternalStore(subscribe, read, () => null)
}
