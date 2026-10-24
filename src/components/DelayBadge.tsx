import { Badge } from '@chakra-ui/react'
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
