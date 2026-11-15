import { beforeEach, describe, expect, it } from 'vitest'
import type { Place } from '../api/types'
import { isStopId, resolvePlaceId, savedPlaces } from '../store/places'
import { placeKind, rankPlaces } from './places'

// Shaped like stop finder results for "lidcombe": a pub, the station, a bus stop, an address, a street and a suburb.
const results: Place[] = [
  { id: 'poiID:1', name: 'Lidcombe Hotel, Lidcombe', type: 'poi', matchQuality: 900 },
  { id: '2141119', name: 'Lidcombe Station, Bus stand A', type: 'stop', modes: [5], matchQuality: 950 },
  { id: 'streetID:9', name: 'Lidcombe Rd, Lidcombe', type: 'street', matchQuality: 950 },
  { id: '214110', name: 'Lidcombe Station', type: 'stop', modes: [1, 5], matchQuality: 900 },
  { id: 'coord:1:2:GDAV:1 Lidcombe St', name: '1 Lidcombe St, Lidcombe', type: 'singlehouse', matchQuality: 950 },
  { id: 'suburbID:1', name: 'Lidcombe', type: 'suburb', matchQuality: 1000 },
]

describe('rankPlaces', () => {
  it('puts train stations first, then match quality, then stops before addresses before streets, and drops suburbs', () => {
    expect(rankPlaces(results).map((p) => p.id)).toEqual(['214110', '2141119', 'coord:1:2:GDAV:1 Lidcombe St', 'streetID:9', 'poiID:1'])
  })

  it('names the kind of each place', () => {
    expect(results.map(placeKind)).toEqual(['place', 'stop', 'address', 'station', 'address', 'place'])
  })
})

describe('saved places', () => {
  beforeEach(() => {
    localStorage.clear()
    savedPlaces.set('home', undefined)
    savedPlaces.set('work', undefined)
  })

  it('resolves Home to the saved address and leaves other ids alone', () => {
    savedPlaces.set('home', { id: 'coord:1:2:GDAV:72 Joseph St, Lidcombe:0', name: '72 Joseph St, Lidcombe', type: 'address' })
    expect(resolvePlaceId('home')).toBe('coord:1:2:GDAV:72 Joseph St, Lidcombe:0')
    expect(resolvePlaceId('200080')).toBe('200080')
  })

  it('asks for the address when Work is not set', () => {
    expect(() => resolvePlaceId('work')).toThrow('Set your Work address in Settings')
  })

  it('only offers stops to the departure board', () => {
    expect(['200080', 'home', 'coord:1:2:GDAV:x', 'poiID:1'].filter(isStopId)).toEqual(['200080'])
  })
})
