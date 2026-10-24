import { describe, expect, it } from 'vitest'
import { dedupeRoutes } from './history'

describe('dedupeRoutes', () => {
  it('keeps the first of each route and treats direction as distinct', () => {
    const e = (fromId: string, toId: string) => ({ fromId, toId })
    expect(dedupeRoutes([e('a', 'b'), e('b', 'a'), e('a', 'b')])).toEqual([e('a', 'b'), e('b', 'a')])
  })
})
