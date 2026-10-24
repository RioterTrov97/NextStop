import { Box, Flex } from '@chakra-ui/react'

// Metro cars have a sleek slanted nose instead of the train's rounded one.
const METRO_NOSE = 'polygon(0 100%, 0 62%, 22% 8%, 38% 0, 100% 0, 100% 100%)'

export type VehicleKind = 'train' | 'bus' | 'lightrail' | 'metro'

/** Vehicle drawn in the MiniTrain style and coloured by the whole-vehicle load: a bus with wheels, a four-car metro with a pointed nose, or a rounded train/tram. */
export function VehicleBody({ mode, color, md }: { mode: VehicleKind; color: string; md: boolean }) {
  const bus = mode === 'bus'
  const metro = mode === 'metro'
  const cars = bus ? 1 : 4
  const h = md ? '28px' : '11px'
  const top = md ? '5px' : '2px'
  const glass = md ? '8px' : '3px'
  return (
    <Flex align="center" gap={md ? '6px' : '3px'} flexShrink={0}>
      <Box position="relative" pb={bus ? (md ? '5px' : '2px') : 0}>
        <Flex gap={md ? '3px' : '2px'}>
          {Array.from({ length: cars }, (_, c) => (
            <Box
              key={c}
              position="relative"
              w={md ? (bus ? '92px' : '28px') : bus ? '30px' : '11px'}
              h={h}
              borderRadius={md ? '6px' : '3px'}
              borderLeftRadius={c > 0 ? (md ? '6px' : '3px') : bus ? (md ? '10px' : '4px') : md ? '14px' : '7px'}
              style={{ background: color, clipPath: metro && c === 0 ? METRO_NOSE : undefined }}
            >
              {c === 0 && !metro && (
                <Box
                  position="absolute"
                  top={top}
                  left={md ? '4px' : '2px'}
                  w={md ? '9px' : '3px'}
                  h={md ? '14px' : '5px'}
                  borderRadius={md ? '4px' : '1.5px'}
                  bg="whiteAlpha.900"
                />
              )}
              <Flex
                position="absolute"
                top={top}
                left={c === 0 ? (metro ? (md ? '14px' : '5px') : md ? '17px' : '6px') : md ? '5px' : '2px'}
                right={md ? '5px' : '2px'}
                gap={md ? '3px' : '1px'}
              >
                {Array.from({ length: metro ? 1 : md ? (bus ? 5 : c === 0 ? 1 : 2) : bus ? 3 : 1 }, (_, i) => (
                  <Box key={i} flex={1} h={glass} borderRadius={md ? '2px' : '1px'} bg="whiteAlpha.700" />
                ))}
              </Flex>
            </Box>
          ))}
        </Flex>
        {bus &&
          [md ? '16px' : '5px', md ? '66px' : '21px'].map((left) => (
            <Box
              key={left}
              position="absolute"
              bottom={0}
              left={left}
              w={md ? '11px' : '5px'}
              h={md ? '11px' : '5px'}
              borderRadius="full"
              bg="gray.700"
              borderWidth={md ? '2px' : '1px'}
              borderColor="bg.muted"
            />
          ))}
      </Box>
    </Flex>
  )
}
