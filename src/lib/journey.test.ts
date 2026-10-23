import { describe, expect, it } from 'vitest'
import type { Journey, StopPoint } from '../api/types'
import { journeyComparator, platformAt } from './journey'

const trip = (dep: string, arr: string, legs = 1, stops = 5): Journey => ({
  legs: Array.from({ length: legs }, (_, i) => ({
    origin: { departureTimePlanned: i === 0 ? dep : arr },
    destination: { arrivalTimePlanned: arr },
    transportation: { product: { class: 1 } },
    stopSequence: Array.from({ length: stops }, () => ({})),
  })),
})

describe('journeyComparator', () => {
  it('depart: earliest arrival first, then total time, changes, stops', () => {
    const sort = journeyComparator('dep')
    const late = trip('2026-01-01T00:00:00Z', '2026-01-01T00:40:00Z')
    const early = trip('2026-01-01T00:20:00Z', '2026-01-01T00:35:00Z')
    expect([late, early].sort(sort)).toEqual([early, late])

    const longer = trip('2026-01-01T00:00:00Z', '2026-01-01T00:30:00Z')
    const shorter = trip('2026-01-01T00:10:00Z', '2026-01-01T00:30:00Z')
    expect([longer, shorter].sort(sort)).toEqual([shorter, longer])

    const direct = trip('2026-01-01T00:00:00Z', '2026-01-01T00:30:00Z', 1)
    const change = trip('2026-01-01T00:00:00Z', '2026-01-01T00:30:00Z', 2)
    expect([change, direct].sort(sort)).toEqual([direct, change])

    const fewer = trip('2026-01-01T00:00:00Z', '2026-01-01T00:30:00Z', 1, 4)
    const more = trip('2026-01-01T00:00:00Z', '2026-01-01T00:30:00Z', 1, 9)
    expect([more, fewer].sort(sort)).toEqual([fewer, more])
  })

  it('arrive by: arrivals nearest the target first, late arrivals last', () => {
    const sort = journeyComparator('arr', new Date('2026-01-01T01:00:00Z'))
    const near = trip('2026-01-01T00:20:00Z', '2026-01-01T00:58:00Z')
    const far = trip('2026-01-01T00:00:00Z', '2026-01-01T00:30:00Z')
    const late = trip('2026-01-01T00:40:00Z', '2026-01-01T01:05:00Z')
    expect([late, far, near].sort(sort)).toEqual([near, far, late])
  })

  it('arrive by: within the same 5 minute band, shorter total time wins', () => {
    const sort = journeyComparator('arr', new Date('2026-01-01T01:00:00Z'))
    const slow = trip('2026-01-01T00:10:00Z', '2026-01-01T00:59:00Z')
    const quick = trip('2026-01-01T00:35:00Z', '2026-01-01T00:56:00Z')
    expect([slow, quick].sort(sort)).toEqual([quick, slow])
  })
})

describe('platformAt', () => {
  it('drops leading zeros', () => {
    expect(platformAt({ properties: { platform: '01' } } as StopPoint)).toBe('1')
    expect(platformAt({ properties: { platform: 'Platform 01' } } as StopPoint)).toBe('1')
  })

  it('reads the platform from the stop name', () => {
    expect(platformAt({ name: 'Central Station, Platform 16' } as StopPoint)).toBe('16')
    expect(platformAt({ name: 'Lidcombe Station' } as StopPoint)).toBeUndefined()
  })
})
