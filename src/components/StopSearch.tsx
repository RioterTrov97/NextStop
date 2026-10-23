import { Box, Button, Flex, Input, Spinner, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuMapPin } from 'react-icons/lu'
import { useStopSearch } from '../api/hooks'
import type { Place } from '../api/types'
import { MODES } from '../lib/lines'
import { QUICK_STATIONS } from '../lib/stations'
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

const modeLabels = (modes?: number[]) =>
  MODES.filter((m) => m.classes.some((c) => modes?.includes(c)))
    .map((m) => m.label)
    .join(' · ')

export function StopSearch({ label, value, onChange }: Props) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const { data, isFetching, fetchStatus } = useStopSearch(text)
  const recents = useRecentStops()

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
      {isFetching && <Spinner size="sm" position="absolute" right={4} top={4} color="fg.muted" />}
      {open && text.trim() && !data && fetchStatus === 'paused' && (
        <Text
          position="absolute"
          zIndex="dropdown"
          mt={1}
          w="full"
          bg="bg.panel"
          color="fg.muted"
          borderRadius="xl"
          shadow="lg"
          p={3}
          fontSize="sm"
        >
          Offline. Search needs a connection, but quick picks and recent stops still work.
        </Text>
      )}
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
          maxH="50vh"
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
