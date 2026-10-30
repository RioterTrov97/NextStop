import { Box, Flex, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { PLATFORM_KINDS, type PlatformInfo, type PlatformKind } from '../lib/platforms'

/** All departures, all of one kind, or one platform of that kind. */
export type PlatformFilterValue = { kind: PlatformKind; key?: string } | undefined

const TAB_LABEL: Record<PlatformKind, string> = {
  train: 'Trains',
  metro: 'Metro',
  lightrail: 'Light rail',
  bus: 'Buses',
  replacement: 'Replacement buses',
  ferry: 'Ferries',
}

const PLATFORM_WORD: Record<PlatformKind, string> = {
  train: 'Platform',
  metro: 'Platform',
  lightrail: 'Stop',
  bus: 'Stand',
  replacement: 'Stand',
  ferry: 'Wharf',
}

// Horizontal rows scroll on narrow phones instead of wrapping into uneven lines.
const scrollRow = {
  overflowX: 'auto',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
} as const

function Tab({
  selected,
  color,
  onClick,
  children,
  label,
}: {
  selected: boolean
  color?: string
  onClick: () => void
  children: ReactNode
  label: string
}) {
  return (
    <Flex
      as="button"
      align="center"
      gap={2}
      h="34px"
      px={3.5}
      flexShrink={0}
      borderRadius="full"
      borderWidth="1px"
      fontSize="sm"
      fontWeight="semibold"
      whiteSpace="nowrap"
      transition="background-color 0.15s, color 0.15s, border-color 0.15s"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      bg={selected ? undefined : 'bg.panel'}
      color={selected ? 'white' : 'fg'}
      borderColor={selected ? 'transparent' : 'border'}
      style={selected ? { background: color ?? 'var(--chakra-colors-fg)', color: color ? 'white' : 'var(--chakra-colors-bg)' } : undefined}
    >
      {children}
    </Flex>
  )
}

interface Props {
  /** Platforms present on the board, grouped by kind in display order. */
  groups: [PlatformKind, PlatformInfo[]][]
  /** Departures per kind, shown on each tab. */
  counts: Partial<Record<PlatformKind, number>>
  total: number
  value: PlatformFilterValue
  onChange: (next: PlatformFilterValue) => void
}

/**
 * Station board filter: transport tabs (each with its colour and number of departures), then, for the chosen
 * transport, a row of evenly sized platform or stand chips.
 */
export function PlatformFilter({ groups, counts, total, value, onChange }: Props) {
  const active = groups.find(([kind]) => kind === value?.kind)
  const platforms = active?.[1] ?? []
  const kindColor = active ? PLATFORM_KINDS[active[0]].color : undefined

  return (
    <Box role="group" aria-label="Filter departures">
      <Flex gap={2} css={scrollRow} mx={-4} px={4} pb={0.5}>
        <Tab selected={!value} onClick={() => onChange(undefined)} label={`All departures, ${total}`}>
          All
          <Text as="span" fontWeight="normal" opacity={0.7}>
            {total}
          </Text>
        </Tab>
        {groups.map(([kind]) => {
          const selected = value?.kind === kind
          const { color } = PLATFORM_KINDS[kind]
          return (
            <Tab
              key={kind}
              selected={selected}
              color={color}
              onClick={() => onChange(selected ? undefined : { kind })}
              label={`${TAB_LABEL[kind]}, ${counts[kind] ?? 0} departures`}
            >
              <Box boxSize="8px" borderRadius="full" flexShrink={0} style={{ background: selected ? 'white' : color }} />
              {TAB_LABEL[kind]}
              <Text as="span" fontWeight="normal" opacity={0.7}>
                {counts[kind] ?? 0}
              </Text>
            </Tab>
          )
        })}
      </Flex>

      {active && platforms.length > 1 && (
        <Flex gap={1.5} align="center" css={scrollRow} mx={-4} px={4} mt={3}>
          <Text fontSize="xs" color="fg.muted" fontWeight="medium" flexShrink={0} me={1}>
            {PLATFORM_WORD[active[0]]}
          </Text>
          {[undefined, ...platforms].map((p) => {
            const selected = p ? value?.key === p.key : !value?.key
            return (
              <Box
                as="button"
                key={p?.key ?? 'all'}
                minW="36px"
                h="32px"
                px={2.5}
                flexShrink={0}
                borderRadius="full"
                fontSize="sm"
                fontWeight="semibold"
                fontVariantNumeric="tabular-nums"
                whiteSpace="nowrap"
                transition="background-color 0.15s, color 0.15s"
                bg={selected ? undefined : 'bg.muted'}
                color={selected ? 'white' : 'fg'}
                style={selected ? { background: kindColor } : undefined}
                aria-pressed={selected}
                title={p?.detail ? `${p.long}, ${p.detail}` : p?.long}
                onClick={() => onChange(p ? { kind: active[0], key: p.key } : { kind: active[0] })}
              >
                {p ? p.label : 'All'}
              </Box>
            )
          })}
        </Flex>
      )}
    </Box>
  )
}
