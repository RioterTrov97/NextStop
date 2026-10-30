import { Box, Flex, Text } from '@chakra-ui/react'
import { LuBus, LuTrainFront, LuTramFront } from 'react-icons/lu'
import type { VehicleInfo } from '../../shared/vehicles'
import { occupancyFromEnum, type OccupancyLevel } from '../lib/occupancy'
import { OccupancyInfo } from './OccupancyInfo'
import { VehicleBody, type VehicleKind } from './VehicleBody'

interface Props {
  mode: VehicleKind
  vehicle?: VehicleInfo
  fallback?: OccupancyLevel
  loading?: boolean
  /** `sm` for cards, `md` for the detail view with a label. */
  size?: 'sm' | 'md'
}

const ICONS = { train: LuTrainFront, bus: LuBus, lightrail: LuTramFront, metro: LuTrainFront }
const NAMES = { train: 'Train', bus: 'Bus', lightrail: 'Light rail', metro: 'Metro' }

export function VehicleLoad({ mode, vehicle, fallback, loading, size = 'sm' }: Props) {
  const live = vehicle?.occupancy !== undefined
  const occ = live ? occupancyFromEnum(vehicle.occupancy) : fallback
  // The planner's figure is a forecast, not a measurement, so it is labelled as one.
  const predicted = !live && !!occ && occ.level > 0
  const md = size === 'md'
  if (!occ || occ.level === 0) {
    // Sydney light rail never reports occupancy, so a permanent "no data" note would just be noise.
    if (!md || mode === 'lightrail') return null
    const Icon = ICONS[mode]
    return (
      <Flex align="center" gap={3} color="fg.muted" role="img" aria-label={`${NAMES[mode]} load: no data`}>
        <Icon size={22} />
        <Text fontSize="sm">
          {loading
            ? 'Checking occupancy…'
            : vehicle
              ? "This service doesn't report how busy it is."
              : 'Occupancy appears once the service is running.'}
        </Text>
      </Flex>
    )
  }

  if (!md) {
    return (
      <Flex
        direction="column"
        align="center"
        gap="3px"
        role="img"
        aria-label={`${NAMES[mode]} load: ${occ.label}${predicted ? ' (predicted)' : ''}`}
        title={predicted ? 'Predicted by the trip planner' : undefined}
      >
        <VehicleBody mode={mode} color={occ.color} md={false} />
        <Text fontSize="10px" lineHeight={1} fontWeight="semibold" color="fg.muted" whiteSpace="nowrap">
          {occ.short}
          {predicted && '*'}
        </Text>
      </Flex>
    )
  }
  const visual = (
    <Flex align="center" gap={3} role="img" aria-label={`${NAMES[mode]} load: ${occ.label}${predicted ? ' (predicted)' : ''}`}>
      <VehicleBody mode={mode} color={occ.color} md />
      <Box>
        <Text fontSize="sm" fontWeight="semibold">
          {occ.label}
        </Text>
        {predicted && (
          <Text fontSize="xs" color="fg.muted">
            Predicted, not live
          </Text>
        )}
      </Box>
    </Flex>
  )
  return (
    <Flex align="center" justify="space-between" gap={2}>
      {visual}
      <OccupancyInfo />
    </Flex>
  )
}
