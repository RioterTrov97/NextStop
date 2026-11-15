import { describe, expect, it } from 'vitest'
import network from '../data/network.json'
import { bandAt } from './bands'
import { railEnds, searchPlan } from './hubs'
import { changePlan, type NetworkData } from './network'

const LIDCOMBE = '214110'
const WYNYARD = '200080'
const STRATHFIELD = '213510'
const CENTRAL = '200060'
const REDFERN = '201510'
const TOWN_HALL = '200070'
const PARRAMATTA = '215020'
const PENRITH = '275010'
const BURWOOD = '213410'

/**
 * A small line: an all-stops train A-B-C-D-E every 10 minutes, 4 minutes between stops, and an express from B to E
 * (skipping C and D) every 5 minutes taking 6. From A, changing at B onto the express beats staying on.
 */
const toy = (allStopsPerHour = 6, expressPerHour = 12): NetworkData => ({
  stations: ['A', 'B', 'C', 'D', 'E', 'X'],
  patterns: [
    [1, [0, 1, 2, 3, 4], [0, 8, 16, 24, 32], [0, allStopsPerHour * 10, 0, 0, 0, 0, 0]],
    [1, [1, 4], [0, 12], [0, expressPerHour * 10, 0, 0, 0, 0, 0]],
  ],
})
const AM = 1

describe('changePlan', () => {
  it('finds the change onto an express that the planner would never offer', () => {
    const plan = changePlan(toy(), 'A', 'E', { band: AM, changeMin: 2 })!
    expect(plan.hubs.map((h) => h.id)).toEqual(['B'])
    // Staying on: 16 minutes riding plus a 5 minute wait. Changing: 4 + 2 + 6 riding, waits of 5 and 2.5 minutes.
    expect(plan.directMin).toBeCloseTo(21)
    expect(plan.expectedMin).toBeLessThan(plan.directMin!)
  })

  it('asks for nothing when no change can help', () => {
    expect(changePlan(toy(), 'C', 'E', { band: AM, changeMin: 2 })!.hubs).toEqual([])
    // A rare express isn't worth the wait or the search.
    expect(changePlan(toy(6, 0.5), 'A', 'E', { band: AM, changeMin: 2 })!.hubs).toEqual([])
  })

  it('uses the time of day: nothing runs in a band with no trips', () => {
    expect(changePlan(toy(), 'A', 'E', { band: 5, changeMin: 2 })).toEqual({ expectedMin: Infinity, hubs: [] })
  })

  it('needs both ends in the network', () => {
    expect(changePlan(toy(), 'A', 'nowhere', { band: AM, changeMin: 2 })).toBeUndefined()
  })
})

describe('changePlan on the Sydney timetable', () => {
  const data = network as unknown as NetworkData
  const hubs = (from: string, to: string, band = AM) => changePlan(data, from, to, { band, changeMin: 4 })!.hubs.map((h) => h.id)

  it('changes at Strathfield between Lidcombe and Wynyard at peak, never next to an end', () => {
    for (const [from, to] of [
      [LIDCOMBE, WYNYARD],
      [WYNYARD, LIDCOMBE],
    ]) {
      expect(hubs(from, to)).toContain(STRATHFIELD)
      expect(hubs(from, to)).not.toContain(REDFERN)
      expect(hubs(from, to)).not.toContain(TOWN_HALL)
    }
  })

  it('searches nothing extra where staying on is the only sensible way', () => {
    expect(hubs(PARRAMATTA, PENRITH)).toEqual([])
    expect(hubs(BURWOOD, LIDCOMBE)).toEqual([])
  })

  it('never offers two interchanges with the same trains a few minutes apart', () => {
    const near = [CENTRAL, REDFERN, TOWN_HALL]
    for (let band = 0; band < 7; band++) {
      expect(hubs(LIDCOMBE, WYNYARD, band).filter((h) => near.includes(h)).length).toBeLessThanOrEqual(1)
    }
  })

  it('works out a plan in a few milliseconds', () => {
    const t = performance.now()
    for (let i = 0; i < 10; i++) hubs(LIDCOMBE, WYNYARD)
    expect((performance.now() - t) / 10).toBeLessThan(50)
  })
})

