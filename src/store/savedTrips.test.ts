import { beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'nextstop.savedTrips.v1'
const stored = () => JSON.parse(localStorage.getItem(KEY)!)

describe('savedTrips', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('adds without duplicates, reverses and removes', async () => {
    const { savedTrips: store } = await import('./savedTrips')
    const t = { fromId: 'A', fromName: 'Lidcombe', toId: 'B', toName: 'Wynyard', modes: [] }
    store.add(t)
    store.add(t)
    expect(stored()).toHaveLength(1)

    store.reverse('A>B')
    expect(stored()[0]).toMatchObject({ id: 'B>A', fromName: 'Wynyard', toName: 'Lidcombe' })

    store.remove('B>A')
    expect(stored()).toEqual([])
  })
})
