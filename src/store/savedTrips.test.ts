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

  it('reorders by moving one trip to another position', async () => {
    const { savedTrips: store } = await import('./savedTrips')
    for (const id of ['A', 'B', 'C']) store.add({ fromId: id, fromName: id, toId: 'Z', toName: 'Z', modes: [] })

    store.reorder('A>Z', 'C>Z')
    expect(stored().map((t: { id: string }) => t.id)).toEqual(['B>Z', 'C>Z', 'A>Z'])

    store.reorder('A>Z', 'B>Z')
    expect(stored().map((t: { id: string }) => t.id)).toEqual(['A>Z', 'B>Z', 'C>Z'])
  })
})
