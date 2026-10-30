import type { Query } from '@tanstack/react-query'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'
import type { Journey, Leg, StopPoint } from '../api/types'

const KEY = 'nextstop-cache'
/** Writes are batched: React Query reports every fetch start and finish, many times per refresh. */
const WRITE_DELAY_MS = 3000

/** Data worth having on a cold start or offline. Alerts, via-hub extras and live positions refetch in moments. */
export function shouldPersist(q: Pick<Query, 'queryKey' | 'state' | 'meta'>): boolean {
  if (q.state.status !== 'success' || q.meta?.persist === false) return false
  const [kind, , , , , , , , part] = q.queryKey as unknown[]
  if (kind === 'trips') return part !== 'via'
  return kind === 'stops' || kind === 'weekend'
}

const slimStop = (p: StopPoint): StopPoint => ({
  id: p.id,
  name: p.name,
  disassembledName: p.disassembledName,
  parent: p.parent,
  arrivalTimePlanned: p.arrivalTimePlanned,
  arrivalTimeEstimated: p.arrivalTimeEstimated,
  departureTimePlanned: p.departureTimePlanned,
  departureTimeEstimated: p.departureTimeEstimated,
  properties: p.properties,
})

/** A journey without what only the map needs (route geometry, step-by-step paths), which is most of its size. */
type FullLeg = Leg & { pathDescriptions?: unknown; interchange?: unknown; footPathInfoRedundant?: unknown; coupledTripsInfo?: unknown }

function slimLeg(full: Leg): Leg {
  const { coords: _c, pathDescriptions: _p, interchange: _i, footPathInfoRedundant: _r, coupledTripsInfo: _t, ...leg } = full as FullLeg
  return {
    ...leg,
    origin: slimStop(leg.origin),
    destination: slimStop(leg.destination),
    stopSequence: leg.stopSequence?.map(slimStop),
    // Only the walk time between platforms is used, for transfer checks.
    footPathInfo: (leg.footPathInfo as { position?: string; duration?: number }[] | undefined)?.map(({ position, duration }) => ({
      position,
      duration,
    })),
  }
}

const isJourneys = (d: unknown): d is Journey[] => Array.isArray(d) && d.length > 0 && Array.isArray((d[0] as Journey)?.legs)

export function slimClient(c: PersistedClient): PersistedClient {
  return {
    ...c,
    clientState: {
      ...c.clientState,
      queries: c.clientState.queries.map((q) =>
        isJourneys(q.state.data)
          ? { ...q, state: { ...q.state, data: q.state.data.map((j) => ({ ...j, legs: j.legs.map(slimLeg) })) } }
          : q,
      ),
    },
  }
}

/**
 * IndexedDB persister that writes at most every few seconds, slimmed. The stock behaviour (a full write on every
 * cache event) re-serialised megabytes of trip geometry many times per refresh, stalling scrolling and the drawer.
 */
export function createCachePersister(): Persister {
  let latest: PersistedClient | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    if (!latest) return
    const client = latest
    latest = undefined
    void set(KEY, slimClient(client)).catch(() => {})
  }
  // An app sent to the background may never come back to finish a pending write.
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())
  return {
    persistClient: (client) => {
      latest = client
      timer ??= setTimeout(flush, WRITE_DELAY_MS)
    },
    restoreClient: () => get<PersistedClient>(KEY),
    removeClient: () => del(KEY),
  }
}
