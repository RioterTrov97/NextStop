// Line tints: screens about a trip take the colour of its line, as Sangeet's player takes the colour of the artwork.
// Ported from Sangeet's palette maths (src/ui/palette in that project). Line badges keep the official colours
// unmodified (AGENTS.md); these colours are derived from them for surfaces only, with contrast checked here and in
// tint.test.ts so text stays readable on every line in both colour modes.

import type { CSSProperties } from 'react'
import { palette as defaultPalette, type Palette } from '../../shared/brand'

export type Rgb = { r: number; g: number; b: number }
export type ColourMode = 'light' | 'dark'

export function parseHex(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const n = m ? parseInt(m[1], 16) : 0x7f7f7f
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export const toHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

function toHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return { h: h * 60, s, l }
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

const clamp = (v: number) => Math.max(0, Math.min(1, v))

/** The colour with HSL saturation and lightness set or changed. */
export function adjust(hex: string, { s, l }: { s?: (s: number) => number; l?: (l: number) => number }): string {
  const c = toHsl(parseHex(hex))
  return toHex(fromHsl(c.h, clamp(s ? s(c.s) : c.s), clamp(l ? l(c.l) : c.l)))
}

const channel = (v: number) => {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** `a` moved towards `b` by `t` (0 to 1). */
export function mix(a: string, b: string, t: number): string {
  const A = parseHex(a)
  const B = parseHex(b)
  return toHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t })
}

const rgba = (hex: string, alpha: number) => {
  const { r, g, b } = parseHex(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Lightens (on dark backgrounds) or darkens (on light ones) until the colour reaches `ratio` against `on`. */
function readableOn(hex: string, on: string, ratio: number): string {
  const lighter = luminance(on) < 0.2
  let cur = hex
  for (let i = 0; i < 50 && contrast(cur, on) < ratio; i++) cur = adjust(cur, { l: (l) => l + (lighter ? 0.02 : -0.02) })
  return contrast(cur, on) >= ratio ? cur : lighter ? '#ffffff' : '#000000'
}

const blackOrWhite = (bg: string, ink: string) => (contrast('#ffffff', bg) >= contrast(ink, bg) ? '#ffffff' : ink)

export interface Tint {
  /** The line colour this tint was made from (or the app colour for grey lines). */
  base: string
  /** Top of a tinted screen's gradient, and the header of a tinted screen. */
  wash: string
  /** Text on `wash`. */
  onWash: string
  /** Muted text on `wash`, at least 4.5:1. */
  onWashMuted: string
  /** Text and icons in the line colour on the page and on panels: countdowns, links. At least 4.5:1. */
  accent: string
  /** Buttons in the line colour. */
  solid: string
  /** Text on `solid`, at least 4.5:1. */
  onSolid: string
  /** Glass tinted with the line, translucent. */
  glass: string
  /** The same glass when transparency is off. */
  glassSolid: string
  /** A faint wash of the line for cards in lists. */
  card: string
  /** The edge of a tinted card. */
  cardEdge: string
  /** A soft glow at the top of a page, in the line colour. */
  glow: string
}

/**
 * The tint for a line colour in a colour mode. Very grey lines (T7 is #6F818E) don't make a useful tint, so they fall
 * back to the app colour, like greyscale artwork in Sangeet.
 */
export function makeTint(lineHex: string, mode: ColourMode, pal: Palette = defaultPalette): Tint {
  const grey = toHsl(parseHex(lineHex)).s < 0.18
  const base = grey ? pal.brand[500] : lineHex
  const pageBg = pal.page[mode]
  const panelBg = pal.panel[mode]
  const ink = pal.ink.light
  if (mode === 'dark') {
    const wash = adjust(base, { s: (s) => Math.min(s, 0.55), l: () => 0.2 })
    const accent = readableOn(adjust(base, { s: (s) => Math.max(s, 0.5) }), panelBg, 4.5)
    // Bright enough to stand out from the page, then lighter still if dark text on it would fall short (mid reds).
    let solid = readableOn(adjust(base, { s: (s) => Math.max(s, 0.5) }), pageBg, 3)
    if (contrast(blackOrWhite(solid, ink), solid) < 4.5) solid = readableOn(solid, ink, 4.5)
    const onWash = '#ffffff'
    return {
      base,
      wash,
      onWash,
      onWashMuted: readableOn(mix(onWash, wash, 0.3), wash, 4.5),
      accent,
      solid,
      onSolid: blackOrWhite(solid, ink),
      glass: rgba(adjust(base, { s: (s) => Math.min(s, 0.5), l: () => 0.16 }), 0.62),
      glassSolid: adjust(base, { s: (s) => Math.min(s, 0.4), l: () => 0.14 }),
      card: rgba(base, 0.1),
      cardEdge: rgba(base, 0.28),
      glow: rgba(base, 0.24),
    }
  }
  const wash = adjust(base, { s: (s) => Math.min(s, 0.7), l: () => 0.91 })
  const onWash = ink
  const accent = readableOn(base, panelBg, 4.5)
  return {
    base,
    wash,
    onWash,
    onWashMuted: readableOn(mix(onWash, wash, 0.35), wash, 4.5),
    accent,
    solid: accent,
    onSolid: blackOrWhite(accent, ink),
    glass: rgba(adjust(base, { s: (s) => Math.min(s, 0.7), l: () => 0.95 }), 0.7),
    glassSolid: adjust(base, { s: (s) => Math.min(s, 0.6), l: () => 0.96 }),
    card: rgba(base, 0.07),
    cardEdge: rgba(base, 0.22),
    glow: rgba(base, 0.18),
  }
}

/** CSS variables for a tinted area. Children read them (`var(--ns-tint-accent)`), and glass inside picks up the tint. */
export function tintVars(t: Tint): CSSProperties {
  return {
    '--ns-tint-wash': t.wash,
    '--ns-tint-on-wash': t.onWash,
    '--ns-tint-on-wash-muted': t.onWashMuted,
    '--ns-tint-accent': t.accent,
    '--ns-tint-solid': t.solid,
    '--ns-tint-on-solid': t.onSolid,
    '--ns-tint-card': t.card,
    '--ns-tint-card-edge': t.cardEdge,
    '--ns-glass-tint': t.glass,
    '--ns-glass-solid-tint': t.glassSolid,
  } as CSSProperties
}

/**
 * The background of a tinted screen: the first line's wash fading into the page, through the last line's wash when a
 * trip changes to a different line colour.
 */
export function tintGradient(
  first: Tint,
  last: Tint | undefined,
  mode: ColourMode,
  height = '320px',
  pal: Palette = defaultPalette,
): string {
  const end = pal.page[mode]
  if (last && last.base !== first.base) return `linear-gradient(165deg, ${first.wash} 0%, ${last.wash} 50%, ${end} ${height})`
  return `linear-gradient(180deg, ${first.wash} 0%, ${mix(first.wash, end, 0.55)} calc(${height} * 0.5), ${end} ${height})`
}

/** A card's faint wash: the first line's colour from the left, fading out, through the last line's when they differ. */
export function cardWash(first: Tint, last?: Tint): string {
  if (last && last.base !== first.base) return `linear-gradient(100deg, ${first.card} 0%, ${last.card} 60%, transparent 100%)`
  return `linear-gradient(100deg, ${first.card} 0%, transparent 85%)`
}
