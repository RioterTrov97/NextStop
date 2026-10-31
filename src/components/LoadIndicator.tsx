import { Flex, Text } from '@chakra-ui/react'
import type { VehicleInfo } from '../../shared/vehicles'
import type { Leg } from '../api/types'
import { occupancyFromEnum } from '../lib/occupancy'
import { loadCaption, rideLoad } from '../lib/rideLoad'
import { vehicleModeForLeg } from '../lib/journey'
import { MiniTrain } from './MiniTrain'
import { VehicleBody } from './VehicleBody'

const NO_DATA = occupancyFromEnum(undefined)

/** Width of the shape `LoadIndicator` draws (px), so a list can size one shared column to its widest row. */
export function loadIndicatorWidth(leg: Leg, vehicle?: VehicleInfo): number {
  const mode = vehicleModeForLeg(leg)
  if (mode === 'train' || mode === 'metro') {
    if (rideLoad(leg, vehicle)?.carriages) return mode === 'train' ? 82 : 67
    return mode === 'train' ? 74 : 58
  }
  return mode === 'bus' ? 48 : 58
}

/**
 * The small occupancy shape cards show for a ride: carriages for trains and metro that report them, otherwise the
 * whole vehicle. A tiny caption says when the figure is a forecast, covers the whole train only, or is missing.
 */
export function LoadIndicator({ leg, vehicle }: { leg: Leg; vehicle?: VehicleInfo }) {
  const mode = vehicleModeForLeg(leg)
  if (mode !== 'train' && mode !== 'metro' && mode !== 'bus' && mode !== 'lightrail') return null
  const load = rideLoad(leg, vehicle)
  const { caption, detail } = loadCaption(mode, load)

  return (
    <Flex direction="column" align="center" gap="3px" flexShrink={0} role="img" aria-label={detail} title={detail}>
      {load?.carriages && (mode === 'train' || mode === 'metro') ? (
        <MiniTrain mode={mode} vehicle={load.vehicle} />
      ) : (
        <VehicleBody mode={mode} color={(load?.level ?? NO_DATA).color} md={false} />
      )}
      {caption && (
        <Text fontSize="10px" lineHeight={1} fontWeight="semibold" color="fg.muted" whiteSpace="nowrap">
          {caption}
        </Text>
      )}
    </Flex>
  )
}
