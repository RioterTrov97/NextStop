import { Box, CloseButton, Dialog, Flex, HStack, IconButton, Portal, Stack, Text } from '@chakra-ui/react'
import { LuInfo, LuVolumeX } from 'react-icons/lu'
import { occupancyFromEnum } from '../lib/occupancy'
import { VehicleBody } from './VehicleBody'

const LEVELS = [
  { level: occupancyFromEnum(1), text: 'Lots of free seats. Easy to sit down.' },
  { level: occupancyFromEnum(2), text: 'A handful of seats left. You may need to look around.' },
  { level: occupancyFromEnum(3), text: 'Seats are taken. Expect to stand.' },
  { level: occupancyFromEnum(4), text: 'Packed and may be hard to board. Consider the next service.' },
]

const SOURCES = [
  { mode: 'Train', text: 'Each carriage, shown front to back.' },
  { mode: 'Metro and bus', text: 'The whole vehicle, so every carriage shares one colour.' },
  { mode: 'Light rail', text: "Not reported by Transport for NSW, so it isn't shown." },
]

export function OccupancyInfo() {
  return (
    <Dialog.Root placement="center" lazyMount>
      <Dialog.Trigger asChild>
        <IconButton aria-label="What do the occupancy colours mean?" variant="ghost" size="xs" color="fg.muted" flexShrink={0}>
          <LuInfo />
        </IconButton>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content mx={4} borderRadius="2xl">
            <Dialog.Header>
              <Dialog.Title>How busy is it?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={4} fontSize="sm">
                <Stack gap={3}>
                  {LEVELS.map(({ level, text }) => (
                    <Flex key={level.label} align="center" gap={3}>
                      <VehicleBody mode="metro" color={level.color} md={false} />
                      <Box>
                        <Text fontWeight="semibold">{level.label}</Text>
                        <Text color="fg.muted">{text}</Text>
                      </Box>
                    </Flex>
                  ))}
                  <HStack gap={3}>
                    <Flex w="50px" justify="center" color="fg.muted" flexShrink={0}>
                      <LuVolumeX size={16} />
                    </Flex>
                    <Box>
                      <Text fontWeight="semibold">Quiet carriage</Text>
                      <Text color="fg.muted">Keep conversations and phone calls down.</Text>
                    </Box>
                  </HStack>
                </Stack>
                <Box borderTopWidth="1px" pt={3}>
                  <Text fontWeight="semibold" mb={1}>
                    What it covers
                  </Text>
                  <Stack gap={1} color="fg.muted">
                    {SOURCES.map((s) => (
                      <Text key={s.mode}>
                        <Text as="span" fontWeight="semibold" color="fg">
                          {s.mode}:
                        </Text>{' '}
                        {s.text}
                      </Text>
                    ))}
                  </Stack>
                  <Text color="fg.muted" mt={2}>
                    Live from Transport for NSW and refreshed every 15 seconds while you're watching.
                  </Text>
                </Box>
              </Stack>
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
