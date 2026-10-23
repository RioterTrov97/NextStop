import { Box, Button, HStack, Stack, Text } from '@chakra-ui/react'
import { useTheme } from 'next-themes'
import { PageHeader } from '../components/PageHeader'
import { savedTrips } from '../store/savedTrips'
import { clear as clearCache } from 'idb-keyval'

const THEMES = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
] as const

export default function Settings() {
  const { theme, setTheme } = useTheme()

  return (
    <>
      <PageHeader title="Settings" />
      <Stack gap={6} p={4}>
        <Box>
          <Text fontWeight="semibold" mb={2}>Appearance</Text>
          <HStack gap={2}>
            {THEMES.map(([k, label]) => (
              <Button key={k} size="sm" borderRadius="full" colorPalette="teal" variant={theme === k ? 'solid' : 'outline'} onClick={() => setTheme(k)}>
                {label}
              </Button>
            ))}
          </HStack>
        </Box>

        <Box>
          <Text fontWeight="semibold" mb={2}>Data on this device</Text>
          <HStack gap={2}>
            <Button size="sm" variant="outline" colorPalette="red" onClick={() => confirm('Remove all saved trips?') && savedTrips.clear()}>
              Clear saved trips
            </Button>
            <Button size="sm" variant="outline" onClick={() => clearCache().then(() => location.reload())}>
              Clear cached data
            </Button>
          </HStack>
        </Box>

        <Box fontSize="sm" color="fg.muted">
          <Text fontWeight="semibold" color="fg" mb={1}>About</Text>
          <Text>
            NextStop uses Transport for NSW Open Data under the Creative Commons Attribution licence. Map tiles by OpenStreetMap contributors and CARTO. Carriage
            loads are only available for Sydney Trains and Metro services that are currently running.
          </Text>
        </Box>
      </Stack>
    </>
  )
}
