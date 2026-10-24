import { Button, HStack } from '@chakra-ui/react'
import { MODES } from '../lib/lines'
import { EndWalkSetting } from './EndWalkSetting'

interface Props {
  value: string[]
  onChange: (modes: string[]) => void
  size?: 'xs' | 'sm'
  /** Hide the walking-at-the-end shortcut where it already has its own section. */
  hideWalk?: boolean
  /** Makes the walking shortcut edit a saved trip's own end walk. */
  endWalk?: { value: number; onChange: (n: number) => void }
}

/** Toggle chips for transport modes. An empty value means every mode, and shows every chip selected. */
export function ModePicker({ value, onChange, size = 'sm', hideWalk, endWalk }: Props) {
  const all = MODES.map((m) => m.key as string)
  const shown = value.length ? value : all
  const toggle = (key: string) => {
    const next = shown.includes(key) ? shown.filter((x) => x !== key) : [...shown, key]
    // At least one mode stays on, and selecting everything is stored as "no filter".
    if (!next.length) return
    onChange(next.length === all.length ? [] : next)
  }
  return (
    <HStack wrap="wrap" gap={2}>
      {MODES.map((m) => {
        const on = shown.includes(m.key)
        return (
          <Button
            key={m.key}
            size={size}
            borderRadius="full"
            variant={on ? 'solid' : 'outline'}
            colorPalette="teal"
            aria-pressed={on}
            onClick={() => toggle(m.key)}
          >
            {m.label}
          </Button>
        )
      })}
      {!hideWalk && <EndWalkSetting endWalk={endWalk} />}
    </HStack>
  )
}
