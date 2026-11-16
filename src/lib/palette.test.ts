import { describe, expect, it } from 'vitest'
import { ACCENTS, contrastRatio, makePalette, ORIGINAL, PRIMARY } from '../../shared/brand'

// Any seed must give a readable app, so the colour can later be chosen by the user.
const seeds = [...ACCENTS.map((a) => a.hex), PRIMARY, '#5A8573', '#E0452B', '#FFD400', '#7B4FE0', '#00B3B8', '#C4258F', '#22C55E', '#808080', '#000000', '#FFFFFF']

describe('makePalette', () => {
  for (const seed of seeds) {
    it(`keeps text readable for ${seed}`, () => {
      const p = makePalette(seed)
      // Buttons and links in light mode (white text on brand.600; brand.600 text on panels and the page).
      expect(contrastRatio('#FFFFFF', p.brand[600])).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(p.brand[600], p.page.light)).toBeGreaterThanOrEqual(4.5)
      // Dark mode: brand.400 text on panels (buttons are brand.600 with white text, as in light mode).
      expect(contrastRatio(p.brand[400], p.panel.dark)).toBeGreaterThanOrEqual(4.5)
      // Body and muted text in both modes.
      expect(contrastRatio(p.ink.light, p.panel.light)).toBeGreaterThanOrEqual(12)
      expect(contrastRatio(p.ink.dark, p.panel.dark)).toBeGreaterThanOrEqual(12)
      expect(contrastRatio(p.gray[600], p.page.light)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(p.gray[400], p.darkSurface.muted)).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('keeps the hue of the seed', () => {
    const blue = makePalette('#1A86F0').brand[600]
    expect(parseInt(blue.slice(5, 7), 16)).toBeGreaterThan(parseInt(blue.slice(1, 3), 16))
  })
})

describe('the original orange theme', () => {
  it('keeps text readable, with its lighter light-mode buttons', () => {
    const p = ORIGINAL
    // White on the orange buttons (and orange text on white) is about 3.2:1, kept deliberately (see ORIGINAL).
    expect(contrastRatio('#FFFFFF', p.brand[600])).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(p.brand[400], p.panel.dark)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(p.ink.light, p.panel.light)).toBeGreaterThanOrEqual(12)
    expect(contrastRatio(p.ink.dark, p.panel.dark)).toBeGreaterThanOrEqual(12)
    expect(contrastRatio(p.gray[600], p.page.light)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(p.gray[400], p.darkSurface.muted)).toBeGreaterThanOrEqual(4.5)
  })
})
