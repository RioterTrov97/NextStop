import { describe, expect, it } from 'vitest'
import type { Journey, Leg } from '../api/types'
import data from '../data/fares.json'
import { estimateFare, isPeak, type FareData } from './fares'

const fares = data as unknown as FareData

const LIDCOMBE = '214110'
const WYNYARD = '200080'
const CENTRAL = '200060'
const INTERNATIONAL = '202030'

// Sydney wall-clock times (AEDT, UTC+11) as planner timestamps.
const TUE_9AM = '2026-11-16T22:00:00Z'
const FRI_9AM = '2026-11-19T22:00:00Z'
const HOLIDAY_MON_9AM = '2026-12-27T22:00:00Z'
const SAT_9AM = '2026-11-20T22:00:00Z'
const plus = (iso: string, min: number) => new Date(Date.parse(iso) + min * 60_000).toISOString()

const train = (from: string, to: string, dep: string, min = 20, cls = 1, product = 'Sydney Trains Network'): Leg => ({
  origin: { id: `${from}1`, parent: { id: from, type: 'stop' }, departureTimePlanned: dep },
  destination: { id: `${to}1`, parent: { id: to, type: 'stop' }, arrivalTimePlanned: plus(dep, min) },
  transportation: { number: 'T1', product: { class: cls, name: product } },
})

const ride = (cls: number, product: string, from: [number, number], to: [number, number], dep: string, min = 15): Leg => ({
  origin: { id: 'a', coord: from, departureTimePlanned: dep },
  destination: { id: 'b', coord: to, arrivalTimePlanned: plus(dep, min) },
  transportation: { number: 'X', product: { class: cls, name: product } },
})
const bus = (from: [number, number], to: [number, number], dep: string, min?: number) => ride(5, 'Sydney Buses Network', from, to, dep, min)

const walk = (dep: string, min = 5): Leg => ({
  origin: { departureTimePlanned: dep },
  destination: { arrivalTimePlanned: plus(dep, min) },
  transportation: { product: { class: 100, name: 'footpath' } },
})

const fare = (legs: Leg[], type: 'adult' | 'child' | 'concession' | 'senior' = 'adult') => estimateFare(fares, { legs } as Journey, type)

describe('peak times', () => {
  it('is peak 6:30 to 10am and 3 to 7pm, Monday to Thursday', () => {
    expect(isPeak(Date.parse(TUE_9AM))).toBe(true)
    expect(isPeak(Date.parse(plus(TUE_9AM, -160)))).toBe(false) // 6:20am
    expect(isPeak(Date.parse(plus(TUE_9AM, 60)))).toBe(false) // 10am
    expect(isPeak(Date.parse(plus(TUE_9AM, 9 * 60)))).toBe(true) // 6pm
  })

  it('starts at 6am from Intercity stations', () => {
    expect(isPeak(Date.parse(plus(TUE_9AM, -170)), true)).toBe(true) // 6:10am
    expect(isPeak(Date.parse(plus(TUE_9AM, -170)), false)).toBe(false)
  })

  it('is off-peak all day on Fridays, weekends and public holidays', () => {
    expect(isPeak(Date.parse(FRI_9AM))).toBe(false)
    expect(isPeak(Date.parse(SAT_9AM))).toBe(false)
    expect(isPeak(Date.parse(HOLIDAY_MON_9AM))).toBe(false)
  })
})

