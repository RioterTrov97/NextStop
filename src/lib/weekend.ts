import type { Alert, Journey, Leg } from '../api/types'
import type { SavedTrip } from '../store/savedTrips'
import { isTransit, stationName, stripHtml, summarize } from './journey'
import { isReplacementBus, platformInfo, type PlatformInfo } from './platforms'

const TZ = 'Australia/Sydney'
const dayFmt = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
const offsetFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })

interface SydneyDay {
  /** YYYY-MM-DD in Sydney. */
  ymd: string
  weekday: number
}

function sydneyDay(ms: number): SydneyDay {
  const p = Object.fromEntries(dayFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return { ymd: `${p.year}-${p.month}-${p.day}`, weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) }
}

/** The instant a Sydney wall-clock time happens, daylight saving included. */
export function sydneyTime(ymd: string, hh: number, mm: number): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  const naive = Date.UTC(y, m - 1, d, hh, mm)
  const offsetAt = (ms: number) => {
    const o = offsetFmt
      .formatToParts(new Date(ms))
      .find((x) => x.type === 'timeZoneName')
      ?.value.match(/GMT([+-])(\d{2}):(\d{2})/)
    return o ? (o[1] === '-' ? -1 : 1) * (Number(o[2]) * 60 + Number(o[3])) * 60_000 : 0
  }
  // Twice, so a time just after a daylight-saving change uses the offset in force at that time.
  const first = naive - offsetAt(naive)
  return new Date(naive - offsetAt(first))
}

const addDays = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export interface WeekendDay {
  ymd: string
  label: 'Saturday' | 'Sunday'
}

/**
 * The weekend days worth warning about: from Thursday, the coming Saturday and Sunday; on Saturday both;
 * on Sunday just that day. Monday to Wednesday is too early to bother anyone. `key` names the weekend, for dismissal.
 */
export function upcomingWeekend(now: number): { key: string; days: WeekendDay[] } | undefined {
  const { ymd, weekday } = sydneyDay(now)
  const toSat = { 4: 2, 5: 1, 6: 0, 0: -1 }[weekday as 0 | 4 | 5 | 6]
  if (toSat === undefined) return undefined
  const sat = addDays(ymd, toSat)
  const days: WeekendDay[] = [
    { ymd: sat, label: 'Saturday' },
    { ymd: addDays(sat, 1), label: 'Sunday' },
  ]
  return { key: sat, days: weekday === 0 ? days.slice(1) : days }
}

/** When on that day to check a saved trip: its usual time of day, or late morning for an all-day trip. */
export function checkTime(trip: Pick<SavedTrip, 'period'>, day: WeekendDay, now: number): Date {
  const [hh, mm] = { morning: [8, 30], afternoon: [13, 0], evening: [17, 0], night: [20, 0] }[trip.period as string] ?? [10, 0]
  const at = sydneyTime(day.ymd, hh, mm)
  // Later today rather than a time that has already gone.
  return at.getTime() < now ? new Date(now + 5 * 60_000) : at
}

export interface ReplacementLeg {
  from: string
  to: string
  line?: string
  stand?: PlatformInfo
}

export const replacementLegs = (j: Journey): ReplacementLeg[] =>
  j.legs
    .filter((l: Leg) => isTransit(l) && isReplacementBus(l.transportation))
    .map((l) => ({
      from: stationName(l.origin),
      to: stationName(l.destination),
      line: l.transportation?.disassembledName ?? l.transportation?.number,
      stand: platformInfo(l.origin, l.transportation),
    }))

export interface DayImpact {
  day: WeekendDay
  /** The fastest planned trip that uses a replacement bus, and its bus legs. */
  journey: Journey
  legs: ReplacementLeg[]
  /** True when every option the planner offered uses one, so there is no way around it. */
  unavoidable: boolean
  durationSec: number
}

/** Whether the weekend plan for a trip needs replacement buses, and on which legs. */
export function dayImpact(day: WeekendDay, journeys: Journey[]): DayImpact | undefined {
  const withBus = journeys.filter((j) => replacementLegs(j).length > 0)
  if (!withBus.length) return undefined
  const best = [...withBus].sort((a, b) => Date.parse(summarize(a).arrPlanned ?? '') - Date.parse(summarize(b).arrPlanned ?? ''))[0]
  return {
    day,
    journey: best,
    legs: replacementLegs(best),
    unavoidable: withBus.length === journeys.length,
    durationSec: summarize(best).durationSec,
  }
}

/** Trackwork alerts in force that day which mention a station where the replacement buses start or end. */
export function matchingAlerts(alerts: Alert[], impact: DayImpact): Alert[] {
  const dayStart = sydneyTime(impact.day.ymd, 0, 0).getTime()
  const dayEnd = dayStart + 24 * 3600_000
  const names = [...new Set(impact.legs.flatMap((l) => [l.from, l.to]))].filter((n) => n.length > 2)
  return alerts.filter((a) => {
    if (a.properties?.announcementType !== 'trackwork') return false
    const windows = a.timestamps?.validity ?? []
    if (windows.length && !windows.some((w) => Date.parse(w.from ?? '') < dayEnd && Date.parse(w.to ?? '') > dayStart)) return false
    const text = `${a.subtitle ?? ''} ${stripHtml(a.content)}`.toLowerCase()
    return names.some((n) => text.includes(n.toLowerCase()))
  })
}
