import { describe, expect, it } from 'vitest'
import { orderCarriages } from './vehicles'

describe('orderCarriages', () => {
  it('keeps numbered Sydney Trains carriages and drops the unnumbered header', () => {
    const cars = orderCarriages([
      { position: 0, quiet: false },
      { position: 2, quiet: false, occupancy: 2 },
      { position: 1, quiet: true, occupancy: 1 },
    ])
    expect(cars.map((c) => c.position)).toEqual([1, 2])
  })

  it('numbers metro carriages by feed order, dropping the numbered header', () => {
    const cars = orderCarriages([
      { position: 1, quiet: false },
      { position: 0, quiet: false, name: 'DTC1', occupancy: 1 },
      { position: 0, quiet: false, name: 'MPC1', occupancy: 3 },
      { position: 0, quiet: false, name: 'DTC2', occupancy: 2 },
    ])
    expect(cars.map((c) => [c.position, c.name, c.occupancy])).toEqual([
      [1, 'DTC1', 1],
      [2, 'MPC1', 3],
      [3, 'DTC2', 2],
    ])
  })

  it('drops a consist where no carriage reports a load, rather than showing it as empty', () => {
    const cars = orderCarriages([1, 2, 3, 4].map((position) => ({ position, quiet: false })))
    expect(cars).toEqual([])
  })
})
