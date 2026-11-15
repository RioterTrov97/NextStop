import { Box, Button, Flex, Input, Spinner, Text } from '@chakra-ui/react'
import { createElement, Fragment, useState } from 'react'
import type { IconType } from 'react-icons'
import { LuBriefcase, LuBus, LuHouse, LuLandmark, LuLocateFixed, LuMapPin, LuTrainFront } from 'react-icons/lu'
import { useDebounced, useStopSearch } from '../api/hooks'
import type { Place } from '../api/types'
import { MODES } from '../lib/lines'
import { currentPlace, LOCATION_ERRORS, type LocationError } from '../lib/location'
import { placeKind, type PlaceKind } from '../lib/places'
import { QUICK_STATIONS, searchStations } from '../lib/stations'
import { isSavedPlaceId, isStopId, SAVED_PLACES, savedPlaceAsPlace, useSavedPlaces } from '../store/places'
import { recentStops, useRecentStops } from '../store/recentStops'

const QUICK_COUNT = QUICK_STATIONS.length

const isDefault = (p: Place) => QUICK_STATIONS.some((d) => d.id === p.id)
const shortName = (p: Place) => (p.disassembledName ?? p.name.split(',')[0]).replace(/ Station$/, '')

interface Props {
  label: string
  value?: Place
  onChange: (p: Place | undefined) => void
  /** Only stations and stops, e.g. for a departure board: no addresses, places, Home, Work or current location. */
  stopsOnly?: boolean
  /** Leave out Home and Work, e.g. while setting one of them. */
  hideSaved?: boolean
}

/** Matches answered on the device before the stop finder replies. */
const LOCAL_COUNT = 3
/** Rows per group, so stops don't push addresses out of view or the other way round. */
const GROUP_MAX = 5

const baseName = (p: Place) => shortName(p).split(',')[0].toLowerCase()
const sameName = (a: Place, b: Place) => baseName(a) === baseName(b)

const modeLabels = (modes?: number[]) =>
  MODES.filter((m) => m.classes.some((c) => modes?.includes(c)))
    .map((m) => m.label)
    .join(' · ')

const KIND_ICON: Record<PlaceKind, IconType> = { station: LuTrainFront, stop: LuBus, address: LuMapPin, place: LuLandmark }
const SAVED_ICON = { home: LuHouse, work: LuBriefcase }

/** The icon for any place, Home and Work included. */
export function placeIcon(p: Pick<Place, 'id' | 'type' | 'modes'>): IconType {
  return isSavedPlaceId(p.id) ? SAVED_ICON[p.id] : KIND_ICON[placeKind(p)]
}

/** A place's icon as an element, so render code never holds a component it picked on the fly. */
export const PlaceIcon = ({ place }: { place: Pick<Place, 'id' | 'type' | 'modes'> }) => createElement(placeIcon(place))

/** What a result row says under its name. */
function detail(p: Place): string {
  const kind = placeKind(p)
  if (kind === 'station' || kind === 'stop') return modeLabels(p.modes) || 'Stop'
  if (p.type === 'street') return 'Street'
  return kind === 'address' ? 'Address' : 'Place'
}

const GROUPS: { key: string; label: string; kinds: PlaceKind[] }[] = [
  { key: 'stations', label: 'Stations', kinds: ['station'] },
  { key: 'stops', label: 'Stops', kinds: ['stop'] },
  { key: 'places', label: 'Addresses and places', kinds: ['address', 'place'] },
]