describe('searchPlan', () => {
  const data = network as unknown as NetworkData
  const am = new Date('2026-11-17T09:00:00+11:00')

  it('splits between stations, with no via searches', () => {
    const plan = searchPlan(data, { from: LIDCOMBE, to: WYNYARD, when: am, excluded: {} }, 3)
    expect(plan.via).toEqual([])
    expect(plan.split.map((h) => h.id)).toContain(STRATHFIELD)
  })

  it('falls back to the city hubs when an end is outside the rail network', () => {
    const plan = searchPlan(data, { from: '2000123', to: WYNYARD, when: am, excluded: {} }, 3)
    expect(plan).toEqual({ split: [], via: [CENTRAL, TOWN_HALL, REDFERN] })
  })

  it('plans an address trip between the stations its direct trips board and leave at', () => {
    const home = 'coord:4874072:3754821:GDAV:72 Joseph St, Lidcombe:0'
    const plan = searchPlan(data, { from: home, to: WYNYARD, when: am, excluded: {} }, 3, { from: LIDCOMBE })
    expect(plan.via).toEqual([])
    expect(plan.split.map((h) => h.id)).toContain(STRATHFIELD)
  })

  it('searches nothing extra from an address whose trips the model cannot place', () => {
    const home = 'streetID:1500001234::95301001:-1:Joseph St:Lidcombe'
    expect(searchPlan(data, { from: home, to: WYNYARD, when: am, excluded: {} }, 3)).toEqual({ split: [], via: [] })
    expect(searchPlan(data, { from: home, to: WYNYARD, when: am, excluded: {} }, 3, { from: '2141119' })).toEqual({ split: [], via: [] })
  })

  it('searches nothing extra when trains and metro are switched off', () => {
    const busOnly = { excludedMeans: 'checkbox', exclMOT_1: '1', exclMOT_2: '2', exclMOT_4: '4' }
    expect(searchPlan(data, { from: LIDCOMBE, to: WYNYARD, when: am, excluded: busOnly }, 3)).toEqual({ split: [], via: [] })
  })
})

describe('bandAt', () => {
  it('places Sydney times in timetable bands, after midnight counting as the night before', () => {
    expect(bandAt(new Date('2026-11-17T09:00:00+11:00'))).toBe(1) // Tuesday morning peak
    expect(bandAt(new Date('2026-11-17T17:30:00+11:00'))).toBe(3) // Tuesday evening peak
    expect(bandAt(new Date('2026-11-21T12:00:00+11:00'))).toBe(5) // Saturday
    expect(bandAt(new Date('2026-11-22T01:30:00+11:00'))).toBe(5) // Sunday 1:30am is Saturday night
    expect(bandAt(new Date('2026-11-17T01:30:00+11:00'))).toBe(4) // Tuesday 1:30am is Monday night
  })
})

describe('railEnds', () => {
  const ride = (from: string, to: string) => ({
    origin: { id: `${from}1`, parent: { id: from, type: 'stop' } },
    destination: { id: `${to}2`, parent: { id: to, type: 'stop' } },
    transportation: { product: { class: 1 } },
  })
  const walk = { origin: { id: 'coord:1' }, destination: { id: 'x' }, transportation: { product: { class: 100 } } }

  it('takes the station most trips board at and leave from, not the platform', () => {
    const journeys = [
      { legs: [walk, ride(LIDCOMBE, WYNYARD)] },
      { legs: [walk, ride(LIDCOMBE, STRATHFIELD), ride(STRATHFIELD, WYNYARD)] },
      { legs: [walk, ride('2141119', WYNYARD)] },
    ]
    expect(railEnds(journeys)).toEqual({ from: LIDCOMBE, to: WYNYARD })
  })

  it('is empty for walking-only answers', () => {
    expect(railEnds([{ legs: [walk] }])).toEqual({ from: undefined, to: undefined })
  })
})
