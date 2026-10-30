import { ChakraProvider } from '@chakra-ui/react'
import { QueryClient, onlineManager } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { ThemeProvider } from 'next-themes'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { createCachePersister, shouldPersist } from './lib/cachePersister'
import { repaintStatusBarArea } from './lib/statusBar'
import { preloadRoutes, router } from './router'
import { system } from './theme'

// iOS standalone PWAs are rarely cold-started, so check for a new service worker whenever the app is foregrounded.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const check = () => void reg.update().catch(() => {})
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
    setInterval(check, 30 * 60_000)
  },
})

// The default listener trusts online/offline events only, so one missed event (PWA resume, flaky wifi handoff) leaves queries paused while online.
// Re-read navigator.onLine whenever the app comes back to the foreground.
onlineManager.setEventListener((setOnline) => {
  const sync = () => setOnline(navigator.onLine)
  const events = ['online', 'offline', 'focus', 'pageshow', 'visibilitychange'] as const
  events.forEach((e) => window.addEventListener(e, sync))
  sync()
  return () => events.forEach((e) => window.removeEventListener(e, sync))
})

const DAY = 24 * 3600_000

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, gcTime: DAY, retry: 1 } },
})

const persister = createCachePersister()

// Fetch the other pages' code once the first screen is up, so switching tabs never waits on the network.
preloadRoutes()

// Installed iPhone app: make iOS 27 re-check the status bar area once the header exists (see statusBar.ts).
repaintStatusBarArea()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" disableTransitionOnChange defaultTheme="dark">
      <ChakraProvider value={system}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: DAY,
            dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
          }}
        >
          <RouterProvider router={router} />
        </PersistQueryClientProvider>
      </ChakraProvider>
    </ThemeProvider>
  </StrictMode>,
)
