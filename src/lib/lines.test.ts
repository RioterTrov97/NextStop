import { describe, expect, it } from 'vitest'
import { shortLineName } from './lines'

describe('shortLineName', () => {
  it('reduces full line names to their code', () => {
    expect(shortLineName('T2 Inner West & Leppington Line')).toBe('T2')
    expect(shortLineName('M1 Metro North West & Bankstown Line')).toBe('M1')
    expect(shortLineName('L1')).toBe('L1')
  })

  it('keeps short codes and bus numbers', () => {
    expect(shortLineName('333')).toBe('333')
    expect(shortLineName('BMT Blue Mountains Line')).toBe('BMT')
  })

  it('abbreviates long names without a code', () => {
    expect(shortLineName('South Coast Line')).toBe('SC')
    expect(shortLineName(undefined)).toBe('·')
  })
})
