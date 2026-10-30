import { Badge, Text } from '@chakra-ui/react'
import { delayMinutes } from '../lib/time'

interface Props {
  planned?: string
  estimated?: string
  realtime?: boolean
  cancelled?: boolean
  size?: 'sm' | 'md'
}

export function DelayBadge({ planned, estimated, realtime, cancelled, size = 'md' }: Props) {
  if (cancelled)
    return (
      <Badge colorPalette="red" variant="solid" size={size}>
        Cancelled
      </Badge>
    )
  const d = delayMinutes(planned, estimated)
  if (d === undefined)
    return realtime ? null : (
      <Badge variant="subtle" size={size}>
        Scheduled
      </Badge>
    )
  if (d >= 1)
    return (
      <Badge colorPalette="red" size={size}>
        {d} min late
      </Badge>
    )
  if (d <= -1)
    return (
      <Badge colorPalette="blue" size={size}>
        {-d} min early
      </Badge>
    )
  return (
    <Badge colorPalette="green" size={size}>
      On time
    </Badge>
  )
}

/** The same status as small, thin coloured text with no background: "on time", "+4 min", "2 min early", "cancelled". */
export function DelayText({ planned, estimated, realtime, cancelled }: Omit<Props, 'size'>) {
  const d = delayMinutes(planned, estimated)
  const [text, color] = cancelled
    ? ['cancelled', 'red.fg']
    : d === undefined
      ? realtime
        ? [undefined, undefined]
        : ['scheduled', 'fg.muted']
      : d >= 1
        ? [`+${d} min`, 'red.fg']
        : d <= -1
          ? [`${-d} min early`, 'blue.fg']
          : ['on time', 'green.fg']
  if (!text) return null
  return (
    <Text
      as="span"
      fontSize="2xs"
      lineHeight="1.2"
      fontWeight="normal"
      color={color}
      whiteSpace="nowrap"
      title={d !== undefined && d >= 1 ? `${d} min late` : undefined}
    >
      {text}
    </Text>
  )
}
