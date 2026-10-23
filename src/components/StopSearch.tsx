import { Box, Button, Flex, Input, Spinner, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuMapPin } from 'react-icons/lu'
import { searchStops } from '../api/client'
import { useStopSearch } from '../api/hooks'
import type { Place } from '../api/types'
import { MODES } from '../lib/lines'
import { recentStops, useRecentStops } from '../store/recentStops'

// Fixed display order. `query` is what the stop finder resolves to a station.
const DEFAULT_PICKS = [
  { label: 'Lidcombe', query: 'Lidcombe Station' },
  { label: 'Wynyard', query: 'Wynyard Station' },
  { label: 'Strathfield', query: 'Strathfield Station' },
  { label: 'Campsie', query: 'Campsie Station' },
  { label: 'Burwood', query: 'Burwood Station' },
  { label: 'Central', query: 'Central Station' },
  { label: 'Town Hall', query: 'Town Hall Station' },
  { label: 'Redfern', query: 'Redfern Station' },
  { label: 'Parramatta', query: 'Parramatta Station' },
]

const QUICK_COUNT = DEFAULT_PICKS.length

const isRail = (p: Place) => !!p.modes?.some((m) => m === 1 || m === 2)
const isDefault = (p: Place) => DEFAULT_PICKS.some((d) => p.name.toLowerCase().startsWith(d.query.toLowerCase()))
const shortName = (p: Place) => p.disassembledName ?? p.name.split(',')[0]

interface QuickPick {
  key: string
  label: string
  place?: Place
  query?: string
}

interface Props {
  label: string
  value?: Place
  onChange: (p: Place | undefined) => void
}

const modeLabels = (modes?: number[]) =>
  MODES.filter((m) => m.classes.some((c) => modes?.includes(c)))
    .map((m) => m.label)
    .join(' · ')

export function StopSearch({ label, value, onChange }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const { data, isFetching } = useStopSearch(text)
  const recents = useRecentStops()
  const [resolving, setResolving] = useState<string>()

  const select = (p: Place) => {
    recentStops.add(p)
    onChange(p)
    setOpen(false)
    setText('')
  }

  const pickDefault = async (query: string) => {
    setResolving(query)
    try {
      const results = await searchStops(query)
      const best = results.find(isRail) ?? results[0]
      if (best) select(best)
    } finally {
      setResolving(undefined)
    }
  }

  // Newly used non-default stations push the last defaults off; the list stays at QUICK_COUNT.
  const quick: QuickPick[] = [
    ...recents.filter((p) => !isDefault(p)).map((p) => ({ key: p.id, label: shortName(p), place: p })),
    ...DEFAULT_PICKS.map((d) => ({ key: d.query, label: d.label, query: d.query })),
  ].slice(0, QUICK_COUNT)

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
      {isFetching && <Spinner size="sm" position="absolute" right={4} top={4} color="fg.muted" />}
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
            <Button
              key={q.key}
              size="sm"
              variant="outline"
              borderRadius="full"
              loading={!!q.query && resolving === q.query}
              disabled={!!resolving}
              onClick={() => (q.place ? select(q.place) : pickDefault(q.query!))}
            >
              {q.label}
            </Button>
          ))}
        </Flex>
      )}
      {open && text.trim() && data && data.length > 0 && (
        <Box
          position="absolute"
          zIndex="dropdown"
          mt={1}
          w="full"
          bg="bg.panel"
          color="fg"
          borderRadius="xl"
          shadow="lg"
          maxH="50dvh"
          overflowY="auto"
          onMouseDown={(e) => e.preventDefault()}
        >
          {data.slice(0, 8).map((p) => (
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
        </Box>
      )}
    </Box>
  )
}
