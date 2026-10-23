import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // The logo already has its own rounded background, so no extra padding on the transparent icons.
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: { background: '#0f766e' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#0f766e' } },
  },
  images: ['public/logo.svg'],
})
