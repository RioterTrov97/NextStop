import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const config = defineConfig({
  globalCss: {
    'html, body, #root': { minHeight: '100dvh' },
    body: {
      bg: 'bg',
      color: 'fg',
      overscrollBehaviorY: 'none',
      WebkitTapHighlightColor: 'transparent',
    },
  },
  theme: {
    tokens: {
      fonts: {
        heading: { value: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif" },
        body: { value: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif" },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
