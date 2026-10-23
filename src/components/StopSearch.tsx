import { Box, Flex, Input, Spinner, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuMapPin } from 'react-icons/lu'
import { useStopSearch } from '../api/hooks'
import type { Place } from '../api/types'
import { MODES } from '../lib/lines'

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
        <Box color="teal.500"><LuMapPin /></Box>
        <Box minW={0}>
          <Text fontSize="xs" color="fg.muted">{label}</Text>
          <Text fontWeight="semibold" truncate>{value.disassembledName ?? value.name}</Text>
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
      />
      {isFetching && <Spinner size="sm" position="absolute" right={4} top={4} color="fg.muted" />}
      {open && data && data.length > 0 && (
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
              onClick={() => {
                onChange(p)
                setOpen(false)
                setText('')
              }}
            >
              <Text fontWeight="medium" truncate>{p.name}</Text>
              <Text fontSize="xs" color="fg.muted">{modeLabels(p.modes) || p.type}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
