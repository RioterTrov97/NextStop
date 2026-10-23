import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks cache across deploys, so app-code releases don't re-download Chakra or React.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return 'react'
          if (/node_modules\/(@chakra-ui|@emotion|@ark-ui|@zag-js|next-themes)\//.test(id)) return 'chakra'
          if (id.includes('node_modules/@tanstack/') || id.includes('node_modules/idb-keyval')) return 'query'
          return undefined
        },
      },
    },
  },
  plugins: [
    react(),
    cloudflare(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'NextStop',
        short_name: 'NextStop',
        description: 'Live Sydney train, metro, bus, ferry and light rail trips.',
        theme_color: '#EA6A12',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [{ name: 'Departures', url: '/departures', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Map tiles seen once stay available offline.
            urlPattern: /^https:\/\/(tile\.openstreetmap\.org|api\.maptiler\.com)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
