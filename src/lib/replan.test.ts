import { describe, expect, it } from 'vitest'
import type { Journey, Leg } from '../api/types'
import type { CurrentTrip } from '../store/currentTrip'
import { applyReplan, brokenReason, findReplan, replanPoint, trackSegments, withLiveLegs } from './replan'

const T = (hhmm: string) => `2026-10-30T${hhmm}:00Z`
const at = (hhmm: string) => Date.parse(T(hhmm))

interface RideOpts {
  depEst?: string
  arrEst?: string
  cancelled?: boolean
}

function ride(trip: string, from: string, to: string, dep: string, arr: string, o: RideOpts = {}): Leg {
  return {
    origin: {
      id: `${from}1`,
      name: `${from} Station, Platform 1`,
      parent: { id: from, type: 'stop' },
      departureTimePlanned: T(dep),
      departureTimeEstimated: o.depEst && T(o.depEst),
    },
    destination: {
      id: `${to}1`,
      name: `${to} Station, Platform 1`,
      parent: { id: to, type: 'stop' },
      arrivalTimePlanned: T(arr),
      arrivalTimeEstimated: o.arrEst && T(o.arrEst),
    },
    transportation: { number: trip.split('-')[0], product: { class: 1 }, properties: { RealtimeTripId: trip } },
    realtimeStatus: o.cancelled ? ['TRIP_CANCELLED'] : ['MONITORED'],
  }
}

const journey = (...legs: Leg[]): Journey => ({ legs })

// Seven Hills -> Town Hall on the T1, then the T4 to Bondi Junction.
const t1 = ride('T1-a', 'SVH', 'TH', '08:18', '08:57')
const t4 = ride('T4-a', 'TH', 'BJ', '09:06', '09:15')
const planned = journey(t1, t4)
const trip: CurrentTrip = { journey: planned, fromId: 'SVH', toId: 'BJ', fromName: 'Seven Hills Station', toName: 'Bondi Junction' }

describe('withLiveLegs', () => {
  it('takes each leg from whichever live journey has it, even when the planner split them up', () => {
    const t1Late = ride('T1-a', 'SVH', 'TH', '08:18', '08:57', { depEst: '08:23', arrEst: '09:00' })
    const t4Live = ride('T4-a', 'TH', 'BJ', '09:06', '09:15', { depEst: '09:06' })
    const merged = withLiveLegs(planned, [
      journey(t1Late, ride('T4-b', 'TH', 'BJ', '09:22', '09:32')),
      journey(ride('T1-b', 'SVH', 'TH', '08:33', '09:12'), t4Live),
    ])
    expect(merged.legs[0]).toBe(t1Late)
    expect(merged.legs[1]).toBe(t4Live)
  })

  it('keeps the stored journey object when nothing live matches', () => {
    expect(withLiveLegs(planned, [journey(ride('X', 'A', 'B', '08:00', '08:10'))])).toBe(planned)
  })
})

describe('replanPoint', () => {
  it('starts from the origin before boarding, no earlier than just before the planned train', () => {
    const p = replanPoint(trip, planned, at('07:30'))
    expect(p).toMatchObject({ keep: 0, stopId: 'SVH', readyAt: at('08:16') })
  })

  it('moves to the interchange station while riding, ready when the train gets in', () => {
    const live = journey(ride('T1-a', 'SVH', 'TH', '08:18', '08:57', { arrEst: '09:00' }), t4)
    expect(replanPoint(trip, live, at('08:40'))).toMatchObject({ keep: 1, stopId: 'TH', stopName: 'TH', readyAt: at('09:00') })
  })

  it('has nothing to offer once on the last ride', () => {
    expect(replanPoint(trip, planned, at('09:10'))).toBeUndefined()
  })
})

describe('brokenReason', () => {
  it('flags a connection the live times no longer allow', () => {
    const late = journey(ride('T1-a', 'SVH', 'TH', '08:18', '08:57', { arrEst: '09:08' }), t4)
    expect(brokenReason(late, 1)).toBe('missed')
    expect(brokenReason(planned, 1)).toBeUndefined()
  })

  it('flags a cancelled ride still ahead', () => {
    expect(brokenReason(journey(t1, ride('T4-a', 'TH', 'BJ', '09:06', '09:15', { cancelled: true })), 1)).toBe('cancelled')
  })
})

