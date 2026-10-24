import { Box, Button, Flex, HStack, Image, Stack, Text } from '@chakra-ui/react'
import { clear as clearCache } from 'idb-keyval'
import { useTheme } from 'next-themes'
import { useRef, useState } from 'react'
import { LuEraser, LuTriangleAlert } from 'react-icons/lu'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ModePicker } from '../components/ModePicker'
import { WalkOptions } from '../components/WalkOptions'
import { PageHeader } from '../components/PageHeader'
import { exportBackup, importBackup } from '../lib/backup'
import { history, useSearchHistory, useTripHistory } from '../store/history'
import { savedTrips, useSavedTrips } from '../store/savedTrips'
import { EXPAND_OPTIONS, HISTORY_OPTIONS, settings, useSettings } from '../store/settings'

const THEMES = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
] as const

async function resetApp() {
  localStorage.clear()
  sessionStorage.clear()
  await Promise.allSettled([
    clearCache(),
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
    navigator.serviceWorker?.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister()))),
  ])
  location.replace('/')
}

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const saved = useSavedTrips()
  const tripHistory = useTripHistory()
  const searchHistory = useSearchHistory()
  const { expandUpTo, preferredModes, historyLimit } = useSettings()
  const [confirm, setConfirm] = useState<'trips' | 'cache' | 'reset' | 'tripHistory' | 'searchHistory'>()
  const [backupMsg, setBackupMsg] = useState<string>()
  const fileInput = useRef<HTMLInputElement>(null)

  return (
    <>
      <PageHeader title="Settings" />
      <Stack gap={6} p={4}>
        <Stack gap={3} p={4} bg="bg.panel" borderWidth="1px" borderRadius="2xl" shadow="xs">
          <Flex align="center" gap={3}>
            <Image src="/logo-mark.svg" alt="" h="36px" />
            <Box>
              <Text fontWeight="bold" lineHeight="short">
                NextStop
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Live Sydney public transport
              </Text>
            </Box>
          </Flex>
          <Stack as="ul" gap={1.5} ps={0} listStyleType="none" fontSize="sm" color="fg.muted">
            <Text as="li">Data: Transport for NSW Open Data, CC BY licence.</Text>
            <Text as="li">Maps: MapTiler and OpenStreetMap contributors.</Text>
            <Text as="li">Carriage loads: Sydney Trains and Metro services currently running.</Text>
          </Stack>
        </Stack>

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
          <Text fontWeight="semibold">Transport modes</Text>
          <Text fontSize="sm" color="fg.muted" mb={2}>
            Pre-selected when you plan a new trip. You can still change them for each search.
          </Text>
          <ModePicker hideWalk value={preferredModes} onChange={(preferredModes) => settings.set({ preferredModes })} />
          <Text fontSize="xs" color="fg.muted" mt={2}>
            {preferredModes.length ? 'Only the selected modes by default.' : 'All modes by default.'}
          </Text>
        </Box>

        <WalkOptions />

        <Box>
          <Text fontWeight="semibold">Saved trip cards</Text>
          <Text fontSize="sm" color="fg.muted" mb={2}>
            Show upcoming departures on each card while you have up to this many saved trips. With more, cards show just the route.
          </Text>
          <HStack gap={2} wrap="wrap">
            {EXPAND_OPTIONS.map((n) => (
              <Button
                key={n}
                size="sm"
                borderRadius="full"
                colorPalette="teal"
                variant={expandUpTo === n ? 'solid' : 'outline'}
                aria-pressed={expandUpTo === n}
                onClick={() => settings.set({ expandUpTo: n })}
              >
                {n === 0 ? 'Never' : n}
              </Button>
            ))}
          </HStack>
        </Box>

        <Box>
          <Text fontWeight="semibold">History size</Text>
          <Text fontSize="sm" color="fg.muted" mb={2}>
            How many followed trips and searches to keep, each. Older ones are dropped first.
          </Text>
          <HStack gap={2} wrap="wrap">
            {HISTORY_OPTIONS.map((n) => (
              <Button
                key={n}
                size="sm"
                borderRadius="full"
                colorPalette="teal"
                variant={historyLimit === n ? 'solid' : 'outline'}
                aria-pressed={historyLimit === n}
                onClick={() => {
                  settings.set({ historyLimit: n })
                  history.trim()
                }}
              >
                {n}
              </Button>
            ))}
          </HStack>
        </Box>

        <Box>
          <Text fontWeight="semibold">Backup</Text>
          <Text fontSize="sm" color="fg.muted" mb={2}>
            Removing the app from your home screen erases its data. Save a backup file of your saved trips, history and settings to restore
            after reinstalling.
          </Text>
          <HStack gap={2}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportBackup().catch((e: Error) => setBackupMsg(`Could not export backup: ${e.message}`))}
            >
              Export backup
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
              Import backup
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                importBackup(file).then(
                  () => location.reload(),
                  (err: Error) => setBackupMsg(err.message),
                )
              }}
            />
          </HStack>
          {backupMsg && (
            <Text fontSize="xs" color="red.fg" mt={2}>
              {backupMsg}
            </Text>
          )}
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
          <HStack gap={2} mt={2} wrap="wrap">
            <Button size="sm" variant="outline" disabled={tripHistory.length === 0} onClick={() => setConfirm('tripHistory')}>
              Clear trip history
            </Button>
            <Button size="sm" variant="outline" disabled={searchHistory.length === 0} onClick={() => setConfirm('searchHistory')}>
              Clear search history
            </Button>
          </HStack>
        </Box>

        <Stack gap={4} p={4} borderWidth="1px" borderColor="red.muted" bg="red.subtle" borderRadius="2xl">
          <Flex gap={3} align="flex-start">
            <Box display="grid" placeItems="center" boxSize="40px" flexShrink={0} borderRadius="xl" bg="red.muted" color="red.fg">
              <LuTriangleAlert size={20} />
            </Box>
            <Box minW={0}>
              <Text fontWeight="semibold">Reset app</Text>
              <Text fontSize="sm" color="fg.muted">
                Erases saved trips, history, settings and cached data on this device, then starts fresh like a new install.
              </Text>
            </Box>
          </Flex>
          <Button colorPalette="red" variant="solid" borderRadius="xl" onClick={() => setConfirm('reset')}>
            <LuEraser /> Erase everything
          </Button>
        </Stack>

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
          open={confirm === 'tripHistory'}
          title="Clear trip history?"
          does={`Removes ${tripHistory.length} followed trip${tripHistory.length === 1 ? '' : 's'} from the History tab.`}
          doesNot="Doesn't affect saved trips, search history or the trip you're currently following."
          confirmLabel="Clear history"
          onConfirm={() => history.clearTrips()}
          onClose={() => setConfirm(undefined)}
        />
        <ConfirmDialog
          open={confirm === 'searchHistory'}
          title="Clear search history?"
          does={`Removes ${searchHistory.length} recent search${searchHistory.length === 1 ? '' : 'es'} from Plan and the History tab.`}
          doesNot="Doesn't affect saved trips, trip history or your recent stations."
          confirmLabel="Clear history"
          onConfirm={() => history.clearSearches()}
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

        <ConfirmDialog
          open={confirm === 'reset'}
          title="Reset the app?"
          does="Deletes everything stored on this device: saved trips, the trip you're following, history, recent stations, settings, theme and cached data. Then reloads the app as if freshly installed."
          doesNot="Nothing is stored on a server, so there's nothing to recover afterwards. This can't be undone."
          confirmLabel="Reset everything"
          onConfirm={resetApp}
          onClose={() => setConfirm(undefined)}
        />
      </Stack>
    </>
  )
}
