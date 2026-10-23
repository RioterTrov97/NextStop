import { Button, HStack } from '@chakra-ui/react'
import { MODES } from '../lib/lines'

interface Props {
  value: string[]
  onChange: (modes: string[]) => void
  size?: 'xs' | 'sm'
}

/** Toggle chips for transport modes; an empty selection means every mode. */
export function ModePicker({ value, onChange, size = 'sm' }: Props) {
  return (
    <HStack wrap="wrap" gap={2}>
      {MODES.map((m) => {
        const on = value.includes(m.key)
        return (
          <Button
            key={m.key}
            size={size}
            borderRadius="full"
            variant={on ? 'solid' : 'outline'}
            colorPalette="teal"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== m.key) : [...value, m.key])}
          >
            {m.label}
          </Button>
        )
      })}
    </HStack>
  )
}
