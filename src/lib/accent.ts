// The app colour chosen in Settings, applied at runtime.
//
// The theme (src/theme.ts) is built from the default palette at build time. Another colour overrides the same CSS
// variables, inline on <html> so they beat the stylesheet, for the current colour mode. The variables for both modes
// are also cached in localStorage, where the script in index.html applies them before the first paint, so the app
// never flashes the default colour on launch.

import { ACCENTS, makePalette, palette as defaultPalette, type AccentKey, type Palette } from '../../shared/brand'
import type { ColourMode } from './tint'

export const CACHE_KEY = 'nextstop.accent.v1'

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

const palettes = new Map<string, Palette>()

/** The palette for an accent key (cached); unknown keys get the default. */
export function accentPalette(key: string | undefined): Palette {
  const accent = ACCENTS.find((a) => a.key === key)
  if (!accent || accent.key === ACCENTS[0].key) return defaultPalette
  let p = palettes.get(accent.key)
  if (!p) palettes.set(accent.key, (p = makePalette(accent.hex)))
  return p
}

export const isAccentKey = (key: unknown): key is AccentKey => ACCENTS.some((a) => a.key === key)

/** The app's own variables (glass and the backdrop behind it) for a palette; theme.ts uses these too. */
export function appVars(p: Palette, mode: ColourMode): Record<`--${string}`, string> {
  const [b1, b2, b3] = p.backdrop[mode]
  const shared = { '--ns-backdrop-1': b1, '--ns-backdrop-2': b2, '--ns-backdrop-3': b3 }
  if (mode === 'dark')
    return {
      ...shared,
      '--ns-glass-bg': rgba(p.darkSurface.muted, 0.62),
      '--ns-glass-solid': p.darkSurface.muted,
      '--ns-glass-edge': 'rgba(255, 255, 255, 0.09)',
      '--ns-glass-shine': 'rgba(255, 255, 255, 0.13)',
      '--ns-glass-shadow': '0 12px 32px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3)',
    }
  return {
    ...shared,
    '--ns-glass-bg': 'rgba(255, 255, 255, 0.66)',
    '--ns-glass-solid': p.panel.light,
    '--ns-glass-edge': rgba(p.ink.light, 0.08),
    '--ns-glass-shine': 'rgba(255, 255, 255, 0.9)',
    '--ns-glass-shadow': `0 10px 30px ${rgba(p.brand[950], 0.12)}, 0 2px 6px ${rgba(p.brand[950], 0.06)}`,
  }
}

/** Every variable that differs between palettes, for one colour mode. */
export function accentVars(p: Palette, mode: ColourMode): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [k, v] of Object.entries(p.brand)) vars[`--chakra-colors-brand-${k}`] = v
  for (const [k, v] of Object.entries(p.gray)) vars[`--chakra-colors-gray-${k}`] = v
  vars['--chakra-colors-bg'] = p.page[mode]
  vars['--chakra-colors-bg-panel'] = p.panel[mode]
  vars['--chakra-colors-fg'] = p.ink[mode]
  if (mode === 'dark') {
    vars['--chakra-colors-bg-subtle'] = p.darkSurface.subtle
    vars['--chakra-colors-bg-muted'] = p.darkSurface.muted
    vars['--chakra-colors-bg-emphasized'] = p.darkSurface.emphasized
    vars['--chakra-colors-border'] = p.darkSurface.border
    vars['--chakra-colors-border-muted'] = p.darkSurface.borderMuted
  }
  // index.html: the page colour shared by the header and the status bar. (Not --ns-header-fg: tinted screens own it.)
  vars['--ns-page'] = p.page[mode]
  return { ...vars, ...appVars(p, mode) }
}

let applied: string[] = []

/** Applies an accent for a colour mode, replacing the last one; the default accent clears the overrides. */
export function applyAccent(key: string | undefined, mode: ColourMode) {
  const style = document.documentElement.style
  for (const name of applied) style.removeProperty(name)
  applied = []
  const p = accentPalette(key)
  try {
    if (p === defaultPalette) localStorage.removeItem(CACHE_KEY)
    else localStorage.setItem(CACHE_KEY, JSON.stringify({ light: accentVars(p, 'light'), dark: accentVars(p, 'dark') }))
  } catch {
    // Storage can be full or blocked; the colour still applies for this session.
  }
  if (p === defaultPalette) return
  for (const [name, value] of Object.entries(accentVars(p, mode))) {
    style.setProperty(name, value)
    applied.push(name)
  }
}
