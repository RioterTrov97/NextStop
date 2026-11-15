import { describe, expect, it } from 'vitest'
import { brand, page, panel } from '../../shared/brand'
import { LINE_COLOURS, MODES } from './lines'
import { contrast, makeTint } from './tint'

const colours = [...new Set([...Object.values(LINE_COLOURS), ...MODES.map((m) => m.color)])]

describe('makeTint', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`keeps every line readable in ${mode} mode`, () => {
      for (const c of colours) {
        const t = makeTint(c, mode)
        expect(contrast(t.accent, panel[mode]), `${c} accent`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(t.onSolid, t.solid), `${c} button`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(t.onWash, t.wash), `${c} header`).toBeGreaterThanOrEqual(7)
        expect(contrast(t.onWashMuted, t.wash), `${c} header subtitle`).toBeGreaterThanOrEqual(4.5)
        // Buttons stand out from the page.
        expect(contrast(t.solid, page[mode]), `${c} button edge`).toBeGreaterThanOrEqual(3)
      }
    })
  }

  it('falls back to eucalyptus for grey lines', () => {
    expect(makeTint(LINE_COLOURS.T7, 'dark').base).toBe(brand[500])
    expect(makeTint(LINE_COLOURS.T1, 'dark').base).toBe(LINE_COLOURS.T1)
  })

  it('keeps the hue of the line', () => {
    // T1 orange stays warm, T4 blue stays blue.
    const warm = makeTint(LINE_COLOURS.T1, 'dark').wash
    const blue = makeTint(LINE_COLOURS.T4, 'dark').wash
    expect(parseInt(warm.slice(1, 3), 16)).toBeGreaterThan(parseInt(warm.slice(5, 7), 16))
    expect(parseInt(blue.slice(5, 7), 16)).toBeGreaterThan(parseInt(blue.slice(1, 3), 16))
  })
})
