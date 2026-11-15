import { backdrop, brand, darkSurface, gray, ink, page, panel } from '../shared/brand'
import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

const scale = (s: Record<string | number, string>) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { value: v }]))

// iOS-style sheet easing: quick start, long soft settle.
const SHEET_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

const config = defineConfig({
  globalCss: {
    // dvh, not vh: in the installed iPhone app 100vh is the whole screen (932px on a 15 Pro Max) while the visible area
    // below the status bar is 59px shorter, which made even an empty page scroll.
    'html, body, #root': { height: '100dvh' },
    // iOS applies the rubber-band to the root element, so it must be disabled there too.
    // The canvas must also match the body, or content taller than the viewport spills onto a different colour.
    'html, body': { overscrollBehavior: 'none', bg: 'bg' },
    // Colour for the glass to blur: soft sky and water light fixed behind the page, low down where the tab bar floats
    // and clear of the solid header. Cards and the header stay solid.
    // Glass colours (src/styles/glass.css), from the palette.
    ':root': {
      '--ns-glass-bg': 'rgba(255, 255, 255, 0.66)',
      '--ns-glass-solid': panel.light,
      '--ns-glass-edge': rgba(ink.light, 0.08),
      '--ns-glass-shine': 'rgba(255, 255, 255, 0.9)',
      '--ns-glass-shadow': `0 10px 30px ${rgba(brand[950], 0.12)}, 0 2px 6px ${rgba(brand[950], 0.06)}`,
    },
    '.dark': {
      '--ns-glass-bg': rgba(darkSurface.muted, 0.62),
      '--ns-glass-solid': darkSurface.muted,
      '--ns-glass-edge': 'rgba(255, 255, 255, 0.09)',
      '--ns-glass-shine': 'rgba(255, 255, 255, 0.13)',
      '--ns-glass-shadow': '0 12px 32px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3)',
    },
    'body::before': {
      content: '""',
      position: 'fixed',
      inset: 0,
      zIndex: -1,
      pointerEvents: 'none',
      backgroundImage: `radial-gradient(70% 45% at 100% 100%, ${backdrop.light[0]}, transparent 70%), radial-gradient(60% 40% at 0% 72%, ${backdrop.light[1]}, transparent 70%), radial-gradient(55% 30% at 85% 38%, ${backdrop.light[2]}, transparent 70%)`,
    },
    '.dark body::before': {
      backgroundImage: `radial-gradient(70% 45% at 100% 100%, ${backdrop.dark[0]}, transparent 70%), radial-gradient(60% 40% at 0% 72%, ${backdrop.dark[1]}, transparent 70%), radial-gradient(55% 30% at 85% 38%, ${backdrop.dark[2]}, transparent 70%)`,
    },
    // Only the OSM fallback needs this; MapTiler ships a real dark style.
    '.dark .tiles-invert .leaflet-tile-pane': { filter: 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9)' },
    // The body lets the backdrop through; the html canvas carries the page colour.
    body: {
      bg: 'transparent',
      color: 'fg',
      WebkitTapHighlightColor: 'transparent',
    },
    // Bottom sheet (Ark UI drawer). Ark positions the content with a transform driven by the finger; these rules
    // animate opening, closing (starting from wherever a swipe let go) and the snap back from a short drag.
    '.ns-sheet': { transition: `transform 0.4s ${SHEET_EASE}` },
    '.ns-sheet[data-state=open]': { animation: `ns-sheet-in 0.4s ${SHEET_EASE}` },
    '.ns-sheet[data-state=closed]': { animation: `ns-sheet-out 0.28s ${SHEET_EASE}` },
    '.ns-sheet-backdrop': { opacity: 'calc(1 - var(--drawer-swipe-progress, 0))', transition: 'opacity 0.2s' },
    '.ns-sheet-backdrop[data-swiping]': { transition: 'none' },
    '.ns-sheet-backdrop[data-state=open]': { animation: 'ns-fade-in 0.3s ease-out' },
    '.ns-sheet-backdrop[data-state=closed]': { animation: 'ns-fade-out 0.28s ease-in' },
    // Stacking, bottom to top: page header 10, trip sheet 1300-1400, dialogs 1500, dimmed header strip 1550, full-screen map 2000.
    // Dialogs stay mounted after their first use (lazyMount), so without their own layer a dialog could end up under a
    // sheet opened later, with equal z-index and an earlier place in the page.
    '[data-scope=dialog][data-part=backdrop]': { zIndex: '1500 !important' },
    '[data-scope=dialog][data-part=positioner]': {
      zIndex: '1510 !important',
      // Keep centred dialogs clear of the header band (the dimmed header is drawn above them) and the home indicator.
      paddingTop: 'calc(env(safe-area-inset-top) + 72px)',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
    },
    '[data-scope=dialog][data-part=content]': { maxHeight: '100%', overflowY: 'auto' },
    // Live-data refresh button. With reduced motion the decorative motion stops (ring easing, tick pop, digit slide),
    // but the loading indicator keeps going, as the system spinners on iOS and Windows do: a frozen spinner reads as a
    // hung app. It turns at a steady, slower pace with a fixed arc, and the dots fade instead of bouncing.
    '.ns-refresh-spin': {
      animation: 'ns-refresh-turn 1.4s linear infinite',
      _motionReduce: { animationDuration: '2s' },
    },
    '.ns-refresh-arc': { animation: 'ns-refresh-dash 1.4s ease-in-out infinite', _motionReduce: { animation: 'none' } },
    '.ns-refresh-dot': { animation: 'ns-refresh-wave 1s ease-in-out infinite', _motionReduce: { animationName: 'ns-refresh-fade' } },
    '.ns-refresh-pop': { animation: 'ns-refresh-pop 0.35s ease-out', _motionReduce: { animation: 'none' } },
    '.ns-refresh-tick': { display: 'inline-block', animation: 'ns-refresh-digit 0.25s ease-out', _motionReduce: { animation: 'none' } },
    '.ns-refresh *': { _motionReduce: { transition: 'none !important' } },
  },
  theme: {
    keyframes: {
      'ns-sheet-in': { from: { transform: 'translate3d(0, 100%, 0)' }, to: { transform: 'translate3d(0, 0, 0)' } },
      'ns-sheet-out': {
        from: { transform: 'translate3d(0, var(--drawer-translate-y, 0px), 0)' },
        to: { transform: 'translate3d(0, 100%, 0)' },
      },
      'ns-fade-in': { from: { opacity: 0 } },
      'ns-fade-out': { to: { opacity: 0 } },
      // Refresh countdown: a turning arc that grows and shrinks, a tick that pops in, digits that ease in.
      'ns-refresh-turn': { to: { transform: 'rotate(360deg)' } },
      'ns-refresh-dash': {
        '0%': { strokeDasharray: '1 90', strokeDashoffset: '0' },
        '50%': { strokeDasharray: '45 90', strokeDashoffset: '-14' },
        '100%': { strokeDasharray: '45 90', strokeDashoffset: '-80' },
      },
      'ns-refresh-pop': {
        '0%': { transform: 'scale(0.4)', opacity: 0 },
        '60%': { transform: 'scale(1.15)', opacity: 1 },
        '100%': { transform: 'scale(1)' },
      },
      'ns-refresh-digit': { from: { transform: 'translateY(2px)', opacity: 0.4 } },
      'ns-refresh-wave': {
        '0%, 80%, 100%': { opacity: 0.35, transform: 'translateY(0)' },
        '40%': { opacity: 1, transform: 'translateY(-1.5px)' },
      },
      // Reduced motion: the same rhythm as the wave, as a fade only.
      'ns-refresh-fade': { '0%, 80%, 100%': { opacity: 0.35 }, '40%': { opacity: 1 } },
    },
    tokens: {
      colors: {
        brand: scale(brand),
        // Every grey leans slightly towards the accent's hue (shared/brand.ts).
        gray: scale(gray),
      },
      fonts: {
        heading: { value: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif" },
        body: { value: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif" },
      },
      radii: {
        // Rounder, iOS-like corners: cards 2xl (18px), sheets 3xl (26px), pills full.
        xl: { value: '14px' },
        '2xl': { value: '18px' },
        '3xl': { value: '26px' },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: { value: { _light: page.light, _dark: page.dark } },
          panel: { value: { _light: panel.light, _dark: panel.dark } },
          subtle: { value: { _light: '{colors.gray.50}', _dark: darkSurface.subtle } },
          muted: { value: { _light: '{colors.gray.100}', _dark: darkSurface.muted } },
          emphasized: { value: { _light: '{colors.gray.200}', _dark: darkSurface.emphasized } },
        },
        fg: {
          DEFAULT: { value: { _light: ink.light, _dark: ink.dark } },
          muted: { value: { _light: '{colors.gray.600}', _dark: '{colors.gray.400}' } },
        },
        border: {
          DEFAULT: { value: { _light: '{colors.gray.200}', _dark: darkSurface.border } },
          muted: { value: { _light: '{colors.gray.100}', _dark: darkSurface.borderMuted } },
        },
        // colorPalette="brand": light mode uses the deep accent with white text, dark mode the pale one with dark text.
        brand: {
          solid: { value: { _light: '{colors.brand.600}', _dark: '{colors.brand.300}' } },
          contrast: { value: { _light: 'white', _dark: '{colors.brand.950}' } },
          fg: { value: { _light: '{colors.brand.600}', _dark: '{colors.brand.300}' } },
          muted: { value: { _light: '{colors.brand.200}', _dark: '{colors.brand.800}' } },
          subtle: { value: { _light: '{colors.brand.100}', _dark: '{colors.brand.900}' } },
          emphasized: { value: { _light: '{colors.brand.300}', _dark: '{colors.brand.700}' } },
          focusRing: { value: { _light: '{colors.brand.500}', _dark: '{colors.brand.400}' } },
          border: { value: { _light: '{colors.brand.200}', _dark: '{colors.brand.800}' } },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
