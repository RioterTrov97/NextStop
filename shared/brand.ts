// Single source of truth for the app's colours. Theme, manifest, <meta theme-color>, the status bar strip, icon
// backgrounds and the logo all derive from this.
//
// Every colour comes from one seed, PRIMARY: the accent scale, the neutrals (which lean towards its hue), the page,
// panel and text colours, and the backdrop behind the glass. To change the app's colour, change PRIMARY and run
// `npm run icons`. `makePalette` is pure and checked for contrast on many seeds in palette.test.ts, so a colour chosen
// by the user at runtime can use it too.

/** Harbour blue. */
export const PRIMARY = '#1A86F0'

/** App colours people can choose in Settings; the first is the default (PRIMARY). */
export const ACCENTS = [
  { key: 'harbour', label: 'Harbour', hex: PRIMARY },
  { key: 'bondi', label: 'Bondi', hex: '#00A6B0' },
  { key: 'eucalyptus', label: 'Eucalyptus', hex: '#3E8E6E' },
  { key: 'wattle', label: 'Wattle', hex: '#E0A100' },
  { key: 'sunset', label: 'Sunset', hex: '#EE5A36' },
  { key: 'waratah', label: 'Waratah', hex: '#D6264A' },
  { key: 'jacaranda', label: 'Jacaranda', hex: '#7B4FE0' },
  { key: 'graphite', label: 'Graphite', hex: '#5F6B7A' },
  // The app's first colour, orange on plain greys, kept exactly as it was (see ORIGINAL below).
  { key: 'original', label: 'Original', hex: '#F97316' },
] as const

export type AccentKey = (typeof ACCENTS)[number]['key']

type Scale = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string>
type Modes<T> = { light: T; dark: T }

export interface Palette {
  /** The accent scale. 600 is the light-mode accent (white text at least 4.5:1), 300 the dark-mode one (dark text). */
  brand: Scale
  /** Neutrals leaning slightly towards the accent's hue, replacing Chakra's grey scale. */
  gray: Scale
  /** The page background, which the solid header and the iPhone status bar share. */
  page: Modes<string>
  /** Cards and panels on the page. */
  panel: Modes<string>
  /** Default text on the page. */
  ink: Modes<string>
  /** Raised dark surfaces: bg.subtle, bg.muted, bg.emphasized, border, border.muted. */
  darkSurface: { subtle: string; muted: string; emphasized: string; border: string; borderMuted: string }
  /** Soft colour fixed behind the page so glass has something to blur: the accent, a neighbouring hue, the accent again. */
  backdrop: Modes<[string, string, string]>
}

// Colour maths kept here, without imports, so build scripts can load this file directly with Node.

const hexToHsl = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const n = m ? parseInt(m[1], 16) : 0x7f7f7f
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: h * 60, s, l }
}

const hsl = (h: number, s: number, l: number): string => {
  h = ((h % 360) + 360) % 360
  s = Math.max(0, Math.min(1, s))
  l = Math.max(0, Math.min(1, l))
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255)
}

