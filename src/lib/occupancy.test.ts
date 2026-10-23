import { describe, expect, it } from 'vitest'
import { occupancyFromEnum, occupancyFromName } from './occupancy'

describe('occupancy', () => {
  it('maps GTFS enum values to levels', () => {
    expect(occupancyFromEnum(1).level).toBe(1)
    expect(occupancyFromEnum(2).level).toBe(2)
    expect(occupancyFromEnum(5).level).toBe(4)
    expect(occupancyFromEnum(undefined).level).toBe(0)
    expect(occupancyFromEnum(42).level).toBe(0)
  })

  it('maps names', () => {
    expect(occupancyFromName('FEW_SEATS').level).toBe(2)
    expect(occupancyFromName('nonsense').level).toBe(0)
  })
})
