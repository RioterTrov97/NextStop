import { Box, Button, Flex, HStack, IconButton, Input, Stack, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { LuArrowUpDown } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import type { Place } from '../api/types'
import { PageHeader } from '../components/PageHeader'
import { ModePicker } from '../components/ModePicker'
import { tripPath } from '../lib/paths'
import { StopSearch } from '../components/StopSearch'

type When = 'now' | 'dep' | 'arr'

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

// Module-level so the form survives switching tabs, which unmounts this page.
let draft: { modes: string[]; when: When; at: string } = {
  modes: [],
  when: 'now',
  at: toLocalInput(new Date()),
}

export default function Plan() {
  const navigate = useNavigate()
  const [from, setFrom] = useState<Place>()
  const [to, setTo] = useState<Place>()
  const [modes, setModes] = useState<string[]>(draft.modes)
  const [when, setWhen] = useState<When>(draft.when)
  const [at, setAt] = useState(draft.at)

  useEffect(() => {
    draft = { modes, when, at }
  }, [modes, when, at])

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  const go = () => {
    if (!from || !to) return
    const extra: Record<string, string> = {}
    if (when !== 'now') {
      extra.m = when
      extra.w = new Date(at).toISOString()
    }
    navigate(tripPath({ fromId: from.id, toId: to.id, fromName: from.name, toName: to.name, modes }, extra))
  }

  return (
    <>
      <PageHeader title="Plan a trip" back />
      <Stack gap={4} p={4}>
        <Flex gap={2} align="center">
          <Stack flex={1} gap={2}>
            <StopSearch label="From" value={from} onChange={setFrom} />
            <StopSearch label="To" value={to} onChange={setTo} />
          </Stack>
          <IconButton aria-label="Swap origin and destination" variant="subtle" onClick={swap}>
            <LuArrowUpDown />
          </IconButton>
        </Flex>

        <Box>
          <Text fontSize="sm" fontWeight="semibold" mb={2}>
            Transport
          </Text>
          <ModePicker value={modes} onChange={setModes} />
          <Text fontSize="xs" color="fg.muted" mt={1}>
            {modes.length ? 'Only the selected modes.' : 'All modes.'}
          </Text>
        </Box>

        <Box>
          <Text fontSize="sm" fontWeight="semibold" mb={2}>
            When
          </Text>
          <HStack gap={2}>
            {(
              [
                ['now', 'Leave now'],
                ['dep', 'Depart at'],
                ['arr', 'Arrive by'],
              ] as const
            ).map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                borderRadius="full"
                variant={when === k ? 'solid' : 'outline'}
                colorPalette="teal"
                onClick={() => setWhen(k)}
              >
                {label}
              </Button>
            ))}
          </HStack>
          {when !== 'now' && <Input mt={2} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />}
        </Box>

        <Button mt="2" size="lg" colorPalette="teal" borderRadius="xl" disabled={!from || !to} onClick={go}>
          Show trips
        </Button>
      </Stack>
    </>
  )
}
