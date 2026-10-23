import { Box, HStack, Text } from '@chakra-ui/react'
import { LuVolumeX } from 'react-icons/lu'
import type { VehicleInfo } from '../../shared/vehicles'
import { occupancyFromEnum } from '../lib/occupancy'
import { MiniTrain } from './MiniTrain'

const LEGEND = [1, 2, 3, 4].map(occupancyFromEnum)

interface Props {
  vehicle?: VehicleInfo
  loading?: boolean
  /** Fallback textual occupancy from the trip planner leg */
  fallback?: { label: string; color: string; level: number }
}

export function CarriageStrip({ vehicle, loading, fallback }: Props) {
  const cars = vehicle?.carriages ?? []

  if (!cars.length) {
    const overall = vehicle?.occupancy !== undefined ? occupancyFromEnum(vehicle.occupancy) : fallback
    return (
      <Box bg="bg.muted" borderRadius="lg" p={3} fontSize="sm">
        {overall && overall.level > 0 ? (
          <HStack>
            <Box w={3} h={3} borderRadius="full" style={{ background: overall.color }} />
            <Text>{overall.label}</Text>
          </HStack>
        ) : (
          <Text color="fg.muted">{loading ? 'Checking carriage loads…' : 'Carriage loads appear once the service is running.'}</Text>
        )}
      </Box>
    )
  }

  return (
    <Box bg="bg.muted" borderRadius="xl" p={3}>
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb={2}>
        CARRIAGE LOAD (front → back)
      </Text>
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
