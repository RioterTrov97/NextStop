import { Box, Flex, HStack, Text } from '@chakra-ui/react'
import { LuVolumeX } from 'react-icons/lu'
import type { VehicleInfo } from '../../shared/vehicles'
import { occupancyFromEnum, type OccupancyLevel } from '../lib/occupancy'

interface Props {
  vehicle?: VehicleInfo
  /** Overall predicted occupancy, used when per-carriage data is unavailable. */
  fallback?: OccupancyLevel
  /** `sm` for cards, `md` fills the width and labels each carriage. */
  size?: 'sm' | 'md'
}

export function MiniTrain({ vehicle, fallback, size = 'sm' }: Props) {
  const cars = vehicle?.carriages ?? []
  const md = size === 'md'

  if (cars.length) {
    const levels = cars.map((c) => occupancyFromEnum(c.occupancy))

    return (
      <Flex gap={md ? '3px' : '2px'} role="img" aria-label="Carriage occupancy, front to back">
        {cars.map((c, i) => (
          <Flex
            key={c.position}
            position="relative"
            w={md ? undefined : '13px'}
            flex={md ? 1 : undefined}
            maxW={md ? '48px' : undefined}
            h={md ? '28px' : '11px'}
            flexShrink={0}
            align="flex-end"
            justify="center"
            pb="2px"
            color="white"
            fontSize="10px"
            fontWeight="bold"
            borderRadius={md ? '6px' : '3px'}
            borderLeftRadius={i === 0 ? (md ? '14px' : '7px') : md ? '6px' : '3px'}
            style={{ background: levels[i].color }}
          >
            <Box
              position="absolute"
              top={md ? '4px' : '2px'}
              left={md ? '5px' : '3px'}
              right={md ? '5px' : '3px'}
              h={md ? '7px' : '3px'}
              borderRadius="full"
              bg="whiteAlpha.700"
            />
            {md && (c.quiet ? <LuVolumeX size={11} /> : c.position)}
          </Flex>
        ))}
      </Flex>
    )
  }

  const overall = vehicle?.occupancy !== undefined ? occupancyFromEnum(vehicle.occupancy) : fallback
  if (!overall || overall.level === 0) return null
  return (
    <HStack gap={1} fontSize="xs" color="fg.muted">
      <Box w={2} h={2} borderRadius="full" style={{ background: overall.color }} />
      <Text>{overall.label}</Text>
    </HStack>
  )
}
