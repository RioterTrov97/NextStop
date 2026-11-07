import { describe, expect, it } from 'vitest'
import type { Journey, Leg, StopPoint } from '../api/types'
import type { CurrentTrip } from '../store/currentTrip'
import { applyReplan, findReplan, replanPoint, trackSegments, withLiveLegs } from './replan'
import { endRideAt, rideNow, stopAhead, withRideAhead } from './ride'
import { legOccupancy } from './journey'

// Shaped like the live planner response for the 11:18 T1 from Lidcombe (2026-11-07): platform ids with the station
// in `parent`, and times only on the major stops.
const T = (hhmm: string) => `2026-11-07T${hhmm}:00Z`
const at = (hhmm: string) => Date.parse(T(hhmm))

function stop(id: string, name: string, times: Partial<Record<'arr' | 'arrEst' | 'dep' | 'depEst', string>> = {}): StopPoint {
  return {
    id: `${id}1`,
    name: `${name} Station, Platform 1, ${name}`,
    parent: { id, type: 'stop' },
    arrivalTimePlanned: times.arr && T(times.arr),
    arrivalTimeEstimated: times.arrEst && T(times.arrEst),
    departureTimePlanned: times.dep && T(times.dep),
    departureTimeEstimated: times.depEst && T(times.depEst),
  }
}

function t1(trip: string, stops: StopPoint[], occupancy?: string): Leg {
  return {
    origin: { ...stops[0], properties: occupancy ? { occupancy } : undefined },
    destination: stops[stops.length - 1],
    stopSequence: stops,
    transportation: { number: 'T1', product: { class: 1 }, properties: { RealtimeTripId: trip } },
    isRealtimeControlled: true,
    realtimeStatus: ['MONITORED'],
  }
}

const LID = () => stop('214110', 'Lidcombe', { dep: '00:18', depEst: '00:18' })
const FLE = () => stop('214020', 'Flemington')
const STR = (est = '00:25') => stop('213510', 'Strathfield', { arr: '00:25', arrEst: est, dep: '00:26', depEst: est })
const RED = (est = '00:37') => stop('201510', 'Redfern', { arr: '00:37', arrEst: est })
const WYN = (est = '00:44') => stop('200080', 'Wynyard', { arr: '00:44', arrEst: est })

// The ride as followed: boarded at Lidcombe, no forecast (the planner drops it once the train is running).
const riding = t1('813F', [LID(), FLE(), STR(), RED(), WYN()])
const followed: Journey = { legs: [riding] }
const trip: CurrentTrip = { journey: followed, fromId: '214110', toId: '200080', fromName: 'Lidcombe Station', toName: 'Wynyard Station' }

describe('the ride under way', () => {
  it('knows which ride the traveller is on', () => {
    expect(rideNow(followed, at('00:20'))).toBe(0)
    expect(rideNow(followed, at('00:10'))).toBe(-1)
    expect(rideNow(followed, at('00:50'))).toBe(-1)
  })

  it('finds the next stop with a known time, skipping untimed stops and ones about to be reached', () => {
    expect(stopAhead(riding, at('00:20'))).toMatchObject({ stop: 2, stationId: '213510', at: at('00:25') })
    // Under a minute from Strathfield: too late to plan around it, so Redfern.
    expect(stopAhead(riding, at('00:24') + 30_000)).toMatchObject({ stop: 3, stationId: '201510' })
    // Past Redfern only the destination is left.
    expect(stopAhead(riding, at('00:38'))).toBeUndefined()
  })

  it('cuts a ride short at a stop', () => {
    const cut = endRideAt(riding, 2)
    expect(cut.destination.parent?.id).toBe('213510')
    expect(cut.stopSequence).toHaveLength(3)
    expect(cut.duration).toBe(7 * 60)
  })
})

