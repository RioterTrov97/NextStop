import { useRealtimeScheduler } from '../api/realtime'
import { Box, Flex, Text } from '@chakra-ui/react'
import { useEffect } from 'react'
import { LuBell, LuClock, LuSettings, LuTrainFront } from 'react-icons/lu'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useOnline } from '../lib/hooks'

const inTrips = (p: string) => p === '/' || p.startsWith('/plan') || p.startsWith('/trip/')

const TABS = [
  { to: '/', label: 'Trips', icon: LuTrainFront, match: inTrips },
  { to: '/departures', label: 'Departures', icon: LuClock, match: (p: string) => p.startsWith('/departures') || p.startsWith('/station/') },
  { to: '/alerts', label: 'Alerts', icon: LuBell, match: (p: string) => p.startsWith('/alerts') },
  { to: '/settings', label: 'Settings', icon: LuSettings, match: (p: string) => p.startsWith('/settings') },
]

// Where the user last was inside the Trips section, so switching tabs and back doesn't drop them to Home.
let lastTrips = '/'

export function AppShell() {
  const online = useOnline()
  useRealtimeScheduler()
  const { pathname, search } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  useEffect(() => {
    if (inTrips(pathname)) lastTrips = pathname + search
  }, [pathname, search])

  return (
    <Flex direction="column" maxW="640px" mx="auto" minH="100vh">
      {!online && (
        <Box bg="orange.500" color="white" fontSize="sm" textAlign="center" py={1} pt="calc(4px + env(safe-area-inset-top))">
          Offline. Showing the last data we saved.
        </Box>
      )}
      <Box flex="1">
        <Outlet />
      </Box>
      {/* Sticky rather than fixed: iOS Safari leaves a gap under fixed bottom bars until the first scroll. */}
      <Flex
        as="nav"
        aria-label="Main"
        position="sticky"
        bottom={0}
        zIndex="sticky"
        bg="bg.panel"
        borderTopWidth="1px"
        pb="min(env(safe-area-inset-bottom), 8px)"
      >
        <Flex w="full">
          {TABS.map(({ to, label, icon: Icon, match }) => {
            const isActive = match(pathname)
            // Tapping the active Trips tab goes home; from another tab it returns to the last trips page.
            const target = to === '/' ? (isActive ? '/' : lastTrips) : to
            return (
              <Link key={to} to={target} style={{ flex: 1 }} aria-current={isActive ? 'page' : undefined}>
                <Flex direction="column" align="center" gap="2px" py={4} color={isActive ? 'teal.500' : 'fg.muted'}>
                  <Icon size={22} />
                  <Text fontSize="xs" fontWeight={isActive ? 'semibold' : 'normal'}>
                    {label}
                  </Text>
                </Flex>
              </Link>
            )
          })}
        </Flex>
      </Flex>
    </Flex>
  )
}
