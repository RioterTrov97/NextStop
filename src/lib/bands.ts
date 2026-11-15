/**
 * Times of the week with distinct timetables, used by the bundled rail network (src/data/network.json) for how often
 * each stopping pattern runs. Hours are timetable hours: past midnight counts as 24+ of the day before, as in GTFS.
 * Shared with scripts/generate-stations.ts, so keep it free of imports.
 */
export const BANDS = [
  { name: 'weekday early', days: 'weekday', from: 3, to: 7 },
  { name: 'weekday morning peak', days: 'weekday', from: 7, to: 10 },
  { name: 'weekday daytime', days: 'weekday', from: 10, to: 15 },
  { name: 'weekday evening peak', days: 'weekday', from: 15, to: 19 },
  { name: 'weekday night', days: 'weekday', from: 19, to: 28 },
  { name: 'saturday', days: 'saturday', from: 3, to: 28 },
  { name: 'sunday', days: 'sunday', from: 3, to: 28 },
] as const

const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The band a moment falls in, in Sydney time; before 3am counts as the night before. */
export function bandAt(d: Date): number {
  const p = Object.fromEntries(parts.formatToParts(d).map((x) => [x.type, x.value]))
  let day = DAY.indexOf(p.weekday)
  let hour = Number(p.hour)
  if (hour < 3) {
    day = (day + 6) % 7
    hour += 24
  }
  const days = day === 6 ? 'saturday' : day === 0 ? 'sunday' : 'weekday'
  const i = BANDS.findIndex((b) => b.days === days && hour >= b.from && hour < b.to)
  return i < 0 ? 0 : i
}
