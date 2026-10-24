import { brand } from '../shared/brand'
import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const config = defineConfig({
  globalCss: {
    'html, body, #root': { height: '100vh' },
    // iOS applies the rubber-band to the root element, so it must be disabled there too.
    // The canvas must also match the body, or content taller than the viewport spills onto a different colour.
    'html, body': { overscrollBehavior: 'none', bg: 'bg' },
    // Only the OSM fallback needs this; MapTiler ships a real dark style.
    '.dark .tiles-invert .leaflet-tile-pane': { filter: 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9)' },
    body: {
      color: 'fg',
      WebkitTapHighlightColor: 'transparent',
    },
  },
  theme: {
    tokens: {
      // The "teal" palette name is kept so existing colorPalette="teal" usages pick up the accent colour.
      colors: {
        teal: {
          ...Object.fromEntries(Object.entries(brand).map(([k, v]) => [k, { value: v }])),
        },
      },
      fonts: {
        heading: { value: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif" },
        body: { value: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif" },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
