import { Box, Flex, Text } from '@chakra-ui/react'
import { useEffect } from 'react'
import { LuBell, LuClock, LuSettings, LuTrainFront } from 'react-icons/lu'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useOnline } from '../lib/hooks'

const TABS = [
  { to: '/', label: 'Trips', icon: LuTrainFront, end: true },
  { to: '/departures', label: 'Departures', icon: LuClock },
  { to: '/alerts', label: 'Alerts', icon: LuBell },
  { to: '/settings', label: 'Settings', icon: LuSettings },
]

export function AppShell() {
  const online = useOnline()
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])

  return (
    <Box maxW="640px" mx="auto" minH="100dvh" pb="calc(76px + env(safe-area-inset-bottom))">
      {!online && (
        <Box bg="orange.500" color="white" fontSize="sm" textAlign="center" py={1} pt="calc(4px + env(safe-area-inset-top))">
          Offline. Showing the last data we saved.
        </Box>
      )}
      <Outlet />
      <Flex
        as="nav"
        aria-label="Main"
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        zIndex="sticky"
        bg="bg.panel"
        borderTopWidth="1px"
        pb="env(safe-area-inset-bottom)"
        justify="center"
      >
        <Flex w="full" maxW="640px">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} style={{ flex: 1 }}>
              {({ isActive }) => (
                <Flex direction="column" align="center" gap="2px" py={2} color={isActive ? 'teal.500' : 'fg.muted'}>
                  <Icon size={22} />
                  <Text fontSize="xs" fontWeight={isActive ? 'semibold' : 'normal'}>
                    {label}
                  </Text>
                </Flex>
              )}
            </NavLink>
          ))}
        </Flex>
      </Flex>
    </Box>
  )
}
