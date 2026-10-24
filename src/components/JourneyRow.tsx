import { Box, Flex, HStack, Text } from '@chakra-ui/react'
import { LuTriangleAlert } from 'react-icons/lu'
import type { VehicleInfo } from '../../shared/vehicles'
import type { Journey } from '../api/types'
import { isTransit, journeyAlerts, legOccupancy, platformOf, summarize, trailingWalk, vehicleModeForLeg } from '../lib/journey'
import { countdown, formatDuration, formatTime } from '../lib/time'
import { useSettings } from '../store/settings'
import { DelayBadge } from './DelayBadge'
import { LineBadge } from './LineBadge'
import { MiniTrain } from './MiniTrain'
import { VehicleLoad } from './VehicleLoad'
import { WalkBadge } from './WalkBadge'

interface Props {
  journey: Journey
  now: number
  vehicles?: Map<string, VehicleInfo>
  onClick?: () => void
}

export function JourneyRow({ journey, now, vehicles, onClick }: Props) {
  const { walkPace } = useSettings()
  const s = summarize(journey)
  const dep = s.depEstimated ?? s.depPlanned
  const arr = s.arrEstimated ?? s.arrPlanned
  const alerts = journeyAlerts(journey).filter((a) => a.priority === 'high' || a.priority === 'veryHigh')
  const transit = journey.legs.filter(isTransit)
  const tailWalk = trailingWalk(journey, walkPace)
  const platform = s.firstTransit ? platformOf(s.firstTransit) : undefined
  const origin = s.firstTransit?.origin
  const station = (origin?.disassembledName ?? origin?.name ?? '').split(',')[0].replace(/ (Station|Platform).*$/i, '')
  const railLeg = transit.find((l) => ['train', 'metro', 'bus', 'lightrail'].includes(vehicleModeForLeg(l) ?? ''))
  const tripId = railLeg?.transportation?.properties?.RealtimeTripId
  const tileSize = transit.length > 2 ? 'sm' : 'md'

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
        <Text truncate fontWeight="medium">
          {station} {platform && `- Platform ${platform}`}
        </Text>
        <Text flexShrink={0}>{formatDuration(s.durationSec)}</Text>
      </Flex>

      <Flex justify="space-between" align="center" gap={2} mt={1.5}>
        <Text fontSize="2xl" fontWeight="bold" whiteSpace="nowrap">
          {formatTime(dep)}{' '}
          <Text as="span" color="fg.muted" fontWeight="normal">
            →
          </Text>{' '}
          {formatTime(arr)}
        </Text>
        <Text fontSize="2xl" fontWeight="bold" color="teal.500" fontVariantNumeric="tabular-nums" whiteSpace="nowrap">
          {countdown(dep, now)}
        </Text>
      </Flex>

      <Flex mt={2.5} align="center" gap={2} wrap="wrap">
        <HStack gap={1.5} wrap="wrap">
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
            cancelled={s.firstTransit?.properties?.isCancelled === true}
          />
          {alerts.length > 0 && (
            <Box color="orange.500" aria-label="Service alert">
              <LuTriangleAlert />
            </Box>
          )}
        </HStack>
        {railLeg && (
          <Box ml="auto">
            {(() => {
              const m = vehicleModeForLeg(railLeg)
              const v = tripId ? vehicles?.get(tripId) : undefined
              return m === 'bus' || m === 'lightrail' || m === 'metro' ? (
                <VehicleLoad mode={m} vehicle={v} fallback={legOccupancy(railLeg)} />
              ) : (
                <MiniTrain vehicle={v} fallback={legOccupancy(railLeg)} />
              )
            })()}
          </Box>
        )}
      </Flex>
    </Box>
  )
}
