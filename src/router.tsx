import { Suspense, lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ErrorFallback } from './components/ErrorFallback'
import { Home } from './routes/Home'

const pages = {
  plan: () => import('./routes/Plan'),
  tripResults: () => import('./routes/TripResults'),
  departures: () => import('./routes/Departures'),
  stationBoard: () => import('./routes/StationBoard'),
  alerts: () => import('./routes/Alerts'),
  history: () => import('./routes/History'),
  settings: () => import('./routes/Settings'),
}

const Plan = lazy(pages.plan)
const TripResults = lazy(pages.tripResults)
const Departures = lazy(pages.departures)
const StationBoard = lazy(pages.stationBoard)
const Alerts = lazy(pages.alerts)
const History = lazy(pages.history)
const Settings = lazy(pages.settings)

/** Loads every page's code in the background once the browser is idle; the chunks then come from memory on first visit. */
export function preloadRoutes() {
  const run = () => Object.values(pages).forEach((load) => void load().catch(() => {}))
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 3000 })
  else setTimeout(run, 1500)
}

const wrap = (el: React.ReactNode) => <Suspense fallback={null}>{el}</Suspense>

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <ErrorFallback />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/plan', element: wrap(<Plan />) },
      { path: '/trip/:from/:to', element: wrap(<TripResults />) },
      { path: '/departures', element: wrap(<Departures />) },
      { path: '/station/:id', element: wrap(<StationBoard />) },
      { path: '/alerts', element: wrap(<Alerts />) },
      { path: '/history', element: wrap(<History />) },
      { path: '/settings', element: wrap(<Settings />) },
    ],
  },
])
