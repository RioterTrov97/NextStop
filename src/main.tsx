import { ChakraProvider } from '@chakra-ui/react'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider, type Persister } from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'
import { ThemeProvider } from 'next-themes'
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { system } from './theme'

const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: () => <m.ReactQueryDevtools buttonPosition="bottom-right" /> })),
    )
  : () => null

const DAY = 24 * 3600_000

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, gcTime: DAY, retry: 1 } },
})

const persister: Persister = {
  persistClient: (c) => set('nextstop-cache', c),
  restoreClient: () => get('nextstop-cache'),
  removeClient: () => del('nextstop-cache'),
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" disableTransitionOnChange defaultTheme="system">
      <ChakraProvider value={system}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: DAY,
            dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && q.meta?.persist !== false },
          }}
        >
          <RouterProvider router={router} />
          <Suspense fallback={null}>
            <Devtools />
          </Suspense>
        </PersistQueryClientProvider>
      </ChakraProvider>
    </ThemeProvider>
  </StrictMode>,
)