describe('findReplan', () => {
  const point = { keep: 1, stopId: 'TH', stopName: 'Town Hall', readyAt: at('08:57') }

  it('offers a clearly faster route from the interchange', () => {
    const metro = journey(ride('M1-a', 'TH', 'BJ', '09:01', '09:08'))
    const r = findReplan(planned, point, [metro], 3)
    expect(r?.reason).toBe('faster')
    expect(r?.savedMs).toBe(7 * 60_000)
    expect(r?.journey.legs.map((l) => l.transportation?.properties?.RealtimeTripId)).toEqual(['T1-a', 'M1-a'])
  })

  it('ignores routes only marginally faster, the current route itself, and ones leaving before the user can make the change', () => {
    const marginal = journey(ride('M1-a', 'TH', 'BJ', '09:05', '09:13'))
    const same = journey(t4)
    const tooSoon = journey(ride('M1-b', 'TH', 'BJ', '08:58', '09:04'))
    expect(findReplan(planned, point, [marginal, same, tooSoon], 3)).toBeUndefined()
  })

  it('offers the best option when the current plan is broken, even if it arrives later', () => {
    const late = journey(ride('T1-a', 'SVH', 'TH', '08:18', '08:57', { arrEst: '09:08' }), t4)
    const next = journey(ride('T4-b', 'TH', 'BJ', '09:22', '09:32'))
    const r = findReplan(late, { ...point, readyAt: at('09:08') }, [next], 3)
    expect(r?.reason).toBe('missed')
    expect(r?.savedMs).toBeLessThan(0)
  })

  it('never suggests a cancelled alternative', () => {
    const cancelled = journey(ride('M1-a', 'TH', 'BJ', '09:01', '09:08', { cancelled: true }))
    expect(findReplan(planned, point, [cancelled], 3)).toBeUndefined()
  })
})

describe('switching routes', () => {
  it('anchors the new segment so it can be tracked live, and tracks only unfinished segments', () => {
    const metro = journey(ride('M1-a', 'TH', 'BJ', '09:01', '09:08'))
    const r = findReplan(planned, { keep: 1, stopId: 'TH', stopName: 'Town Hall', readyAt: at('08:57') }, [metro], 3)!
    const switched = applyReplan(trip, r)
    expect(switched.anchors).toEqual([{ keep: 1, fromId: 'TH', when: T('09:01') }])
    expect(trackSegments(switched, at('08:40')).map((s) => s.fromId)).toEqual(['SVH', 'TH'])
    // Once the T1 is well behind the user, only the new segment needs live lookups.
    expect(trackSegments(switched, at('09:03')).map((s) => s.fromId)).toEqual(['TH'])
  })

  it('replaces the whole trip when switching before boarding', () => {
    const earlier = journey(ride('T1-c', 'SVH', 'TH', '08:20', '08:50'), ride('T4-c', 'TH', 'BJ', '08:55', '09:04'))
    const r = findReplan(planned, { keep: 0, stopId: 'SVH', stopName: 'Seven Hills', readyAt: at('08:16') }, [earlier], 3)!
    const switched = applyReplan(trip, r)
    expect(switched.journey).toBe(earlier)
    expect(switched.anchors).toBeUndefined()
  })
})

describe('departure board updates', () => {
  it('merge only the departure into a planned ride, keeping its arrival and stops', async () => {
    const { departureLeg } = await import('./departure')
    const stored = journey(ride('T1-a', 'SVH', 'TH', '08:18', '08:57'))
    stored.legs[0].stopSequence = [{ name: 'Seven Hills' }, { name: 'Town Hall' }]
    const fromBoard = departureLeg({
      departureTimePlanned: T('08:18'),
      departureTimeEstimated: T('08:24'),
      location: { id: 'SVH1', properties: { platform: 'SVH2', platformName: 'Platform 2' } },
      transportation: { product: { class: 1 } },
      properties: { RealtimeTripId: 'T1-a' },
    })
    const merged = withLiveLegs(stored, [{ legs: [fromBoard] }])
    expect(merged.legs[0].origin.departureTimeEstimated).toBe(T('08:24'))
    expect(merged.legs[0].origin.properties?.platformName).toBe('Platform 2')
    expect(merged.legs[0].destination.arrivalTimePlanned).toBe(T('08:57'))
    expect(merged.legs[0].stopSequence).toHaveLength(2)
  })
})
