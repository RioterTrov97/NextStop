import { Box, Button, HStack, Stack, Text } from '@chakra-ui/react'
import { END_WALK_OPTIONS, WALK_PACES, settings, useSettings } from '../store/settings'

const chip = (on: boolean) =>
  ({ size: 'sm', borderRadius: 'full', variant: on ? 'solid' : 'outline', colorPalette: 'teal', 'aria-pressed': on }) as const

/** The two global walking preferences, shared by Settings and the shortcut dialog. */
export function WalkOptions({ onPick }: { onPick?: () => void }) {
  const { maxEndWalk, walkPace } = useSettings()
  return (
    <Stack gap={5}>
      <Box>
        <Text fontWeight="semibold">Walking at the end</Text>
        <Text fontSize="sm" color="fg.muted" mb={2}>
          The longest walk you accept after your last ride. Trips that need a longer walk are hidden.
        </Text>
        <HStack gap={2} wrap="wrap">
          {END_WALK_OPTIONS.map((n) => (
            <Button
              key={n}
              {...chip(maxEndWalk === n)}
              onClick={() => {
                settings.set({ maxEndWalk: n })
                onPick?.()
              }}
            >
              {n === 0 ? 'No walking' : `${n} min`}
            </Button>
          ))}
        </HStack>
      </Box>
      <Box>
        <Text fontWeight="semibold">Walking pace</Text>
        <Text fontSize="sm" color="fg.muted" mb={2}>
          How fast you walk between stops and platforms. Relaxed leaves more time to change, for example from Town Hall to the light rail.
        </Text>
        <HStack gap={2} wrap="wrap">
          {WALK_PACES.map((w) => (
            <Button
              key={w.key}
              {...chip(walkPace === w.key)}
              onClick={() => {
                settings.set({ walkPace: w.key })
                onPick?.()
              }}
            >
              {w.label}
            </Button>
          ))}
        </HStack>
        <Text fontSize="xs" color="fg.muted" mt={2}>
          {WALK_PACES.find((w) => w.key === walkPace)?.hint}.
        </Text>
      </Box>
    </Stack>
  )
}
