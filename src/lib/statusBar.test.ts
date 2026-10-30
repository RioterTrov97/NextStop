import { describe, expect, it } from 'vitest'
import { darken } from './statusBar'

describe('darken', () => {
  it('matches the brand orange seen through the 36% sheet backdrop', () => {
    expect(darken('#EA6A12', 0.36)).toBe('#96440c')
  })

  it('leaves the colour alone with no overlay and ignores non-hex values', () => {
    expect(darken('#EA6A12', 0)).toBe('#ea6a12')
    expect(darken('rebeccapurple', 0.5)).toBe('rebeccapurple')
  })
})
