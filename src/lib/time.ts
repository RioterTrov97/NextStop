const TZ = 'Australia/Sydney'

const partsFmt = new Intl.DateTimeFormat('en-AU', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const timeFmt = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })

/** The trip planner API expects Sydney-local date/time params but returns UTC ISO strings. */
export function toItd(d: Date): { itdDate: string; itdTime: string } {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]))
  return { itdDate: `${p.year}${p.month}${p.day}`, itdTime: `${p.hour}${p.minute}` }
}

export function formatTime(iso?: string): string {
  if (!iso) return '--'
  return timeFmt.format(new Date(iso)).replace(/\s?([ap])m/i, (_, x: string) => x.toLowerCase())
}

export const minutesBetween = (a: string | number | Date, b: string | number | Date) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)

/** Positive means late, negative means early. Undefined when there is no realtime estimate. */
export function delayMinutes(planned?: string, estimated?: string): number | undefined {
  if (!planned || !estimated) return undefined
  return minutesBetween(planned, estimated)
}

export function countdown(iso: string | undefined, now: number): string {
  if (!iso) return ''
  const secs = Math.round((new Date(iso).getTime() - now) / 1000)
  if (secs <= -60) return 'Departed'
  if (secs < 45) return 'Now'
  const mins = Math.max(1, Math.round(secs / 60))
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`
}

/** dd-MM-yyyy as used by the add_info filter. */
export function toAddInfoDate(d: Date): string {
  const { itdDate } = toItd(d)
  return `${itdDate.slice(6, 8)}-${itdDate.slice(4, 6)}-${itdDate.slice(0, 4)}`
}
