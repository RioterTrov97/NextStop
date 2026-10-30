import { Box } from '@chakra-ui/react'
import type { StopPoint, Transportation } from '../api/types'
import { PLATFORM_KINDS, platformInfo, type PlatformInfo } from '../lib/platforms'

interface Props {
  info?: PlatformInfo
  /** Shown muted when the planner has no platform yet, e.g. "Platform TBC". */
  fallback?: string
  /** Just the number or letter, for tight spots such as filter chips. */
  compact?: boolean
}

/**
 * Where to stand, coloured by what leaves from there: train orange, metro teal, light rail red, bus blue, and a
 * darker blue for the temporary buses that replace trains.
 */
export function PlatformPill({ info, fallback, compact }: Props) {
  if (!info) {
    return fallback ? (
      <Box as="span" fontSize="xs" fontWeight="semibold" color="fg.muted" whiteSpace="nowrap">
        {fallback}
      </Box>
    ) : null
  }
  const { color, label } = PLATFORM_KINDS[info.kind]
  const text = compact ? info.label : info.kind === 'replacement' ? `${info.long} · replacement bus` : info.long
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      px={1.5}
      h="20px"
      borderRadius="md"
      color="white"
      fontSize="xs"
      fontWeight="bold"
      whiteSpace="nowrap"
      flexShrink={0}
      style={{ background: color }}
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
  return <PlatformPill info={platformInfo(point, transportation)} fallback={fallback} />
}
