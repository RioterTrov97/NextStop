import { describe, expect, it } from 'vitest'
import type { Journey, Leg } from '../api/types'
import { stitchAtHub } from './split'
import { bestOptions, transfers } from './journey'

const at = (hm: string) => `2026-11-17T${hm}:00+11:00`
const ride = (line: string, from: string, dep: string, to: string, arr: string, tripId = `${line}-${dep}`): Leg => ({
  origin: { id: from, name: from, departureTimePlanned: at(dep) },
  destination: { id: to, name: to, arrivalTimePlanned: at(arr) },
  transportation: { disassembledName: line, product: { class: 1 }, properties: { RealtimeTripId: tripId } },
})
const j = (...legs: Leg[]): Journey => ({ legs })
const lines = (x: Journey) => x.legs.map((l) => `${l.transportation?.disassembledName} ${l.origin.departureTimePlanned?.slice(11, 16)}`)

// Shaped like the live answers for Wynyard to Lidcombe on a weekday morning (17 Nov 2026).
const toStrathfield = [
  j(ride('T9', 'Wynyard', '08:45', 'Strathfield', '09:06')),
  j(ride('T1', 'Wynyard', '08:49', 'Strathfield', '09:09', 'T1-A')),
  j(ride('CCN', 'Wynyard', '08:55', 'Strathfield', '09:14')),
]
const onToLidcombe = [
  j(ride('T1', 'Strathfield', '09:10', 'Lidcombe', '09:16', 'T1-A')),
  j(ride('T1', 'Strathfield', '09:13', 'Lidcombe', '09:19')),
  j(ride('T2', 'Strathfield', '09:19', 'Lidcombe', '09:26')),
  j(ride('T3', 'Strathfield', '09:20', 'Lidcombe', '09:27')),
]

describe('stitchAtHub', () => {
  it('pairs each way to the hub with the first-arriving onward trip that leaves after the change time', () => {
    const out = stitchAtHub(toStrathfield, onToLidcombe, 180)
    expect(out.map(lines)).toEqual([
      ['T9 08:45', 'T1 09:10'],
      ['T1 08:49', 'T1 09:13'],
      ['CCN 08:55', 'T2 09:19'],
    ])
  })

  it('never pairs a train with itself: staying on board is the direct trip', () => {
    const out = stitchAtHub(toStrathfield.slice(1, 2), onToLidcombe.slice(0, 1), 0)
    expect(out).toEqual([])
  })

  it('skips arrivals after the last known onward departure', () => {
    const late = [j(ride('T9', 'Wynyard', '09:10', 'Strathfield', '09:31'))]
    expect(stitchAtHub(late, onToLidcombe, 180)).toEqual([])
  })

  it('takes the later of two onward trips arriving together, for a roomier change', () => {
    const onward = [j(ride('T1', 'Strathfield', '09:12', 'Lidcombe', '09:20')), j(ride('T2', 'Strathfield', '09:14', 'Lidcombe', '09:20'))]
    const out = stitchAtHub(toStrathfield.slice(0, 1), onward, 180)
    expect(out.map(lines)).toEqual([['T9 08:45', 'T2 09:14']])
  })

  it('produces journeys the transfer check and option pruning understand', () => {
    const direct = [j(ride('T1', 'Wynyard', '08:49', 'Lidcombe', '09:16', 'T1-A')), j(ride('T1', 'Wynyard', '09:04', 'Lidcombe', '09:31'))]
    const stitched = stitchAtHub(toStrathfield, onToLidcombe, 180)
    expect(transfers(stitched[2])).toMatchObject([{ at: 'Strathfield', gapSec: 300 }])
    // The Central Coast train and a change at Strathfield fills the gap between the direct 08:49 and 09:04; the T1+T1
    // pairing is beaten by staying on that same T1.
    const kept = bestOptions([...direct, ...stitched]).map(lines)
    expect(kept).toContainEqual(['CCN 08:55', 'T2 09:19'])
    expect(kept).not.toContainEqual(['T1 08:49', 'T1 09:13'])
  })
})
