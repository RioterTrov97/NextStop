import { Box, Flex, Text } from '@chakra-ui/react'
import { memo } from 'react'
import { LuChevronRight } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useNow } from '../lib/hooks'
import { isTransit, stationName, summarize } from '../lib/journey'
import { countdown, formatTime } from '../lib/time'
import { legColour, useTint } from '../lib/useTint'
import { useCurrentTrip } from '../store/currentTrip'
import { LineBadge } from './LineBadge'

const ENDED_GRACE_MS = 5 * 60_000

/**
 * The trip being followed, as a small glass card above the tab bar on every tab but Home (where the full current trip
 * card is), like Sangeet's mini player. It takes the colour of the next ride's line and opens the trip on Home.
 * Times come from the saved trip, which Home keeps live while it is open.
 */
export const FollowedTripBar = memo(function FollowedTripBar() {
  const trip = useCurrentTrip()
  const now = useNow(1000)
  const navigate = useNavigate()
  const journey = trip?.journey
  const rides = journey?.legs.filter(isTransit) ?? []
  // The next ride still to board, or the one being ridden.
  const next =
    rides.find((l) => Date.parse(l.origin.departureTimeEstimated ?? l.origin.departureTimePlanned ?? '') > now - 60_000) ??
    rides.find((l) => Date.parse(l.destination.arrivalTimeEstimated ?? l.destination.arrivalTimePlanned ?? '') > now) ??
    rides[rides.length - 1]
  const tint = useTint(next ? legColour(next) : undefined)
  if (!trip || !journey || !next) return null
  const s = summarize(journey)
  const arr = s.arrEstimated ?? s.arrPlanned
  if (arr && Date.parse(arr) + ENDED_GRACE_MS < now) return null

  const dep = next.origin.departureTimeEstimated ?? next.origin.departureTimePlanned
  const boarding = dep && Date.parse(dep) > now - 60_000
  const t = next.transportation
  const label = boarding ? `${formatTime(dep)} from ${stationName(next.origin)}` : `Riding to ${stationName(next.destination)}`
  const right = boarding ? countdown(dep, now) : arr ? `arrives ${formatTime(arr)}` : ''

  return (
    <Flex
      as="button"
      className="ns-glass"
      pointerEvents="auto"
      align="center"
      gap={3}
      w="full"
      h="58px"
      px={3}
      borderRadius="2xl"
      textAlign="start"
      style={tint?.vars}
      aria-label={`Following ${trip.fromName.split(',')[0]} to ${trip.toName.split(',')[0]}. ${label}. ${right}. Open trip`}
      onClick={() => navigate('/', { state: { openCurrent: true } })}
    >
      <LineBadge number={t?.number ?? t?.disassembledName} cls={t?.product?.class} />
      <Box flex={1} minW={0} lineHeight="short">
        <Text fontSize="sm" fontWeight="semibold" truncate>
          {trip.fromName.split(',')[0]} → {trip.toName.split(',')[0]}
        </Text>
        <Text fontSize="xs" color={tint ? 'var(--ns-tint-accent)' : 'fg.muted'} truncate>
          {label}
        </Text>
      </Box>
      <Text
        fontSize="md"
        fontWeight="bold"
        fontVariantNumeric="tabular-nums"
        whiteSpace="nowrap"
        color={tint ? 'var(--ns-tint-accent)' : 'brand.fg'}
      >
        {right}
      </Text>
      <Box color="fg.muted" aria-hidden>
        <LuChevronRight />
      </Box>
    </Flex>
  )
})
