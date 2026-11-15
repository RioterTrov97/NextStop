import { Box, Flex, HStack, Text } from '@chakra-ui/react'
import { LuTriangleAlert } from 'react-icons/lu'
import type { VehicleInfo } from '../../shared/vehicles'
import type { Journey } from '../api/types'
import { isTransit, journeyAlerts, setOff, summarize, trailingWalk, vehicleModeForLeg } from '../lib/journey'
import { isCancelled } from '../lib/replan'
import { formatFare } from '../lib/fares'
import { countdown, formatDuration, formatTime } from '../lib/time'
import { useFare } from '../lib/useFares'
import { useSettings } from '../store/settings'
import { DelayBadge } from './DelayBadge'
import { LineBadge } from './LineBadge'
import { LoadIndicator } from './LoadIndicator'
import { StopPlatform } from './PlatformPill'
import { WalkBadge } from './WalkBadge'

interface Props {
  journey: Journey
  now: number
  vehicles?: Map<string, VehicleInfo>
  /** Replaces the departure station in the top line, e.g. "to Emu Plains" on a station's departure board. */
  title?: string
  onClick?: () => void
  /** Caption for a missing load, e.g. telling users an earlier trip shows its load once followed or opened. */
  noLoadHint?: string
  /** Hide the load entirely, for rides that have finished. */
  hideLoad?: boolean
}

export function JourneyRow({ journey, now, vehicles, title, onClick, noLoadHint, hideLoad }: Props) {
  const { walkPace } = useSettings()
  const s = summarize(journey)
  const dep = s.depEstimated ?? s.depPlanned
  const arr = s.arrEstimated ?? s.arrPlanned
  const alerts = journeyAlerts(journey).filter((a) => a.priority === 'high' || a.priority === 'veryHigh')
  const transit = journey.legs.filter(isTransit)
  const tailWalk = trailingWalk(journey, walkPace)
  // Trips from an address start with a walk: the card shows when to leave and counts down to it.
  const start = setOff(journey, walkPace, now)
  const origin = s.firstTransit?.origin
  const station = (origin?.disassembledName ?? origin?.name ?? '').split(',')[0].replace(/ (Station|Platform).*$/i, '')
  const railLeg = transit.find((l) => ['train', 'metro', 'bus', 'lightrail'].includes(vehicleModeForLeg(l) ?? ''))
  const tripId = railLeg?.transportation?.properties?.RealtimeTripId
  const tileSize = transit.length > 2 ? 'sm' : 'md'
  // Departure-board entries have no arrival, so no fare either; details explain the estimate.
  const fare = useFare(s.arrPlanned ? journey : undefined)

  return (
    <Box
      as="button"
      w="full"
      textAlign="start"
      bg="bg.panel"
      borderRadius="2xl"
      borderWidth="1px"
      p={4}
      onClick={onClick}
      _active={{ transform: 'scale(0.99)' }}
    >
      <Flex justify="space-between" align="center" gap={2} fontSize="sm" color="fg.muted">
        <HStack gap={2} minW={0}>
          <Text truncate fontWeight="medium">
            {title ?? station}
          </Text>
          <StopPlatform point={origin} transportation={s.firstTransit?.transportation} />
        </HStack>
        {/* A departure-board entry has no arrival yet, so no duration either. */}
        {s.arrPlanned && (
          <Text flexShrink={0} fontVariantNumeric="tabular-nums">
            {formatDuration(s.durationSec)}
            {fare && ` · ${formatFare(fare.cents)}`}
          </Text>
        )}
      </Flex>

      <Flex justify="space-between" align="center" gap={2} mt={1.5}>
        <Text fontSize="2xl" fontWeight="bold" whiteSpace="nowrap">
          {formatTime(start.leave ?? dep)}
          {arr && (
            <>
              {' '}
              <Text as="span" color="fg.muted" fontWeight="normal">
                →
              </Text>{' '}
              {formatTime(arr)}
            </>
          )}
        </Text>
        {/* "leave in" sits tight above the minutes, so the row keeps its width with long times like "12:52 pm → 1:27 pm". */}
        <Flex direction="column" align="flex-end" flexShrink={0}>
          {start.leaving && (
            <Text fontSize="2xs" fontWeight="medium" color="fg.muted" lineHeight="1" mb="-2px">
              leave in
            </Text>
          )}
          <Text fontSize="2xl" fontWeight="bold" color="teal.500" fontVariantNumeric="tabular-nums" whiteSpace="nowrap">
            {arr && Date.parse(arr) <= now ? 'Ended' : countdown(start.countTo, now)}
          </Text>
        </Flex>
      </Flex>

      <Flex mt={2.5} align="center" gap={2} wrap="wrap">
        <HStack gap={1.5} wrap="wrap">
          {start.walk && <WalkBadge seconds={start.walk.durationSec} meters={start.walk.distanceM} size={tileSize} />}
          {transit.map((l, i) => (
            <LineBadge
              key={i}
              number={l.transportation?.number ?? l.transportation?.disassembledName}
              cls={l.transportation?.product?.class}
              size={tileSize}
            />
          ))}
          {tailWalk && <WalkBadge seconds={tailWalk.durationSec} meters={tailWalk.distanceM} size={tileSize} />}
          <DelayBadge
            planned={s.depPlanned}
            estimated={s.depEstimated}
            realtime={s.realtime}
            cancelled={!!s.firstTransit && isCancelled(s.firstTransit)}
          />
          {alerts.length > 0 && (
            <Box color="orange.500" aria-label="Service alert">
              <LuTriangleAlert />
            </Box>
          )}
        </HStack>
        {railLeg && !hideLoad && (
          <Box ml="auto">
            <LoadIndicator leg={railLeg} vehicle={tripId ? vehicles?.get(tripId) : undefined} noDataHint={noLoadHint} />
          </Box>
        )}
      </Flex>
    </Box>
  )
}
