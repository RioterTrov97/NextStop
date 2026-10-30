import { describe, expect, it } from 'vitest'
import type { Alert, Journey, Leg } from '../api/types'
import { checkTime, dayImpact, matchingAlerts, sydneyTime, upcomingWeekend } from './weekend'

describe('weekend dates', () => {
  it('converts Sydney wall-clock times either side of daylight saving', () => {
    expect(sydneyTime('2026-10-31', 10, 0).toISOString()).toBe('2026-10-30T23:00:00.000Z')
    expect(sydneyTime('2026-07-04', 10, 0).toISOString()).toBe('2026-07-04T00:00:00.000Z')
  })

  it('warns from Thursday to Sunday only', () => {
    const at = (ymd: string) => sydneyTime(ymd, 9, 0).getTime()
    expect(upcomingWeekend(at('2026-10-27'))).toBeUndefined() // Tuesday
    expect(upcomingWeekend(at('2026-10-29'))?.days.map((d) => d.ymd)).toEqual(['2026-10-31', '2026-11-01']) // Thursday
    expect(upcomingWeekend(at('2026-10-31'))?.days.map((d) => d.label)).toEqual(['Saturday', 'Sunday'])
    expect(upcomingWeekend(at('2026-11-01'))).toMatchObject({ key: '2026-10-31', days: [{ label: 'Sunday' }] })
  })

  it('checks a trip at its usual time of day, or soon if that time has passed', () => {
    const sat = { ymd: '2026-10-31', label: 'Saturday' as const }
    expect(checkTime({ period: 'evening' }, sat, 0).toISOString()).toBe('2026-10-31T06:00:00.000Z')
    const lateSat = sydneyTime('2026-10-31', 21, 0).getTime()
    expect(checkTime({ period: 'morning' }, sat, lateSat).getTime()).toBe(lateSat + 5 * 60_000)
  })
})

const leg = (from: string, to: string, dep: string, arr: string, product: string, cls = 1): Leg => ({
  origin: {
    name: `${from} Station, Stand X1`,
    departureTimePlanned: dep,
    properties: { platform: 'X1', platformName: `${from} Station, George St` },
  },
  destination: { name: `${to} Station`, arrivalTimePlanned: arr },
  transportation: { disassembledName: '21CN', product: { class: cls, name: product } },
})

describe('dayImpact', () => {
  const sat = { ymd: '2026-10-31', label: 'Saturday' as const }
  const bus: Journey = { legs: [leg('Hornsby', 'Gosford', '2026-10-30T23:00:00Z', '2026-10-31T00:20:00Z', 'Temporary buses', 5)] }
  const train: Journey = { legs: [leg('Hornsby', 'Gosford', '2026-10-30T23:10:00Z', '2026-10-31T00:05:00Z', 'Sydney Trains Network')] }

  it('finds replacement bus legs, and says when every option needs one', () => {
    const impact = dayImpact(sat, [bus])
    expect(impact?.legs).toEqual([
      { from: 'Hornsby', to: 'Gosford', line: '21CN', stand: expect.objectContaining({ kind: 'replacement' }) },
    ])
    expect(impact?.unavoidable).toBe(true)
    expect(dayImpact(sat, [bus, train])?.unavoidable).toBe(false)
    expect(dayImpact(sat, [train])).toBeUndefined()
  })

  it('matches trackwork alerts in force that day that name a station on the bus legs', () => {
    const impact = dayImpact(sat, [bus])!
    const alert = (id: string, subtitle: string, from: string, to: string, type = 'trackwork'): Alert => ({
      id,
      subtitle,
      properties: { announcementType: type },
      timestamps: { validity: [{ from, to }] },
    })
    const alerts = [
      alert('a', 'Buses replace trains between Newcastle Interchange and Hornsby', '2026-10-30T14:00:00Z', '2026-11-01T15:00:00Z'),
      alert('b', 'Buses replace trains between Hornsby and Gosford', '2026-11-07T14:00:00Z', '2026-11-08T15:00:00Z'),
      alert('c', 'Lift outage at Hornsby', '2026-10-30T14:00:00Z', '2026-11-01T15:00:00Z', 'stopInfo'),
      alert('d', 'Buses replace trains between Lidcombe and Bankstown', '2026-10-30T14:00:00Z', '2026-11-01T15:00:00Z'),
    ]
    expect(matchingAlerts(alerts, impact).map((a) => a.id)).toEqual(['a'])
  })
})