describe('withRideAhead', () => {
  it('takes live times and the forecast from a lookup that boards the same train further along', () => {
    const fromStrathfield = t1('813F', [STR('00:28'), RED('00:40'), WYN('00:47')], 'MANY_SEATS')
    const merged = withRideAhead(followed, [{ legs: [fromStrathfield] }])
    const leg = merged.legs[0]
    expect(legOccupancy(leg)?.short).toBe('Plenty')
    expect(leg.destination.arrivalTimeEstimated).toBe(T('00:47'))
    expect(leg.stopSequence?.[3].arrivalTimeEstimated).toBe(T('00:40'))
    // Where the user boarded stays as it was.
    expect(leg.origin.departureTimeEstimated).toBe(T('00:18'))
  })

  it('ignores other trains and lookups from where the user boarded', () => {
    const other = t1('900X', [STR(), WYN()], 'FEW_SEATS')
    const sameStart = t1('813F', [LID(), STR(), WYN()], 'FEW_SEATS')
    expect(withRideAhead(followed, [{ legs: [other] }, { legs: [sameStart] }])).toBe(followed)
  })
})

describe('replanning while riding', () => {
  it('plans from the next stop ahead, ready when the train gets there', () => {
    expect(replanPoint(trip, followed, at('00:20'))).toMatchObject({
      keep: 0,
      stopId: '213510',
      stopName: 'Strathfield',
      readyAt: at('00:25'),
      ride: { leg: 0, stop: 2, tripId: '813F' },
    })
  })

  // Delayed: the T1 now reaches Wynyard at 00:52 instead of 00:44.
  const late = t1('813F', [LID(), FLE(), STR('00:30'), RED('00:44'), WYN('00:52')])
  const lateTrip = { ...trip, journey: { legs: [late] } }
  const point = replanPoint(lateTrip, lateTrip.journey, at('00:20'))!

  it('swaps the delayed train for a faster one from the next stop, leaving time to change platforms', () => {
    const express = { legs: [t1('EXP1', [STR('00:35'), WYN('00:45')])] }
    const tooTight = { legs: [t1('EXP0', [STR('00:31'), WYN('00:40')])] }
    const r = findReplan(lateTrip.journey, point, [tooTight, express], 3)!
    expect(r.reason).toBe('faster')
    expect(r.savedMs).toBe(7 * 60_000)
    // The T1 now ends at Strathfield, then the express.
    expect(r.journey.legs.map((l) => [l.transportation?.properties?.RealtimeTripId, l.destination.parent?.id])).toEqual([
      ['813F', '213510'],
      ['EXP1', '200080'],
    ])
  })

  it('never offers the train the user is already on, or a slower one', () => {
    const same = { legs: [t1('813F', [STR('00:30'), WYN('00:52')])] }
    const slower = { legs: [t1('LATE', [STR('00:40'), WYN('00:58')])] }
    expect(findReplan(lateTrip.journey, point, [same, slower], 3)).toBeUndefined()
  })

  it('keeps the trip live after getting off early: the cut ride never stretches back to its old end', () => {
    const express = { legs: [t1('EXP1', [STR('00:35'), WYN('00:45')])] }
    const switched = applyReplan(lateTrip, findReplan(lateTrip.journey, point, [express], 3)!)
    expect(switched.anchors).toEqual([{ keep: 1, fromId: '213510', when: T('00:26') }])
    expect(trackSegments(switched, at('00:22')).map((s) => s.fromId)).toEqual(['214110', '213510'])
    // The lookup from Lidcombe still returns the T1 all the way to Wynyard; the stored ride stays cut at Strathfield.
    const tracked = withLiveLegs(switched.journey, [{ legs: [late] }])
    expect(tracked.legs[0].destination.parent?.id).toBe('213510')
  })

  it('stays on the train when the faster route only changes further along', () => {
    // Stay on to Redfern, then a faster service on: no change at Strathfield, so no change time needed there.
    const stayThenChange = {
      legs: [t1('813F', [STR('00:30'), RED('00:44')]), t1('FAST', [RED('00:46'), WYN('00:48')])],
    }
    const r = findReplan(lateTrip.journey, point, [stayThenChange], 3)!
    expect(r.reason).toBe('faster')
    expect(r.journey.legs).toHaveLength(2)
    expect(r.journey.legs[0].origin.parent?.id).toBe('214110')
    expect(r.journey.legs[0].destination.parent?.id).toBe('201510')
    const switched = applyReplan(lateTrip, r)
    // Looked up from Strathfield from now on, which covers the rest of the T1 as well as the next train.
    expect(switched.anchors).toEqual([{ keep: 0, fromId: '213510', when: T('00:26') }])
    expect(trackSegments(switched, at('00:22')).map((s) => s.fromId)).toEqual(['213510'])
  })
})
