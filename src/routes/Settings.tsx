import { Box, Button, Flex, Heading, HStack, SimpleGrid, Stack, StackSeparator, Text } from '@chakra-ui/react'
import { clear as clearCache } from 'idb-keyval'
import { useTheme } from 'next-themes'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LuCheck, LuEraser, LuTriangleAlert } from 'react-icons/lu'
import { ACCENTS } from '../../shared/brand'
import { BrandMark } from '../components/BrandMark'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ModePicker } from '../components/ModePicker'
import { WalkOptions } from '../components/WalkOptions'
import { PageHeader } from '../components/PageHeader'
import { SavedPlacesEditor } from '../components/SavedPlacesEditor'
import { accentPalette } from '../lib/accent'
import { exportBackup, importBackup } from '../lib/backup'
import { FARE_TYPES, FARES_FROM } from '../lib/fares'
import { history, useSearchHistory, useTripHistory } from '../store/history'
import { savedTrips, useSavedTrips } from '../store/savedTrips'
import { EXPAND_OPTIONS, HISTORY_OPTIONS, settings, useSettings } from '../store/settings'

function AboutRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Flex gap={3}>
      <Text w="104px" flexShrink={0} color="fg.muted">
        {label}
      </Text>
      <Text flex={1}>{children}</Text>
    </Flex>
  )
}

const SECTIONS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'planning', label: 'Trip planning' },
  { id: 'places', label: 'Places' },
  { id: 'home', label: 'Home screen' },
  { id: 'data', label: 'History and data' },
  { id: 'about', label: 'About' },
] as const
type SectionId = (typeof SECTIONS)[number]['id']

// Clears the sticky header (title plus the section row) when a section is scrolled to.
const SECTION_OFFSET = 'calc(env(safe-area-inset-top) + 112px)'

/** One group of settings: a heading and a card whose items are split by thin lines. */
function Section({ id, title, children, after }: { id: SectionId; title: string; children: ReactNode; after?: ReactNode }) {
  return (
    <Box as="section" id={id} aria-labelledby={`${id}-title`} scrollMarginTop={SECTION_OFFSET} data-section={id}>
      <Heading id={`${id}-title`} as="h2" size="md" fontWeight="bold" mb={2} px={1}>
        {title}
      </Heading>
      <Stack gap={4} p={4} bg="bg.panel" borderWidth="1px" borderRadius="2xl" shadow="xs" separator={<StackSeparator />}>
        {children}
      </Stack>
      {after}
    </Box>
  )
}

/** A setting: its name, what it does, the choices, and an optional note under them. */
function Item({ title, hint, note, children }: { title: string; hint?: ReactNode; note?: ReactNode; children: ReactNode }) {
  return (
    <Box>
      <Text fontWeight="semibold">{title}</Text>
      {hint && (
        <Text fontSize="sm" color="fg.muted">
          {hint}
        </Text>
      )}
      <Box mt={2}>{children}</Box>
      {note && (
        <Text fontSize="xs" color="fg.muted" mt={2}>
          {note}
        </Text>
      )}
    </Box>
  )
}

/** Pill choices, one of them selected. */
function Choices<T extends string | number | boolean>({
  value,
  options,
  onPick,
}: {
  value: T
  options: readonly (readonly [T, string])[]
  onPick: (v: T) => void
}) {
  return (
    <HStack gap={2} wrap="wrap">
      {options.map(([v, label]) => (
        <Button
          key={String(v)}
          size="sm"
          borderRadius="full"
          colorPalette="brand"
          variant={value === v ? 'solid' : 'outline'}
          aria-pressed={value === v}
          onClick={() => onPick(v)}
        >
          {label}
        </Button>
      ))}
    </HStack>
  )
}

