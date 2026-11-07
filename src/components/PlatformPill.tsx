import { Box } from '@chakra-ui/react'
import type { StopPoint, Transportation } from '../api/types'
import { lineColor } from '../lib/lines'
import { PLATFORM_KINDS, platformInfo, type PlatformInfo } from '../lib/platforms'

interface Props {
  info?: PlatformInfo
  /** Shown muted when the planner has no platform yet, e.g. "Platform TBC". */
  fallback?: string
  /** Just the number or letter, for tight spots such as filter chips. */
  compact?: boolean
  /** The ride leaving from here: the pill then takes its line badge's colour. */
  transportation?: Transportation
}

/**
 * Where to stand: "Platform 3", "Stand A2". With the ride known, the pill is the colour of its line badge (T8 green,
 * Metro teal, ...) so the two match; otherwise the colour of the kind of stop (train, metro, bus, ...). Both are
 * darkened where needed so the white text stays readable.
 */
export function PlatformPill({ info, fallback, compact, transportation }: Props) {
  if (!info) {
    return fallback ? (
      <Box as="span" fontSize="xs" fontWeight="semibold" color="fg.muted" whiteSpace="nowrap">
        {fallback}
      </Box>
    ) : null
  }
  const { label } = PLATFORM_KINDS[info.kind]
  const text = compact ? info.label : info.kind === 'replacement' ? `${info.long} · replacement bus` : info.long
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      px={1.5}
      h="20px"
      borderRadius="md"
      fontSize="xs"
      fontWeight="bold"
      whiteSpace="nowrap"
      flexShrink={0}
      color="white"
      style={{
        background: transportation
          ? lineColor(transportation.number ?? transportation.disassembledName, transportation.product?.class)
          : PLATFORM_KINDS[info.kind].color,
      }}
      title={info.detail ? `${info.long}, ${info.detail}` : `${info.long} (${label.toLowerCase()})`}
    >
      {text}
    </Box>
  )
}

/** The pill for where a ride leaves from or arrives at. */
export function StopPlatform({
  point,
  transportation,
  fallback,
}: {
  point?: StopPoint
  transportation?: Transportation
  fallback?: string
}) {
  return <PlatformPill info={platformInfo(point, transportation)} fallback={fallback} transportation={transportation} />
}
