import type { PersistedClient } from '@tanstack/react-query-persist-client'
import { describe, expect, it } from 'vitest'
import { shouldPersist, slimClient } from './cachePersister'

const q = (queryKey: unknown[], status = 'success', meta?: Record<string, unknown>) =>
  ({ queryKey, state: { status }, meta }) as unknown as Parameters<typeof shouldPersist>[0]

describe('shouldPersist', () => {
  it('keeps planned trips, stop searches and the weekend check, but not via-hub extras, alerts or live positions', () => {
    expect(shouldPersist(q(['trips', 'a', 'b', 'dep', 'now', 6, {}, 'normal', 'direct']))).toBe(true)
    expect(shouldPersist(q(['trips', 'a', 'b', 'dep', 'now', 6, {}, 'normal', 'via']))).toBe(false)
    expect(shouldPersist(q(['stops', 'cen']))).toBe(true)
    expect(shouldPersist(q(['weekend', 'a', 'b']))).toBe(true)
    expect(shouldPersist(q(['alerts']))).toBe(false)
    expect(shouldPersist(q(['vehicles', 'train'], 'success', { persist: false }))).toBe(false)
    expect(shouldPersist(q(['stops', 'cen'], 'error'))).toBe(false)
  })
})

describe('slimClient', () => {
  it('drops map geometry but keeps what cards and transfer checks need', () => {
    const leg = {
      origin: { name: 'A', departureTimePlanned: 't1', coord: [1, 2] },
      destination: { name: 'B', arrivalTimePlanned: 't2' },
      coords: [[1, 2]],
      pathDescriptions: [{}],
      footPathInfo: [{ position: 'AFTER', duration: 120, footPathElem: [{}] }],
      stopSequence: [{ name: 'A', departureTimePlanned: 't1', coord: [1, 2] }],
      transportation: { number: 'T1' },
    }
    const client = { clientState: { queries: [{ queryKey: ['trips'], state: { data: [{ legs: [leg] }] } }] } } as unknown as PersistedClient
    const slim = (slimClient(client).clientState.queries[0].state.data as { legs: Record<string, unknown>[] }[])[0].legs[0]
    expect(slim.coords).toBeUndefined()
    expect(slim.pathDescriptions).toBeUndefined()
    expect(slim.footPathInfo).toEqual([{ position: 'AFTER', duration: 120 }])
    expect(slim.transportation).toEqual({ number: 'T1' })
    expect((slim.origin as Record<string, unknown>).departureTimePlanned).toBe('t1')
  })
})