/** The app colours as swatches, each in its own colour, with its name under it. */
function AccentPicker({ value }: { value: string }) {
  return (
    <SimpleGrid columns={3} gap={3}>
      {ACCENTS.map((a) => {
        const on = value === a.key
        // The colour of its buttons, so the swatch shows what choosing it gives.
        const colour = accentPalette(a.key).brand[600]
        return (
          <Flex
            key={a.key}
            as="button"
            direction="column"
            align="center"
            gap={1.5}
            py={1}
            borderRadius="xl"
            aria-pressed={on}
            aria-label={`${a.label} colour`}
            onClick={() => settings.set({ accent: a.key })}
            _focusVisible={{ outline: '2px solid', outlineColor: 'brand.focusRing' }}
          >
            <Box
              display="grid"
              placeItems="center"
              boxSize="40px"
              borderRadius="full"
              color="white"
              style={{
                background: colour,
                // A ring in the swatch's colour, set off from it by a gap in the panel colour.
                boxShadow: on ? `0 0 0 3px var(--chakra-colors-bg-panel), 0 0 0 5px ${colour}` : 'inset 0 0 0 1px rgba(0,0,0,0.08)',
              }}
            >
              {on && <LuCheck size={20} strokeWidth={3} aria-hidden />}
            </Box>
            <Text fontSize="xs" fontWeight={on ? 'semibold' : 'normal'} color={on ? 'fg' : 'fg.muted'}>
              {a.label}
            </Text>
          </Flex>
        )
      })}
    </SimpleGrid>
  )
}

/** The section that is at the top of the screen, for the section row. */
function useCurrentSection(): SectionId {
  const [current, setCurrent] = useState<SectionId>(SECTIONS[0].id)
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e)
    const visible = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting)
        // At the bottom of the page the last sections never reach the top band, so take the last one shown.
        const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
        const shown = SECTIONS.filter((s) => visible.get(s.id))
        const pick = atEnd ? shown[shown.length - 1] : shown[0]
        if (pick) setCurrent(pick.id)
      },
      // The band just under the sticky header.
      { rootMargin: '-140px 0px -55% 0px' },
    )
    els.forEach((e) => observer.observe(e))
    return () => observer.disconnect()
  }, [])
  return current
}