export function StopSearch({ label, value, onChange, stopsOnly = false, hideSaved = stopsOnly }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string>()
  const { data, isFetching, fetchStatus } = useStopSearch(text)
  const recents = useRecentStops()
  const saved = useSavedPlaces()
  // Stations come from the bundled list instantly; everything else (bus stops, addresses, places) follows from the network.
  const local = searchStations(text, LOCAL_COUNT)
  const remote = (data ?? []).filter(
    (p) =>
      !local.some((l) => l.id === p.id || (p.type === 'stop' && sameName(l, p))) &&
      (!stopsOnly || ['station', 'stop'].includes(placeKind(p))),
  )
  const q = text.trim().toLowerCase()
  // Typing "home" or "work" finds the saved place.
  const savedMatches = hideSaved ? [] : SAVED_PLACES.filter((s) => saved[s.key] && q.length >= 2 && s.label.toLowerCase().startsWith(q))
  const groups = GROUPS.filter((g) => !stopsOnly || g.key !== 'places')
    .map((g) => ({ ...g, items: [...local, ...remote].filter((p) => g.kinds.includes(placeKind(p))).slice(0, GROUP_MAX) }))
    .filter((g) => g.items.length > 0)
  const count = savedMatches.length + groups.reduce((n, g) => n + g.items.length, 0)
  // The finder needs two letters and waits for typing to pause, so show the loader from the first keystroke it will answer.
  const debounced = useDebounced(text.trim())
  const searching = text.trim().length >= 2 && (isFetching || text.trim() !== debounced)
  const offline = !data && fetchStatus === 'paused'

  const select = (p: Place) => {
    if (!isSavedPlaceId(p.id)) recentStops.add(p)
    onChange(p)
    setOpen(false)
    setText('')
    setLocationError(undefined)
  }

  const useLocation = async () => {
    setLocating(true)
    setLocationError(undefined)
    try {
      select(await currentPlace())
    } catch (e) {
      setLocationError(LOCATION_ERRORS[(typeof e === 'string' ? e : 'unavailable') as LocationError])
    } finally {
      setLocating(false)
    }
  }

  // Newly used non-default stations push the last defaults off; the list stays at QUICK_COUNT.
  const quick = [...recents.filter((p) => !isDefault(p) && (!stopsOnly || isStopId(p.id))), ...QUICK_STATIONS].slice(0, QUICK_COUNT)
  const savedChips = hideSaved ? [] : SAVED_PLACES.filter((s) => saved[s.key])

  if (value && !open) {
    return (
      <Flex
        as="button"
        w="full"
        textAlign="start"
        align="center"
        gap={3}
        bg="bg.panel"
        color="fg"
        borderRadius="xl"
        px={4}
        py={3}
        onClick={() => {
          setText(isSavedPlaceId(value.id) ? '' : (value.disassembledName ?? value.name))
          setOpen(true)
          onChange(undefined)
        }}
      >
        <Box color="brand.fg">
          <PlaceIcon place={value} />
        </Box>
        <Box minW={0}>
          <Text fontSize="xs" color="fg.muted">
            {label}
          </Text>
          <Text fontWeight="semibold" truncate>
            {isSavedPlaceId(value.id) && saved[value.id] ? `${value.name} · ${saved[value.id]!.name.split(',')[0]}` : value.name}
          </Text>
        </Box>
      </Flex>
    )
  }

  const row = (p: Place, sub: string) => {
    return (
      <Flex
        as="button"
        key={p.id}
        w="full"
        textAlign="start"
        align="center"
        gap={3}
        px={4}
        py={2.5}
        borderBottomWidth="1px"
        onClick={() => select(p)}
      >
        <Box color="fg.muted" flexShrink={0}>
          <PlaceIcon place={p} />
        </Box>
        <Box minW={0}>
          <Text fontWeight="medium" truncate>
            {p.name}
          </Text>
          <Text fontSize="xs" color="fg.muted" truncate>
            {sub}
          </Text>
        </Box>
      </Flex>
    )
  }

  return (
    <Box position="relative">
      <Input
        autoFocus={open}
        value={text}
        placeholder={stopsOnly ? label : `${label}: station, stop or address`}
        aria-label={label}
        bg="bg.panel"
        color="fg"
        borderRadius="xl"
        size="lg"
        autoComplete="off"
        enterKeyHint="search"
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => !locating && setOpen(false)}
      />
      {open && !text.trim() && (
        <Box
          position="absolute"
          zIndex="dropdown"
          mt={1}
          w="full"
          bg="bg.panel"
          color="fg"
          borderRadius="xl"
          shadow="lg"
          p={3}
          onMouseDown={(e) => e.preventDefault()}
        >
          <Flex gap={2} wrap="wrap" role="group" aria-label="Quick picks">
            {!stopsOnly && (
              <Button size="sm" variant="outline" colorPalette="brand" borderRadius="full" disabled={locating} onClick={useLocation}>
                {locating ? <Spinner size="xs" /> : <LuLocateFixed />} {locating ? 'Finding you…' : 'Current location'}
              </Button>
            )}
            {savedChips.map((s) => (
              <Button key={s.key} size="sm" variant="outline" borderRadius="full" onClick={() => select(savedPlaceAsPlace(s.key))}>
                <PlaceIcon place={{ id: s.key }} /> {s.label}
              </Button>
            ))}
            {quick.map((p) => (
              <Button key={p.id} size="sm" variant="outline" borderRadius="full" onClick={() => select(p)}>
                {shortName(p)}
              </Button>
            ))}
          </Flex>
          {locationError && (
            <Text fontSize="xs" color="red.500" mt={2} role="alert">
              {locationError}
            </Text>
          )}
          {!hideSaved && savedChips.length === 0 && (
            <Text fontSize="xs" color="fg.muted" mt={2}>
              Add Home and Work in Settings to plan from them in one tap.
            </Text>
          )}
        </Box>
      )}
      {open && text.trim() && (count > 0 || searching || offline) && (
        <Box
          position="absolute"
          zIndex="dropdown"
          mt={1}
          w="full"
          bg="bg.panel"
          color="fg"
          borderRadius="xl"
          shadow="lg"
          maxH="55vh"
          overflowY="auto"
          onMouseDown={(e) => e.preventDefault()}
        >
          {savedMatches.map((s) => row(savedPlaceAsPlace(s.key), saved[s.key]!.name))}
          {groups.map((g) => (
            <Fragment key={g.key}>
              {/* Group labels only help once there is more than one kind on show. */}
              {groups.length > 1 && (
                <Text
                  px={4}
                  pt={2.5}
                  pb={1}
                  fontSize="2xs"
                  fontWeight="semibold"
                  color="fg.muted"
                  textTransform="uppercase"
                  letterSpacing="wide"
                >
                  {g.label}
                </Text>
              )}
              {g.items.map((p) => row(p, detail(p)))}
            </Fragment>
          ))}
          {searching && (
            <Flex align="center" gap={2} px={4} py={3} color="fg.muted" fontSize="sm" role="status">
              <Spinner size="xs" />
              <Text>{stopsOnly ? 'Searching all stops…' : 'Searching stops, addresses and places…'}</Text>
            </Flex>
          )}
          {offline && (
            <Text px={4} py={3} color="fg.muted" fontSize="sm">
              Offline. Stations still match, but other stops{stopsOnly ? '' : ' and addresses'} need a connection.
            </Text>
          )}
          {!searching && !offline && count === 0 && (
            <Text px={4} py={3} color="fg.muted" fontSize="sm">
              {stopsOnly ? 'No stops match.' : 'No stops, addresses or places match.'}
            </Text>
          )}
        </Box>
      )}
    </Box>
  )
}