/** WCAG contrast ratio, 1 to 21. */
export const contrastRatio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** The lightness `l` moved by `step` until the colour reaches `ratio` against `on`. */
const reach = (h: number, s: number, l: number, on: string, ratio: number, step: number) => {
  let cur = l
  for (let i = 0; i < 100 && contrastRatio(hsl(h, s, cur), on) < ratio; i++) cur += step
  return hsl(h, s, cur)
}

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** The whole palette from one colour. */
export function makePalette(seed: string): Palette {
  const { h, s: seedS } = hexToHsl(seed)
  // Vivid but not neon; greyish seeds (graphite) keep their quiet saturation.
  const s = seedS < 0.25 ? seedS : Math.min(Math.max(seedS, 0.55), 0.9)
  const tone = (l: number, sat = s) => hsl(h, sat, l)

  const page = { light: hsl(h, Math.min(s, 0.45), 0.965), dark: hsl(h, Math.min(s, 0.35), 0.07) }
  const panel = { light: '#FFFFFF', dark: hsl(h, Math.min(s, 0.25), 0.11) }
  const ink = { light: hsl(h, Math.min(s, 0.25), 0.085), dark: hsl(h, Math.min(s, 0.3), 0.95) }

  const brand: Scale = {
    50: tone(0.965),
    100: tone(0.925),
    200: tone(0.855),
    300: tone(0.75),
    400: tone(0.64),
    500: tone(0.52),
    // Accent text on the page, and white text on light-mode buttons: darken until both read.
    600: reach(h, s, 0.44, page.light, 4.6, -0.01),
    700: tone(0.35),
    800: tone(0.28),
    900: tone(0.21),
    950: tone(0.13),
  }
  // The dark-mode accent: light enough to read on dark panels (and to take dark text as a button).
  brand[300] = reach(h, s, 0.72, panel.dark, 7, 0.01)

  const gs = Math.min(s, 0.16)
  const gray: Scale = {
    50: hsl(h, gs, 0.97),
    100: hsl(h, gs, 0.94),
    200: hsl(h, gs, 0.89),
    300: hsl(h, gs, 0.8),
    400: hsl(h, gs, 0.64),
    500: hsl(h, gs, 0.5),
    // fg.muted in light mode.
    600: reach(h, gs, 0.39, panel.light, 5.5, -0.01),
    700: hsl(h, gs, 0.3),
    800: hsl(h, gs, 0.2),
    900: hsl(h, gs, 0.13),
    950: hsl(h, gs, 0.085),
  }
  // fg.muted in dark mode.
  gray[400] = reach(h, gs, 0.64, panel.dark, 6, 0.01)

  const ds = Math.min(s, 0.25)
  const darkSurface = {
    subtle: hsl(h, ds, 0.095),
    muted: hsl(h, ds, 0.14),
    emphasized: hsl(h, ds, 0.19),
    border: hsl(h, ds, 0.18),
    borderMuted: hsl(h, ds, 0.14),
  }

  // A cooler neighbour (blue to aqua, red to pink) gives the backdrop some depth without clashing.
  const near = tone(0.6, Math.min(s, 0.75))
  const neighbour = hsl(h - 35, Math.min(s, 0.75), 0.55)
  const backdrop = {
    light: [rgba(tone(0.66), 0.34), rgba(neighbour, 0.24), rgba(near, 0.2)] as [string, string, string],
    dark: [rgba(tone(0.52), 0.26), rgba(hsl(h - 35, Math.min(s, 0.75), 0.4), 0.18), rgba(near, 0.12)] as [string, string, string],
  }

  return { brand, gray, page, panel, ink, darkSurface, backdrop }
}

export const palette = makePalette(PRIMARY)
export const { brand, gray, page, panel, ink, darkSurface, backdrop } = palette

/**
 * The app's first theme (October 2026): an orange scale on Chakra's plain greys, white and black pages, kept exactly
 * rather than derived from its seed, which darkens the orange to brown to reach 4.5:1. White on its light-mode
 * buttons (600) is about 3.2:1, like the light line colours; chosen deliberately, so tests check it more loosely. Only
 * the glow behind the glass is generated.
 */
export const ORIGINAL: Palette = {
  ...makePalette('#F97316'),
  brand: {
    50: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 300: '#FDBA74', 400: '#FB923C', 500: '#F97316',
    600: '#EA6A12', 700: '#C2570C', 800: '#9A3F0C', 900: '#431407', 950: '#2A0C04',
  },
  gray: {
    50: '#FAFAFA', 100: '#F4F4F5', 200: '#E4E4E7', 300: '#D4D4D8', 400: '#A1A1AA', 500: '#71717A',
    600: '#52525B', 700: '#3F3F46', 800: '#27272A', 900: '#18181B', 950: '#111111',
  },
  page: { light: '#FFFFFF', dark: '#09090B' },
  panel: { light: '#FFFFFF', dark: '#111111' },
  ink: { light: '#09090B', dark: '#FAFAFA' },
  darkSurface: { subtle: '#111111', muted: '#18181B', emphasized: '#27272A', border: '#27272A', borderMuted: '#18181B' },
}

export const FIXED_PALETTES: Partial<Record<string, Palette>> = { original: ORIGINAL }

// The manifest takes one colour; the app replaces it at runtime with the page colour of the current theme.
export const themeColor = page.light

/** The app icon's background. */
export const logoGradient = [brand[500], brand[700]] as const
