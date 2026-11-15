/**
 * Opal fare estimates, worked out on the device. The trip planner stopped returning fares in October 2023, so this
 * follows TfNSW's "Opal Fares Business Rules" and fare values (Open Data Hub, "Opal Fares" dataset):
 *
 * - Train and metro: band from the official over-the-track distance between where you tap on and off
 *   (src/data/fares.json, regenerated with `npm run fares`). Changing between trains, or train and metro, is one trip.
 * - Bus, light rail and ferry: band from the straight-line distance between stops. Changing between services of the
 *   same mode within 60 minutes costs the band of the furthest point reached from the first stop (Opal Trip Advantage).
 * - 30% off-peak discount on everything except ferries: always on Fridays, weekends and public holidays.
 * - $2 off ($1 for reduced fares) for each change of mode within 60 minutes.
 * - The daily cap limits a journey's fare; the Sydney Airport station access fee is added on top.
 *
 * Fare values change most Julys: update FARES_FROM and the tables below from the dataset's newest "Opal Fare Values"
 * sheet, and run `npm run fares` for any new track distances.
 */
import type { Journey, Leg, StopPoint } from '../api/types'
import { isReplacementBus } from './platforms'

export const FARES_FROM = '29 June 2026'

export type FareType = 'adult' | 'child' | 'concession' | 'senior'
export const FARE_TYPES: { key: FareType; label: string }[] = [
  { key: 'adult', label: 'Adult' },
  { key: 'child', label: 'Child/Youth' },
  { key: 'concession', label: 'Concession' },
  { key: 'senior', label: 'Senior/Pensioner' },
]

export interface FareData {
  /** Train and metro station ids (the planner's stop ids). */
  stations: string[]
  /** Fare band 1-5 for every pair, lower triangle, row by row: pair (i, j) with j < i is at i*(i-1)/2 + j. */
  bands: string
  /** Stations with Intercity peak times (from 6am, not 6:30). */
  intercity: string[]
}

export type FareMode = 'rail' | 'bus' | 'lightrail' | 'ferry'

/** Cents, [peak, off-peak] per band, from "Opal Fare Values 29 June 2026". Ferries have no off-peak discount. */
const ADULT: Record<FareMode, [number, number][]> = {
  rail: [
    [433, 303],
    [538, 376],
    [620, 434],
    [828, 579],
    [1066, 746],
  ],
  bus: [
    [330, 231],
    [449, 314],
    [577, 403],
  ],
  lightrail: [
    [330, 231],
    [449, 314],
    [577, 403],
  ],
  ferry: [
    [735, 735],
    [920, 920],
  ],
}
/** Child/Youth, Concession and Senior/Pensioner fares. */
const REDUCED: Record<FareMode, [number, number][]> = {
  rail: [
    [216, 151],
    [269, 188],
    [310, 217],
    [414, 289],
    [533, 373],
  ],
  bus: [
    [165, 115],
    [224, 156],
    [288, 201],
  ],
  lightrail: [
    [165, 115],
    [224, 156],
    [288, 201],
  ],
  ferry: [
    [367, 367],
    [460, 460],
  ],
}
/** Upper limits of each band in km; the last band has none. */
const BAND_KM: Record<Exclude<FareMode, 'rail'>, number[]> = { bus: [3, 8], lightrail: [3, 8], ferry: [9] }
/** Off for each change of mode. */
const TRANSFER_DISCOUNT: Record<FareType, number> = { adult: 200, child: 100, concession: 100, senior: 100 }
/** Daily caps in cents: Monday to Thursday, and Fridays, weekends and public holidays. */
const DAILY_CAP: Record<FareType, [number, number]> = {
  adult: [1930, 965],
  child: [965, 480],
  concession: [965, 480],
  senior: [250, 250],
}
/** Journeys and transfers must continue within this long of the last tap off. */
const TRANSFER_WINDOW_MS = 60 * 60_000

const DOMESTIC = '202020'
const INTERNATIONAL = '202030'
const AIRPORTS = [DOMESTIC, INTERNATIONAL]
const GREEN_SQUARE = '201710'
const MASCOT = '202010'

/** Sydney Airport station access fee in cents, by the other end of the trip. */
function airportFee(a: string, b: string, type: FareType): number {
  if (!AIRPORTS.includes(a) && !AIRPORTS.includes(b)) return 0
  const other = AIRPORTS.includes(a) ? b : a
  if (AIRPORTS.includes(other)) return 520
  if (other === GREEN_SQUARE) return 1274
  if (other === MASCOT) return 1034
  return type === 'adult' ? 1861 : 1664
}

/**
 * NSW public holidays from Monday to Thursday (the rest are off-peak anyway), from nsw.gov.au. Add the next year's
 * when fares are updated; a missing holiday only means a peak fare where off-peak applies.
 */
