import { Box, Button, Flex, Input, Spinner, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuMapPin } from 'react-icons/lu'
import { useDebounced, useStopSearch } from '../api/hooks'
import type { Place } from '../api/types'
import { MODES } from '../lib/lines'
import { QUICK_STATIONS, searchStations } from '../lib/stations'
import { recentStops, useRecentStops } from '../store/recentStops'

const QUICK_COUNT = QUICK_STATIONS.length

const isDefault = (p: Place) => QUICK_STATIONS.some((d) => d.id === p.id)
const shortName = (p: Place) => (p.disassembledName ?? p.name.split(',')[0]).replace(/ Station$/, '')

interface QuickPick {
  key: string
  label: string
  place: Place
}

interface Props {
  label: string
  value?: Place
  onChange: (p: Place | undefined) => void
}

/** Matches answered on the device before the stop finder replies. */
const LOCAL_COUNT = 3
const MAX_RESULTS = 8

const baseName = (p: Place) => shortName(p).split(',')[0].toLowerCase()
const sameName = (a: Place, b: Place) => baseName(a) === baseName(b)

const modeLabels = (modes?: number[]) =>
  MODES.filter((m) => m.classes.some((c) => modes?.includes(c)))
    .map((m) => m.label)
    .join(' · ')

export function StopSearch({ label, value, onChange }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const { data, isFetching, fetchStatus } = useStopSearch(text)
  const recents = useRecentStops()
  // Stations come from the bundled list instantly; everything else (bus stops, places) follows from the network.
  const local = searchStations(text, LOCAL_COUNT)
  const remote = (data ?? []).filter((p) => !local.some((l) => l.id === p.id || (p.type === 'stop' && sameName(l, p))))
  const results = [...local, ...remote].slice(0, MAX_RESULTS)
  // The finder needs two letters and waits for typing to pause, so show the loader from the first keystroke it will answer.
  const debounced = useDebounced(text.trim())
  const searching = text.trim().length >= 2 && (isFetching || text.trim() !== debounced)
  const offline = !data && fetchStatus === 'paused'

  const select = (p: Place) => {
    recentStops.add(p)
    onChange(p)
    setOpen(false)
    setText('')
  }

  // Newly used non-default stations push the last defaults off; the list stays at QUICK_COUNT.
  const quick: QuickPick[] = [...recents.filter((p) => !isDefault(p)), ...QUICK_STATIONS]
    .slice(0, QUICK_COUNT)
    .map((p) => ({ key: p.id, label: shortName(p), place: p }))

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
          setText(value.disassembledName ?? value.name)
          setOpen(true)
          onChange(undefined)
        }}
      >
        <Box color="teal.500">
          <LuMapPin />
        </Box>
        <Box minW={0}>
          <Text fontSize="xs" color="fg.muted">
            {label}
          </Text>
          <Text fontWeight="semibold" truncate>
            {value.disassembledName ?? value.name}
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
        placeholder={label}
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
        onBlur={() => setOpen(false)}
      />
      {open && !text.trim() && (
        <Flex
          position="absolute"
          zIndex="dropdown"
          mt={1}
          w="full"
          bg="bg.panel"
          color="fg"
          borderRadius="xl"
          shadow="lg"
          p={3}
          gap={2}
          wrap="wrap"
          role="group"
          aria-label="Quick picks"
          onMouseDown={(e) => e.preventDefault()}
        >
          {quick.map((q) => (
            <Button key={q.key} size="sm" variant="outline" borderRadius="full" onClick={() => select(q.place)}>
              {q.label}
            </Button>
          ))}
        </Flex>
      )}
      {open && text.trim() && (results.length > 0 || searching || offline) && (
        <Box
          position="absolute"
          zIndex="dropdown"
          mt={1}
          w="full"
          bg="bg.panel"
          color="fg"
          borderRadius="xl"
          shadow="lg"
          maxH="50vh"
          overflowY="auto"
          onMouseDown={(e) => e.preventDefault()}
        >
          {results.map((p) => (
            <Box
              as="button"
              key={p.id}
              display="block"
              w="full"
              textAlign="start"
              px={4}
              py={3}
              borderBottomWidth="1px"
              onClick={() => select(p)}
            >
              <Text fontWeight="medium" truncate>
                {p.name}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {modeLabels(p.modes) || p.type}
              </Text>
            </Box>
          ))}
          {searching && (
            <Flex align="center" gap={2} px={4} py={3} color="fg.muted" fontSize="sm" role="status">
              <Spinner size="xs" />
              <Text>Searching all stops and places…</Text>
            </Flex>
          )}
          {offline && (
            <Text px={4} py={3} color="fg.muted" fontSize="sm">
              Offline. Stations still match, but other stops and places need a connection.
            </Text>
          )}
          {!searching && !offline && results.length === 0 && (
            <Text px={4} py={3} color="fg.muted" fontSize="sm">
              No stops or places match.
            </Text>
          )}
        </Box>
      )}
    </Box>
  )
}
