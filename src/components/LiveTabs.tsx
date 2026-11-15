import { Flex } from '@chakra-ui/react'
import { Link, useLocation } from 'react-router-dom'

const ITEMS = [
  { to: '/alerts', label: 'Alerts' },
  { to: '/departures', label: 'Departures' },
]

/** Segmented switch (Alerts first) shared by the Departures and Alerts pages. */
export function LiveTabs() {
  const { pathname } = useLocation()
  return (
    <Flex mt={3} p="3px" bg="bg.muted" borderRadius="full" role="tablist">
      {ITEMS.map(({ to, label }) => {
        const active = pathname.startsWith(to)
        return (
          <Link key={to} to={to} replace role="tab" aria-selected={active} style={{ flex: 1 }}>
            <Flex
              justify="center"
              py={1.5}
              borderRadius="full"
              fontSize="sm"
              fontWeight="semibold"
              bg={active ? 'bg.panel' : 'transparent'}
              color={active ? 'fg' : 'fg.muted'}
              shadow={active ? 'xs' : undefined}
              transition="background-color 0.2s, color 0.2s"
            >
              {label}
            </Flex>
          </Link>
        )
      })}
    </Flex>
  )
}
