import { describe, expect, it } from 'vitest'
import type { StopPoint, Transportation } from '../api/types'
import { comparePlatforms, platformInfo } from './platforms'

// Samples from the live Central, Parramatta and Hornsby departure boards.
const at = (platform: string, platformName: string, parent = 'Central Station'): StopPoint => ({
  properties: { platform, platformName },
  parent: { disassembledName: parent, type: 'stop' },
})
const mode = (cls: number, name = ''): Transportation => ({ product: { class: cls, name } })

describe('platformInfo', () => {
  it('numbers train and metro platforms from the name, not the station-prefixed code', () => {
    expect(platformInfo(at('CE18', 'Platform 18'), mode(1))).toMatchObject({ kind: 'train', long: 'Platform 18' })
    expect(platformInfo(at('SD07', 'Platform 7'), mode(1))).toMatchObject({ label: '7' })
    expect(platformInfo(at('CE26', 'Platform 26'), mode(2))).toMatchObject({ kind: 'metro', label: '26' })
    // Hornsby's intercity code says 5, but it is platform 4.
    expect(platformInfo(at('HBY5', 'Platform 4', 'Hornsby Station'), mode(1))?.label).toBe('4')
  })

  it('gives buses a lettered stand with its street, and never mistakes "LR2" or "A2" for platform 2', () => {
    expect(platformInfo(at('E', 'Central Station, Elizabeth St, Stand E'), mode(5))).toMatchObject({
      kind: 'bus',
      long: 'Stand E',
      detail: 'Elizabeth St',
    })
    expect(platformInfo(at('A2', 'Parramatta Station, Stand A2', 'Parramatta Station'), mode(5))).toMatchObject({ long: 'Stand A2' })
    expect(platformInfo(at('LR2', 'Central Chalmers Street Light Rail'), mode(4))).toMatchObject({
      kind: 'lightrail',
      label: 'Chalmers Street',
    })
  })

  it('marks temporary buses as replacement buses', () => {
    expect(platformInfo(at('X1', 'Hornsby Station, George St', 'Hornsby Station'), mode(5, 'Temporary buses'))).toMatchObject({
      kind: 'replacement',
      long: 'Stand X1',
      detail: 'George St',
    })
  })

  it('orders trains, metro, light rail, then buses, with numbers in numeric order', () => {
    const list = [
      platformInfo(at('E', 'Stand E'), mode(5))!,
      platformInfo(at('CE26', 'Platform 26'), mode(2))!,
      platformInfo(at('CE18', 'Platform 18'), mode(1))!,
      platformInfo(at('SD07', 'Platform 7'), mode(1))!,
    ]
    expect(list.sort(comparePlatforms).map((p) => p.long)).toEqual(['Platform 7', 'Platform 18', 'Platform 26', 'Stand E'])
  })
})
