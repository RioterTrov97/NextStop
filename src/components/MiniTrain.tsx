import { Box, Flex } from '@chakra-ui/react'
import { LuVolumeX } from 'react-icons/lu'
import { reportedCarriages, type VehicleInfo } from '../../shared/vehicles'
import { occupancyFromEnum, type OccupancyLevel } from '../lib/occupancy'
import { VehicleLoad } from './VehicleLoad'

interface Props {
  mode?: 'train' | 'metro'
  vehicle?: VehicleInfo
  /** Overall predicted occupancy, used when per-carriage data is unavailable. */
  fallback?: OccupancyLevel
  /** `sm` for cards, `md` fills the width and labels each carriage. */
  size?: 'sm' | 'md'
}

/** Compact strip widths: trains a quarter longer than the other shapes, metro carriages 15% longer. */
const SM_WIDTH = { train: 82, metro: 67 }

export function MiniTrain({ mode = 'train', vehicle, fallback, size = 'sm' }: Props) {
  const cars = reportedCarriages(vehicle?.carriages)
  const md = size === 'md'

  if (cars.length) {
    // A carriage that reports nothing stays grey rather than pretending to be empty.
    const levels = cars.map((c) => occupancyFromEnum(c.occupancy))

    return (
      <Flex
        // Compact strips share a fixed width whatever the train length, so they line up with the other load icons.
        w={md ? undefined : `${SM_WIDTH[mode]}px`}
        gap={md ? '3px' : '1.5px'}
        role="img"
        aria-label={`Carriage occupancy, front to back: ${levels.map((l) => l.short).join(', ')}`}
      >
        {cars.map((c, i) => (
          <Flex
            key={c.position}
            position="relative"
            flex={1}
            minW={0}
            maxW={md ? '48px' : undefined}
            h={md ? '28px' : '14px'}
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
              top={md ? '4px' : '3px'}
              left={md ? '5px' : '1px'}
              right={md ? '5px' : '1px'}
              h={md ? '7px' : '4px'}
              borderRadius="full"
              bg="whiteAlpha.700"
            />
            {md && (c.quiet ? <LuVolumeX size={11} /> : c.position)}
          </Flex>
        ))}
      </Flex>
    )
  }

  return <VehicleLoad mode={mode} vehicle={vehicle} fallback={fallback} />
}
