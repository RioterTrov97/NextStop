import { describe, expect, it } from 'vitest'
import { countdown, delayMinutes, formatDuration, formatTime, toItd } from './time'

describe('time helpers', () => {
  it('converts UTC instants to Sydney local itd params (AEDT)', () => {
    expect(toItd(new Date('2026-01-15T13:30:00Z'))).toEqual({ itdDate: '20260116', itdTime: '0030' })
  })

  it('converts UTC instants to Sydney local itd params (AEST)', () => {
    expect(toItd(new Date('2026-07-15T13:30:00Z'))).toEqual({ itdDate: '20260715', itdTime: '2330' })
  })

  it('formats times with a full am/pm suffix', () => {
    expect(formatTime('2026-07-15T22:05:00Z')).toBe('8:05 am')
    expect(formatTime('2026-07-15T08:30:00Z')).toBe('6:30 pm')
    expect(formatTime(undefined)).toBe('--')
  })

  it('computes delay only when an estimate exists', () => {
    expect(delayMinutes('2026-01-01T00:00:00Z', '2026-01-01T00:04:00Z')).toBe(4)
    expect(delayMinutes('2026-01-01T00:00:00Z', undefined)).toBeUndefined()
  })

  it('formats countdowns', () => {
    const now = Date.parse('2026-01-01T00:00:00Z')
    expect(countdown('2026-01-01T00:00:10Z', now)).toBe('Now')
    expect(countdown('2026-01-01T00:05:00Z', now)).toBe('5 min')
    expect(countdown('2025-12-31T23:50:00Z', now)).toBe('Departed')
    expect(countdown('2026-01-01T01:10:00Z', now)).toBe('1h 10m')
  })

  it('formats durations', () => {
    expect(formatDuration(1080)).toBe('18 min')
    expect(formatDuration(4500)).toBe('1h 15m')
  })
})