/** A row of section names under the title: tap one to jump to it. Scrolls sideways on narrow screens. */
function SectionNav({ current }: { current: SectionId }) {
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => {
    row.current?.querySelector<HTMLElement>(`[data-id="${current}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [current])
  return (
    <HStack
      ref={row}
      as="nav"
      aria-label="Settings sections"
      gap={2}
      mt={3}
      mx={-4}
      px={4}
      overflowX="auto"
      css={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
    >
      {SECTIONS.map((s) => (
        <Button
          key={s.id}
          data-id={s.id}
          size="xs"
          flexShrink={0}
          borderRadius="full"
          colorPalette="brand"
          variant={current === s.id ? 'solid' : 'subtle'}
          aria-current={current === s.id ? 'true' : undefined}
          onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          {s.label}
        </Button>
      ))}
    </HStack>
  )
}

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
  const { expandUpTo, preferredModes, historyLimit, fareType, reduceTransparency, tintByLine, accent } = useSettings()
  const [confirm, setConfirm] = useState<'trips' | 'cache' | 'reset' | 'tripHistory' | 'searchHistory'>()
  const [backupMsg, setBackupMsg] = useState<string>()
  const fileInput = useRef<HTMLInputElement>(null)
  const current = useCurrentSection()

  return (
    <>
      <PageHeader title="Settings">
        <SectionNav current={current} />
      </PageHeader>
      <Stack gap={7} p={4} pb={8}>
        <Section id="appearance" title="Appearance">
          <Item title="Light or dark">
            <Choices value={(theme ?? 'system') as (typeof THEMES)[number][0]} options={THEMES} onPick={setTheme} />
          </Item>
          <Item title="App colour" hint="Buttons, tabs and highlights across the app. Line badges always keep their official colours.">
            <AccentPicker value={accent} />
          </Item>
          <Item title="Glass" hint="The tab bar, the trip you're following, menus and map buttons are see-through. Solid ones are easier to read.">
            <Choices
              value={reduceTransparency}
              options={[
                [false, 'See-through'],
                [true, 'Solid'],
              ]}
              onPick={(v) => settings.set({ reduceTransparency: v })}
            />
          </Item>
          <Item
            title="Line colours"
            hint="Trip details, the trip you're following, search results and station boards take the colour of their line."
          >
            <Choices
              value={tintByLine}
              options={[
                [true, 'Colour by line'],
                [false, 'Plain'],
              ]}
              onPick={(v) => settings.set({ tintByLine: v })}
            />
          </Item>
        </Section>

        <Section id="planning" title="Trip planning">
          <Item
            title="Transport modes"
            hint="Pre-selected when you plan a new trip. You can still change them for each search."
            note={preferredModes.length ? 'Only the selected modes by default.' : 'All modes by default.'}
          >
            <ModePicker hideWalk value={preferredModes} onChange={(preferredModes) => settings.set({ preferredModes })} />
          </Item>
          <WalkOptions />
          <Item
            title="Opal fare"
            hint="Trip details estimate the fare for this card type, with an Opal card or contactless card."
            note={`Worked out on this phone from Transport for NSW fares from ${FARES_FROM}. What you're charged can differ, for example after earlier trips today or once you reach the weekly cap.`}
          >
            <Choices value={fareType} options={FARE_TYPES.map((f) => [f.key, f.label] as const)} onPick={(v) => settings.set({ fareType: v })} />
          </Item>
        </Section>

        <Section id="places" title="Places">
          <SavedPlacesEditor />
        </Section>

        <Section id="home" title="Home screen">
          <Item
            title="Saved trip cards"
            hint='Show upcoming departures on this many saved cards, from the top. The rest show just the route. Trips set to the current time of day appear under "Active now" with departures.'
          >
            <Choices
              value={expandUpTo}
              options={EXPAND_OPTIONS.map((n) => [n, n === 0 ? 'Never' : String(n)] as const)}
              onPick={(v) => settings.set({ expandUpTo: v })}
            />
          </Item>
        </Section>

        <Section
          id="data"
          title="History and data"
          after={
            <Stack gap={4} p={4} mt={4} borderWidth="1px" borderColor="red.muted" bg="red.subtle" borderRadius="2xl">
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
          }
        >
          <Item title="History size" hint="How many followed trips and searches to keep, each. Older ones are dropped first.">
            <Choices
              value={historyLimit}
              options={HISTORY_OPTIONS.map((n) => [n, String(n)] as const)}
              onPick={(v) => {
                settings.set({ historyLimit: v })
                history.trim()
              }}
            />
          </Item>
          <Item
            title="Backup"
            hint="Removing the app from your home screen erases its data. Save a backup file of your saved trips, history and settings to restore after reinstalling."
          >
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
          </Item>
          <Item title="Data on this device">
            <HStack gap={2} wrap="wrap">
              <Button size="sm" variant="outline" colorPalette="red" disabled={saved.length === 0} onClick={() => setConfirm('trips')}>
                Clear saved trips
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirm('cache')}>
                Clear cached data
              </Button>
              <Button size="sm" variant="outline" disabled={tripHistory.length === 0} onClick={() => setConfirm('tripHistory')}>
                Clear trip history
              </Button>
              <Button size="sm" variant="outline" disabled={searchHistory.length === 0} onClick={() => setConfirm('searchHistory')}>
                Clear search history
              </Button>
            </HStack>
          </Item>
        </Section>

        <Section id="about" title="About">
          <Flex align="center" gap={3}>
            <BrandMark size={56} aria-hidden />
            <Box flex={1}>
              <Text fontWeight="bold" lineHeight="short">
                NextStop
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Live Sydney public transport
              </Text>
            </Box>
            <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums">
              v{__APP_VERSION__}
            </Text>
          </Flex>
          <Stack gap={3} fontSize="sm">
            <AboutRow label="Data">Transport for NSW Open Data, licensed CC BY 4.0</AboutRow>
            <AboutRow label="Maps">MapTiler and OpenStreetMap contributors</AboutRow>
            <AboutRow label="Carriage loads">
              Live for Waratah trains and Metro while running. Other services show the trip planner's forecast, marked "est."
            </AboutRow>
          </Stack>
          <Text fontSize="xs" color="fg.muted">
            An independent app, not affiliated with or endorsed by Transport for NSW.
          </Text>
        </Section>

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
