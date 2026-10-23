import { Box, Button, HStack, Stack, Text } from '@chakra-ui/react'
import { clear as clearCache } from 'idb-keyval'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PageHeader } from '../components/PageHeader'
import { savedTrips, useSavedTrips } from '../store/savedTrips'

const THEMES = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
] as const

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const saved = useSavedTrips()
  const [confirm, setConfirm] = useState<'trips' | 'cache'>()

  return (
    <>
      <PageHeader title="Settings" />
      <Stack gap={6} p={4}>
        <Box>
          <Text fontWeight="semibold" mb={2}>
            Appearance
          </Text>
          <HStack gap={2}>
            {THEMES.map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                borderRadius="full"
                colorPalette="teal"
                variant={theme === k ? 'solid' : 'outline'}
                onClick={() => setTheme(k)}
              >
                {label}
              </Button>
            ))}
          </HStack>
        </Box>

        <Box>
          <Text fontWeight="semibold" mb={2}>
            Data on this device
          </Text>
          <HStack gap={2}>
            <Button size="sm" variant="outline" colorPalette="red" disabled={saved.length === 0} onClick={() => setConfirm('trips')}>
              Clear saved trips
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirm('cache')}>
              Clear cached data
            </Button>
          </HStack>
        </Box>

        <ConfirmDialog
          open={confirm === 'trips'}
          title="Remove all saved trips?"
          does={`Removes ${saved.length} saved trip${saved.length === 1 ? '' : 's'} from your home screen. This can't be undone.`}
          doesNot="Doesn't affect the trip you're currently following, your recent stations, your theme or the cached data. You can save trips again from Plan."
          confirmLabel="Remove all"
          onConfirm={() => savedTrips.clear()}
          onClose={() => setConfirm(undefined)}
        />
        <ConfirmDialog
          open={confirm === 'cache'}
          title="Clear cached data?"
          does="Deletes the offline copy of trip times and stop searches stored on this device, then reloads the app. Fresh data is fetched again, so you need a connection."
          doesNot="Doesn't remove your saved trips, the trip you're following, your recent stations or your theme."
          confirmLabel="Clear and reload"
          onConfirm={() => clearCache().then(() => location.reload())}
          onClose={() => setConfirm(undefined)}
        />

        <Box fontSize="sm" color="fg.muted">
          <Text fontWeight="semibold" color="fg" mb={1}>
            About
          </Text>
          <Text>
            NextStop uses Transport for NSW Open Data under the Creative Commons Attribution licence. Map tiles by OpenStreetMap
            contributors and CARTO. Carriage loads are only available for Sydney Trains and Metro services that are currently running.
          </Text>
        </Box>
      </Stack>
    </>
  )
}