const HOLIDAYS = new Set([
  '2026-01-01',
  '2026-01-26',
  '2026-04-06',
  '2026-04-27',
  '2026-06-08',
  '2026-10-05',
  '2026-12-28',
  '2027-01-26',
  '2027-03-29',
  '2027-04-26',
  '2027-06-14',
  '2027-10-04',
  '2027-12-27',
  '2027-12-28',
])

const sydney = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Sydney',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
})

function local(ms: number) {
  const p = Object.fromEntries(sydney.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, day: p.weekday, min: Number(p.hour) * 60 + Number(p.minute) }
}

/** Monday to Thursday and not a public holiday: the only days with peak fares and the higher daily cap. */
const isWorkday = (t: { date: string; day: string }) => ['Mon', 'Tue', 'Wed', 'Thu'].includes(t.day) && !HOLIDAYS.has(t.date)

/** Peak times: 6:30 (6:00 from Intercity stations) to 10am and 3 to 7pm, Monday to Thursday. */
export function isPeak(ms: number, intercity = false): boolean {
  const t = local(ms)
  if (!isWorkday(t)) return false
  return (t.min >= (intercity ? 360 : 390) && t.min < 600) || (t.min >= 900 && t.min < 1140)
}

// Not imported from ./journey: that imports the settings store, which imports this file.
const isTransit = (l: Leg) => (l.transportation?.product?.class ?? 99) < 99
const stationOf = (p: StopPoint) => (p.parent?.type === 'stop' && p.parent.id ? p.parent.id : p.id)
const depart = (l: Leg) => Date.parse(l.origin.departureTimePlanned ?? '')
const arrive = (l: Leg) => Date.parse(l.destination.arrivalTimePlanned ?? '')

