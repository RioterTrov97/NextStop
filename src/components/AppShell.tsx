import { useRealtimeScheduler } from '../api/realtime'
import { useAccent, useSolidSurfaces } from '../lib/appearance'
import { useStatusBarFollowsBackdrops } from '../lib/statusBar'
import { Box, Flex, Stack, Text } from '@chakra-ui/react'
import { useEffect } from 'react'
import { LuHistory, LuRadio, LuSettings, LuTrainFront } from 'react-icons/lu'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { FollowedTripBar } from './FollowedTripBar'

const inTrips = (p: string) => p === '/' || p.startsWith('/plan') || p.startsWith('/trip/')

const TABS = [
  { to: '/', label: 'Trips', icon: LuTrainFront, match: inTrips },
  { to: '/history', label: 'History', icon: LuHistory, match: (p: string) => p.startsWith('/history') },
  {
    to: '/alerts',
    label: 'Live',
    icon: LuRadio,
    match: (p: string) => p.startsWith('/departures') || p.startsWith('/station/') || p.startsWith('/alerts'),
  },
  { to: '/settings', label: 'Settings', icon: LuSettings, match: (p: string) => p.startsWith('/settings') },
]

// Where the user last was inside the Trips section, so switching tabs and back doesn't drop them to Home.
let lastTrips = '/'

export function AppShell() {
  useRealtimeScheduler()
  useStatusBarFollowsBackdrops()
  useSolidSurfaces()
  useAccent()
  const { pathname, search } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  useEffect(() => {
    if (inTrips(pathname)) lastTrips = pathname + search
  }, [pathname, search])

  return (
    <Flex direction="column" maxW="640px" mx="auto" minH="100dvh">
      <Box flex="1">
        <Outlet />
      </Box>
      {/*
        Floating glass chrome, like iOS 26: the followed trip above a capsule tab bar, with the page scrolling underneath.
        Sticky rather than fixed: iOS Safari leaves a gap under fixed bottom bars until the first scroll. Being in the
        flow, it also keeps the end of every page clear of the bar. Only the capsules take taps.
      */}
      <Stack
        position="sticky"
        bottom={0}
        zIndex="sticky"
        gap={2}
        px={3}
        pt={2}
        pb="max(calc(env(safe-area-inset-bottom) - 18px), 10px)"
        pointerEvents="none"
      >
        {pathname !== '/' && <FollowedTripBar />}
        <Flex as="nav" aria-label="Main" className="ns-glass" pointerEvents="auto" h="62px" px={1.5} borderRadius="full" align="center">
          {TABS.map(({ to, label, icon: Icon, match }) => {
            const isActive = match(pathname)
            // Tapping the active Trips tab goes home; from another tab it returns to the last trips page.
            const target = to === '/' ? (isActive ? '/' : lastTrips) : to
            return (
              <Link key={to} to={target} style={{ flex: 1 }} aria-current={isActive ? 'page' : undefined}>
                <Flex
                  direction="column"
                  align="center"
                  justify="center"
                  gap="1px"
                  h="52px"
                  mx={0.5}
                  borderRadius="full"
                  color={isActive ? 'brand.contrast' : 'fg.muted'}
                  // The selected tab is a solid pill in the app colour, like every other selected or primary control.
                  bg={isActive ? 'brand.solid' : 'transparent'}
                  transition="background-color 0.25s, color 0.25s"
                >
                  <Icon size={22} />
                  <Text fontSize="2xs" fontWeight={isActive ? 'bold' : 'medium'}>
                    {label}
                  </Text>
                </Flex>
              </Link>
            )
          })}
        </Flex>
      </Stack>
    </Flex>
  )
}
