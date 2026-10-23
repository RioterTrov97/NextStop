import { Suspense, lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Home } from './routes/Home'

const Plan = lazy(() => import('./routes/Plan'))
const TripResults = lazy(() => import('./routes/TripResults'))
const Departures = lazy(() => import('./routes/Departures'))
const StationBoard = lazy(() => import('./routes/StationBoard'))
const Alerts = lazy(() => import('./routes/Alerts'))
const Settings = lazy(() => import('./routes/Settings'))

const wrap = (el: React.ReactNode) => <Suspense fallback={null}>{el}</Suspense>

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/plan', element: wrap(<Plan />) },
      { path: '/trip/:from/:to', element: wrap(<TripResults />) },
      { path: '/departures', element: wrap(<Departures />) },
      { path: '/station/:id', element: wrap(<StationBoard />) },
      { path: '/alerts', element: wrap(<Alerts />) },
      { path: '/settings', element: wrap(<Settings />) },
    ],
  },
])
