import { Badge } from '@chakra-ui/react'
import { delayMinutes } from '../lib/time'

interface Props {
  planned?: string
  estimated?: string
  realtime?: boolean
  cancelled?: boolean
}

export function DelayBadge({ planned, estimated, realtime, cancelled }: Props) {
  if (cancelled)
    return (
      <Badge colorPalette="red" variant="solid">
        Cancelled
      </Badge>
    )
  const d = delayMinutes(planned, estimated)
  if (d === undefined) return realtime ? null : <Badge variant="subtle">Scheduled</Badge>
  if (d >= 1) return <Badge colorPalette="red">{d} min late</Badge>
  if (d <= -1) return <Badge colorPalette="blue">{-d} min early</Badge>
  return <Badge colorPalette="green">On time</Badge>
}
