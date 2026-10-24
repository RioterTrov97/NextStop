import { Box, Flex, HStack, Text } from '@chakra-ui/react'
import { LuVolumeX } from 'react-icons/lu'
import type { VehicleInfo } from '../../shared/vehicles'
import { occupancyFromEnum, type OccupancyLevel } from '../lib/occupancy'
import { MiniTrain } from './MiniTrain'
import { OccupancyInfo } from './OccupancyInfo'
import { VehicleLoad } from './VehicleLoad'

const LEGEND = [1, 2, 3, 4].map(occupancyFromEnum)

interface Props {
  vehicle?: VehicleInfo
  loading?: boolean
  /** Fallback textual occupancy from the trip planner leg */
  fallback?: OccupancyLevel
}

export function CarriageStrip({ vehicle, loading, fallback }: Props) {
  const cars = vehicle?.carriages ?? []

  if (!cars.length) {
    return (
      <Box bg="bg.muted" borderRadius="xl" p={3}>
        <VehicleLoad mode="train" vehicle={vehicle} fallback={fallback} loading={loading} size="md" />
      </Box>
    )
  }

  return (
    <Box bg="bg.muted" borderRadius="xl" p={3}>
      <Flex align="center" justify="space-between" mb={1}>
        <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
          CARRIAGE LOAD (front → back)
        </Text>
        <OccupancyInfo />
      </Flex>
      <MiniTrain vehicle={vehicle} size="md" />
      <HStack mt={2.5} gap={3} wrap="wrap" fontSize="xs" color="fg.muted">
        {LEGEND.map((l) => (
          <HStack key={l.label} gap={1}>
            <Box w={2} h={2} borderRadius="full" style={{ background: l.color }} />
            <span>{l.label}</span>
          </HStack>
        ))}
        <HStack gap={1}>
          <LuVolumeX size={12} />
          <span>Quiet</span>
        </HStack>
      </HStack>
    </Box>
  )
}