describe('estimateFare', () => {
  it('charges trains by the official track distance band', () => {
    // Lidcombe to Wynyard is 18.59km over the track: band 2.
    expect(fare([train(LIDCOMBE, WYNYARD, TUE_9AM)])).toMatchObject({ cents: 538, peak: true, discount: 0 })
    expect(fare([train(LIDCOMBE, WYNYARD, FRI_9AM)])).toMatchObject({ cents: 376, peak: false })
    expect(fare([train(LIDCOMBE, WYNYARD, TUE_9AM)], 'child')?.cents).toBe(269)
  })

  it('treats changing trains, or train and metro, as one trip from first to last station', () => {
    const legs = [train(LIDCOMBE, CENTRAL, TUE_9AM), walk(plus(TUE_9AM, 20)), train(CENTRAL, WYNYARD, plus(TUE_9AM, 28), 5, 2)]
    expect(fare(legs)).toMatchObject({ cents: 538, discount: 0 })
  })

  it('takes the transfer discount off each change of mode', () => {
    // Train band 2 at peak ($5.38), then a 5.6km bus ($4.49), less $2.
    const legs = [train(LIDCOMBE, CENTRAL, TUE_9AM), bus([-33.88, 151.2], [-33.93, 151.2], plus(TUE_9AM, 25))]
    expect(fare(legs)).toMatchObject({ cents: 538 + 449 - 200, discount: 200 })
    expect(fare(legs, 'concession')).toMatchObject({ cents: 269 + 224 - 100, discount: 100 })
  })

  it('charges buses in one go by the furthest point reached from the first stop', () => {
    // 5.6km then on to 11.1km from the first stop: band 3 off-peak for the whole journey.
    const legs = [bus([-33.8, 151.2], [-33.85, 151.2], FRI_9AM), bus([-33.85, 151.2], [-33.9, 151.2], plus(FRI_9AM, 20))]
    expect(fare(legs)).toMatchObject({ cents: 403, discount: 0 })
    // Coming back towards the start doesn't lower it below the first ride's band.
    const back = [bus([-33.8, 151.2], [-33.85, 151.2], FRI_9AM), bus([-33.85, 151.2], [-33.81, 151.2], plus(FRI_9AM, 20))]
    expect(fare(back)?.cents).toBe(314)
  })

  it('starts a new journey after more than an hour', () => {
    const legs = [train(LIDCOMBE, CENTRAL, FRI_9AM), bus([-33.88, 151.2], [-33.93, 151.2], plus(FRI_9AM, 90))]
    expect(fare(legs)).toMatchObject({ cents: 376 + 314, discount: 0 })
  })

  it('has no off-peak discount on Sydney Ferries', () => {
    // Circular Quay to Manly is about 9.5km: ferry band 2.
    const f = ride(9, 'Sydney Ferries Network', [-33.861, 151.211], [-33.8, 151.284], FRI_9AM, 30)
    expect(fare([f])).toMatchObject({ cents: 920, peak: false })
  })

  it('adds the airport station access fee on top', () => {
    const f = fare([train(CENTRAL, INTERNATIONAL, TUE_9AM, 12)])
    expect(f?.airportFee).toBe(1861)
    expect(f!.cents - 1861).toBe(433)
    expect(fare([train(CENTRAL, INTERNATIONAL, TUE_9AM, 12)], 'concession')?.airportFee).toBe(1664)
  })

  it('caps the fare at the daily cap', () => {
    expect(fare([train(LIDCOMBE, WYNYARD, TUE_9AM)], 'senior')).toMatchObject({ cents: 250, capped: true })
    // Saturday: ferry $9.20 then a long train, less $2, is over the $9.65 weekend cap.
    const legs = [
      ride(9, 'Sydney Ferries Network', [-33.8, 151.284], [-33.861, 151.211], SAT_9AM, 30),
      train(CENTRAL, LIDCOMBE, plus(SAT_9AM, 40)),
    ]
    expect(fare(legs)).toMatchObject({ cents: 965, capped: true })
  })

  it('gives no fare when a ride is not an Opal fare or can not be placed', () => {
    const privateFerry = ride(9, 'Private ferry and fast ferry services', [-33.861, 151.211], [-33.8, 151.284], FRI_9AM)
    expect(fare([privateFerry])).toBeUndefined()
    expect(fare([train(LIDCOMBE, '999999', TUE_9AM)])).toBeUndefined()
    expect(fare([ride(7, 'Coach', [-33.8, 151.2], [-33.9, 151.2], TUE_9AM)])).toBeUndefined()
    expect(fare([walk(TUE_9AM)])).toBeUndefined()
  })

  it('charges replacement buses as the train trip they replace, and Stockton ferry as a bus', () => {
    const replacement = train(LIDCOMBE, WYNYARD, FRI_9AM, 40, 5, 'Temporary buses')
    expect(fare([replacement])?.cents).toBe(376)
    const stockton = ride(9, 'Newcastle Ferries', [-32.925, 151.785], [-32.93, 151.78], FRI_9AM, 5)
    expect(fare([stockton])?.cents).toBe(231)
  })
})
