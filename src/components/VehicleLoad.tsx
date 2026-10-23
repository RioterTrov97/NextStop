import { Box, Flex, HStack, Text } from '@chakra-ui/react'
import { LuBus, LuTramFront } from 'react-icons/lu'
import type { VehicleInfo } from '../../shared/vehicles'
import { occupancyFromEnum, type OccupancyLevel } from '../lib/occupancy'

interface Props {
  mode: 'bus' | 'lightrail'
  vehicle?: VehicleInfo
  fallback?: OccupancyLevel
  /** `sm` for cards, `md` fills the width with a label. */
  size?: 'sm' | 'md'
}

/** Seat availability bar: more green segments means more room. Only filled segments render, never grey ones. */
const SEGMENTS: Record<number, number> = { 1: 4, 2: 2, 3: 1, 4: 1 }
const GREEN = '#22c55e'
const RED = '#ef4444'

export function VehicleLoad({ mode, vehicle, fallback, size = 'sm' }: Props) {
  const occ = vehicle?.occupancy !== undefined ? occupancyFromEnum(vehicle.occupancy) : fallback
  if (!occ || occ.level === 0) return null
  const md = size === 'md'
  const Icon = mode === 'bus' ? LuBus : LuTramFront
  const color = occ.level >= 4 ? RED : GREEN

  return (
    <Flex
      align="center"
      gap={md ? 3 : 1.5}
      w={md ? 'full' : undefined}
      role="img"
      aria-label={`${mode === 'bus' ? 'Bus' : 'Light rail'} load: ${occ.label}`}
    >
      <Box color="fg.muted" flexShrink={0}>
        <Icon size={md ? 22 : 15} />
      </Box>
      <HStack gap={md ? '4px' : '2px'} flex={md ? 1 : undefined}>
        {Array.from({ length: SEGMENTS[occ.level] ?? 1 }, (_, i) => (
          <Box key={i} w={md ? '36px' : '14px'} h={md ? '14px' : '8px'} borderRadius="full" style={{ background: color }} />
        ))}
      </HStack>
      {md && (
        <Text fontSize="sm" fontWeight="semibold" flexShrink={0} style={{ color: occ.color }}>
          {occ.label}
        </Text>
      )}
    </Flex>
  )
}
