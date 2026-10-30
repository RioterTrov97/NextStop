import { describe, expect, it } from 'vitest'
import type { Journey, Leg } from '../api/types'
import { bestOptions, transferFits, transfers, tripList } from './journey'
import { loadCaption, rideLoad } from './rideLoad'

const T = (hhmm: string) => `2026-10-30T${hhmm}:00Z`

function ride(id: string, from: string, to: string, dep: string, arr: string, o: { arrEst?: string; footSec?: number } = {}): Leg {
  return {
    origin: { id: from, name: `${from} Station`, departureTimePlanned: T(dep) },
    destination: { id: to, name: `${to} Station`, arrivalTimePlanned: T(arr), arrivalTimeEstimated: o.arrEst && T(o.arrEst) },
    transportation: { number: id.split('-')[0], product: { class: 1 }, properties: { RealtimeTripId: id } },
    footPathInfo: o.footSec ? [{ position: 'AFTER', duration: o.footSec }] : undefined,
  }
}
const j = (...legs: Leg[]): Journey => ({ legs })

describe('transfers', () => {
  it('uses live arrival times and the planner platform walk', () => {
    const late = j(
      ride('T1-a', 'SVH', 'TH', '08:18', '08:57', { arrEst: '09:00', footSec: 120 }),
      ride('T4-a', 'TH', 'BJ', '09:06', '09:15'),
    )
    expect(transfers(late)).toEqual([{ at: 'TH', gapSec: 360, walkSec: 120, index: 1 }])
    expect(transferFits(late, 6)).toBe(true)
    expect(transferFits(late, 7)).toBe(false)
  })

  it('rejects a change whose platform walk leaves under a minute spare, whatever the minimum gap', () => {
    const tight = j(ride('T1-a', 'A', 'B', '08:00', '08:10', { footSec: 180 }), ride('T2-a', 'B', 'C', '08:13', '08:20'))
    expect(transferFits(tight, 1)).toBe(false)
  })
})

describe('bestOptions', () => {
  it('keeps the roomier station when the same trains can be changed at two', () => {
    const viaTownHall = j(ride('T1-a', 'SVH', 'TH', '08:18', '08:57', { footSec: 120 }), ride('T4-a', 'TH', 'BJ', '09:06', '09:15'))
    const viaCentral = j(ride('T1-a', 'SVH', 'CE', '08:18', '08:56', { footSec: 240 }), ride('T4-a', 'CE', 'BJ', '09:05', '09:15'))
    // Leg ids differ, so these aren't byte-identical, yet only one is worth showing.
    viaCentral.legs[0].origin.departureTimePlanned = viaTownHall.legs[0].origin.departureTimePlanned
    expect(bestOptions([viaCentral, viaTownHall])).toEqual([viaTownHall])
  })

  it('drops a detour that leaves with a direct train but arrives later, and keeps a faster trip with a change', () => {
    const direct = j(ride('T1-a', 'HBY', 'WYN', '08:00', '08:40'))
    const detour = j(ride('T1-a', 'HBY', 'TH', '08:00', '08:45'), ride('T1-b', 'TH', 'WYN', '08:50', '08:55'))
    const fasterWithChange = j(ride('T9-a', 'HBY', 'CH', '08:05', '08:20'), ride('M1-a', 'CH', 'WYN', '08:25', '08:35'))
    expect(bestOptions([direct, detour, fasterWithChange])).toEqual([direct, fasterWithChange])
  })
})

describe('tripList', () => {
  const opts = { now: Date.parse(T('07:50')), mode: 'dep' as const, maxEndWalkMin: 10, minTransferMin: 3, pace: 'normal' as const }

  it('hides tight changes and counts only hidden trips that would have added an option', () => {
    const ok = j(ride('T1-a', 'A', 'B', '08:00', '08:10'), ride('T2-a', 'B', 'C', '08:16', '08:30'))
    const tightButFaster = j(ride('T1-b', 'A', 'B', '08:02', '08:12'), ride('T2-b', 'B', 'C', '08:14', '08:25'))
    const tightAndSlower = j(ride('T1-c', 'A', 'B', '07:55', '08:05'), ride('T2-c', 'B', 'C', '08:07', '08:40'))
    const r = tripList([ok, tightButFaster, tightAndSlower], opts)
    expect(r.visible).toEqual([ok])
    expect(r.hiddenByTransfer).toBe(1)
  })

  it('shows the tighter trip once the user allows it', () => {
    const tight = j(ride('T1-b', 'A', 'B', '08:02', '08:12'), ride('T2-b', 'B', 'C', '08:14', '08:25'))
    expect(tripList([tight], { ...opts, minTransferMin: 2 }).visible).toEqual([tight])
  })
})

describe('rideLoad', () => {
  const leg = ride('T1-a', 'A', 'B', '08:00', '08:10')

  it('summarises carriages from quietest to busiest', () => {
    const load = rideLoad(leg, {
      tripId: 'T1-a',
      carriages: [
        { position: 1, quiet: false, occupancy: 1 },
        { position: 2, quiet: false, occupancy: 3 },
      ],
    })
    expect(load).toMatchObject({ carriages: true, predicted: false, level: { label: 'Plenty to standing', level: 3 } })
    // One quiet and one busy carriage: the status leans to the busier one.
    expect(load?.typical?.short).toBe('Standing')
  })

  it('falls back to the planner forecast, marked as predicted, and to nothing without data', () => {
    expect(rideLoad({ ...leg, origin: { ...leg.origin, properties: { occupancy: 'FEW_SEATS' } } }, undefined)).toMatchObject({
      predicted: true,
      level: { label: 'Few seats' },
    })
    expect(rideLoad(leg, { tripId: 'T1-a', carriages: [] })).toBeUndefined()
  })
})

describe('loadCaption', () => {
  const level = { label: 'Few seats', short: 'Few seats', color: '#eab308', level: 2 }

  it('gives the typical carriage status for exact carriage readings', () => {
    const plenty = { label: 'Plenty of seats', short: 'Plenty', color: '#22c55e', level: 1 }
    expect(loadCaption('train', { mode: 'train', carriages: true, level, typical: plenty, predicted: false }).caption).toBe('Plenty')
  })

  it('flags forecasts, whole-train readings and missing data', () => {
    expect(loadCaption('train', { mode: 'train', carriages: false, level, predicted: true }).caption).toBe('Few seats · est.')
    expect(loadCaption('metro', { mode: 'metro', carriages: false, level, predicted: false }).caption).toBe('Few seats · overall')
    expect(loadCaption('bus', { mode: 'bus', carriages: false, level, predicted: false }).caption).toBe('Few seats')
    expect(loadCaption('train', undefined)).toMatchObject({ caption: 'No data' })
  })
})
