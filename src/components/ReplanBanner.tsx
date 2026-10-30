import { Box, Button, Flex, HStack, Text } from '@chakra-ui/react'
import { LuArrowRightLeft, LuTriangleAlert, LuZap } from 'react-icons/lu'
import { isTransit } from '../lib/journey'
import type { Replan } from '../lib/replan'
import { formatTime } from '../lib/time'
import { LineBadge } from './LineBadge'
import { StopPlatform } from './PlatformPill'

const HEADLINES = {
  cancelled: (stop: string) => `A ride on your trip is cancelled. Best option from ${stop}:`,
  missed: (stop: string) => `Delays mean you'll likely miss your change at ${stop}. Best option:`,
  faster: (stop: string) => `Faster route from ${stop}:`,
}

interface Props {
  replan: Replan
  onSwitch: () => void
  onDismiss: () => void
}

/** Offers a better route for the rest of a followed trip, with one tap to switch to it. */
export function ReplanBanner({ replan, onSwitch, onDismiss }: Props) {
  const urgent = replan.reason !== 'faster'
  const rides = replan.route.legs.filter(isTransit)
  const first = rides[0]
  const departs = first?.origin.departureTimeEstimated ?? first?.origin.departureTimePlanned
  const savedMin = Math.round(replan.savedMs / 60_000)
  const arrives = new Date(replan.arrival).toISOString()

  return (
    <Box
      role="status"
      aria-live="polite"
      bg={urgent ? 'red.subtle' : 'teal.subtle'}
      borderWidth="1px"
      borderColor={urgent ? 'red.muted' : 'teal.muted'}
      borderRadius="xl"
      p={3}
      onClick={(e) => e.stopPropagation()}
    >
      <HStack gap={2} align="flex-start" color={urgent ? 'red.fg' : 'teal.fg'}>
        <Box pt="2px" flexShrink={0}>
          {urgent ? <LuTriangleAlert /> : <LuZap />}
        </Box>
        <Text fontSize="sm" fontWeight="semibold">
          {HEADLINES[replan.reason](replan.point.stopName)}
        </Text>
      </HStack>
      <Flex align="center" gap={1.5} wrap="wrap" mt={2}>
        {rides.map((l, i) => (
          <LineBadge
            key={i}
            number={l.transportation?.number ?? l.transportation?.disassembledName}
            cls={l.transportation?.product?.class}
          />
        ))}
        <Text fontSize="sm" color="fg.muted">
          {formatTime(departs)}
        </Text>
        {first && <StopPlatform point={first.origin} transportation={first.transportation} />}
      </Flex>
      <Text fontSize="sm" mt={1}>
        Arrive <b>{formatTime(arrives)}</b>
        {savedMin > 0 && (
          <Text as="span" color={urgent ? undefined : 'teal.fg'} fontWeight="semibold">
            {' '}
            · {savedMin} min sooner
          </Text>
        )}
      </Text>
      <Flex gap={2} mt={3}>
        <Button size="sm" colorPalette={urgent ? 'red' : 'teal'} borderRadius="full" onClick={onSwitch}>
          <LuArrowRightLeft /> Switch to this
        </Button>
        <Button size="sm" variant="ghost" borderRadius="full" onClick={onDismiss}>
          Keep my trip
        </Button>
      </Flex>
    </Box>
  )
}
