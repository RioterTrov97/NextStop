import { describe, expect, it } from 'vitest'
import { lineColor, shortLineName } from './lines'

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

  it('uses the official code for lines the planner names in full', () => {
    // As returned live: number "Blue Mountains Line", disassembledName "BMT".
    expect(shortLineName('Blue Mountains Line')).toBe('BMT')
    expect(shortLineName('Central Coast & Newcastle Line')).toBe('CCN')
    expect(shortLineName('South Coast Line')).toBe('SCO')
    expect(shortLineName('Stkn Stockton Ferry')).toBe('STKN')
    expect(shortLineName('F1 Manly')).toBe('F1')
    expect(shortLineName(undefined)).toBe('·')
  })

  it('abbreviates other long names', () => {
    expect(shortLineName('Example Shuttle Service')).toBe('ESS')
  })
})

describe('lineColor', () => {
  it('uses the TfNSW colour chart, including lines named in full', () => {
    expect(lineColor('T6 Lidcombe & Bankstown Line', 1)).toBe('#7C3E21')
    expect(lineColor('L4 Westmead & Carlingford Line', 4)).toBe('#BB2043')
    expect(lineColor('Hunter Line', 1)).toBe('#833134')
    expect(lineColor('F10 Blackwattle Bay', 9)).toBe('#5AB031')
    expect(lineColor('NLR', 4)).toBe('#EE343F')
  })

  it('falls back to the mode colour for lines without one', () => {
    expect(lineColor('333', 5)).toBe('#00B5EF')
    expect(lineColor('MFF Manly Fast Ferry', 9)).toBe('#5AB031')
    expect(lineColor('TP1 Some Line', 1)).toBe('#F99D1C')
  })
})
