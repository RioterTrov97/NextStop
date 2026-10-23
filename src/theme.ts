import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const config = defineConfig({
  globalCss: {
    'html, body, #root': { height: '100vh' },
    // iOS applies the rubber-band to the root element, so it must be disabled there too.
    'html, body': { overscrollBehavior: 'none' },
    // Only the OSM fallback needs this; MapTiler ships a real dark style.
    '.dark .tiles-invert .leaflet-tile-pane': { filter: 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9)' },
    body: {
      bg: 'bg',
      color: 'fg',
      WebkitTapHighlightColor: 'transparent',
    },
  },
  theme: {
    tokens: {
      // The "teal" palette name is kept so existing colorPalette="teal" usages pick up the accent colour.
      colors: {
        teal: {
          50: { value: '#FFF7ED' },
          100: { value: '#FFEDD5' },
          200: { value: '#FED7AA' },
          300: { value: '#FDBA74' },
          400: { value: '#FB923C' },
          500: { value: '#F97316' },
          600: { value: '#EA6A12' },
          700: { value: '#C2570C' },
          800: { value: '#9A3F0C' },
          900: { value: '#431407' },
          950: { value: '#2A0C04' },
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