/** Straight-line km between two [lat, lon] points. */
function km(a?: [number, number], b?: [number, number]): number | undefined {
  if (!a || !b) return undefined
  const rad = Math.PI / 180
  const dLat = (b[0] - a[0]) * rad
  const dLon = (b[1] - a[1]) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

/** How Opal charges a ride, or undefined when it isn't an Opal fare (private ferries, coaches, regional trains). */
function fareMode(l: Leg): FareMode | undefined {
  const t = l.transportation
  const cls = t?.product?.class
  const product = t?.product?.name ?? ''
  if (cls === 1 || cls === 2) return 'rail'
  // Trackwork buses replacing trains are charged as the train journey they replace.
  if (cls === 5 && isReplacementBus(t)) return 'rail'
  if (cls === 5 || cls === 11) return 'bus'
  if (cls === 4) return 'lightrail'
  if (cls === 9) {
    if (/private/i.test(product)) return undefined
    // The Stockton ferry in Newcastle uses bus fares and counts as a bus for transfers.
    if (/newcastle/i.test(product)) return 'bus'
    return 'ferry'
  }
  return undefined
}

function railBand(data: FareData, a: string, b: string): number | undefined {
  let i = data.stations.indexOf(a)
  let j = data.stations.indexOf(b)
  if (i < 0 || j < 0) return undefined
  if (i === j) return 1
  if (i < j) [i, j] = [j, i]
  return Number(data.bands[(i * (i - 1)) / 2 + j])
}

function bandFor(mode: Exclude<FareMode, 'rail'>, distance: number): number {
  const limits = BAND_KM[mode]
  const i = limits.findIndex((max) => distance <= max)
  return (i < 0 ? limits.length : i) + 1
}

/** One fare charged on the way: consecutive rides of the same mode, which Opal charges as one. */
export interface FarePart {
  mode: FareMode
  /** The rides it covers, in order. */
  legs: Leg[]
  /** Fare band (1 is the shortest) and its distance range, e.g. "10-20 km". */
  band: number
  distance: string
  peak: boolean
  /** The full fare for this part, in cents, before the transfer discount. */
  cents: number
  /** Taken off this part for changing from another mode, in cents. */
  discount: number
  /** Over an hour after the previous part: Opal starts a new journey, with no transfer discount. */
  newJourney: boolean
}

export interface FareEstimate {
  /** Total in cents, discounts, caps and the airport fee included. */
  cents: number
  /** Each fare charged on the way, for the breakdown in trip details. */
  parts: FarePart[]
  /** Taken off by the daily cap, in cents. */
  capOff: number
  type: FareType
  /** Some of it is charged at peak fares. */
  peak: boolean
  /** Transfer discounts taken off, in cents. */
  discount: number
  /** Sydney Airport station access fee included, in cents. */
  airportFee: number
  /** The daily cap brought the fare down. */
  capped: boolean
}

interface Segment {
  mode: FareMode
  legs: Leg[]
}

/** Consecutive rides charged together: same mode, each boarded within 60 minutes of the last. */
function segments(legs: Leg[]): Segment[] | undefined {
  const out: Segment[] = []
  for (const l of legs) {
    const mode = fareMode(l)
    if (!mode) return undefined
    const last = out[out.length - 1]
    const prev = last?.legs[last.legs.length - 1]
    if (last && last.mode === mode && depart(l) - arrive(prev!) <= TRANSFER_WINDOW_MS) last.legs.push(l)
    else out.push({ mode, legs: [l] })
  }
  return out
}

/** "10-20 km" for a band. */
function bandRange(mode: FareMode, band: number): string {
  const limits = mode === 'rail' ? [10, 20, 35, 65] : BAND_KM[mode]
  const lo = band > 1 ? limits[band - 2] : 0
  return band > limits.length ? `over ${lo} km` : `${lo}-${limits[band - 1]} km`
}

/** One segment's fare in cents before transfer discounts, or undefined when it can't be worked out. */
function segmentFare(data: FareData, s: Segment, type: FareType): { cents: number; band: number; peak: boolean; fee: number } | undefined {
  const first = s.legs[0]
  const table = (type === 'adult' ? ADULT : REDUCED)[s.mode]
  if (s.mode === 'rail') {
    const from = stationOf(first.origin)
    const to = stationOf(s.legs[s.legs.length - 1].destination)
    if (!from || !to) return undefined
    const band = railBand(data, from, to)
    if (!band) return undefined
    const peak = isPeak(depart(first), data.intercity.includes(from))
    return { cents: table[band - 1][peak ? 0 : 1], band, peak, fee: airportFee(from, to, type) }
  }
  // The band of the furthest stop reached from where the segment started.
  let band = 0
  for (const l of s.legs) {
    const d = km(first.origin.coord, l.destination.coord)
    if (d === undefined) return undefined
    band = Math.max(band, bandFor(s.mode, d))
  }
  const peak = s.mode !== 'ferry' && isPeak(depart(first))
  return { cents: table[band - 1][peak ? 0 : 1], band, peak, fee: 0 }
}

/**
 * The Opal fare for a journey, paying with an Opal card or a contactless card. Undefined when any ride isn't charged
 * Opal fares or can't be placed, so the app never shows a partial total.
 */
export function estimateFare(data: FareData, journey: Journey, type: FareType): FareEstimate | undefined {
  const rides = journey.legs.filter(isTransit)
  if (rides.length === 0) return undefined
  const segs = segments(rides)
  if (!segs) return undefined

  let total = 0
  let fees = 0
  let discount = 0
  let capOff = 0
  let peak = false
  const parts: FarePart[] = []
  // Journeys restart after a gap over an hour: no discount across it, and each has its own cap (an estimate per day).
  let journeyTotal = 0
  let journeyStart = depart(segs[0].legs[0])
  const close = () => {
    const cap = DAILY_CAP[type][isWorkday(local(journeyStart - 4 * 3600_000)) ? 0 : 1]
    capOff += Math.max(0, journeyTotal - cap)
    total += Math.min(journeyTotal, cap)
  }
  for (let i = 0; i < segs.length; i++) {
    const f = segmentFare(data, segs[i], type)
    if (!f) return undefined
    peak ||= f.peak
    fees += f.fee
    let off = 0
    let newJourney = false
    const prev = segs[i - 1]
    if (prev) {
      const gap = depart(segs[i].legs[0]) - arrive(prev.legs[prev.legs.length - 1])
      if (gap > TRANSFER_WINDOW_MS) {
        close()
        journeyTotal = 0
        journeyStart = depart(segs[i].legs[0])
        newJourney = true
      } else {
        // A change of mode, since same-mode rides within the window are already one segment.
        off = Math.min(f.cents, TRANSFER_DISCOUNT[type])
        discount += off
      }
    }
    journeyTotal += f.cents - off
    parts.push({
      mode: segs[i].mode,
      legs: segs[i].legs,
      band: f.band,
      distance: bandRange(segs[i].mode, f.band),
      peak: f.peak,
      cents: f.cents,
      discount: off,
      newJourney,
    })
  }
  close()
  return { cents: total + fees, parts, capOff, type, peak, discount, airportFee: fees, capped: capOff > 0 }
}

export const formatFare = (cents: number) => `$${(cents / 100).toFixed(2)}`

let fares: Promise<FareData> | undefined
/** The distance bands, loaded once on first use (about 5KB compressed). */
export const loadFares = () =>
  (fares ??= import('../data/fares.json')
    .then((m) => m.default as unknown as FareData)
    .catch((e: unknown) => {
      fares = undefined
      throw e
    }))
