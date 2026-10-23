import { Box, Flex, HStack, Text } from '@chakra-ui/react'
import { LuTriangleAlert } from 'react-icons/lu'
import type { Journey } from '../api/types'
import { journeyAlerts, summarize } from '../lib/journey'
import { countdown, formatDuration, formatTime } from '../lib/time'
import { DelayBadge } from './DelayBadge'
import { LineBadge } from './LineBadge'

interface Props {
  journey: Journey
  now: number
  onClick?: () => void
}

export function JourneyRow({ journey, now, onClick }: Props) {
  const s = summarize(journey)
  const dep = s.depEstimated ?? s.depPlanned
  const arr = s.arrEstimated ?? s.arrPlanned
  const alerts = journeyAlerts(journey).filter((a) => a.priority === 'high' || a.priority === 'veryHigh')
  const transit = journey.legs.filter((l) => l.transportation?.product?.class !== undefined && l.transportation.product.class < 99)

  return (
    <Box
      as="button"
      w="full"
      textAlign="start"
      bg="bg.panel"
      borderRadius="2xl"
      borderWidth="1px"
      p={4}
      onClick={onClick}
      _active={{ transform: 'scale(0.99)' }}
    >
      <Flex justify="space-between" align="start">
        <Box>
          <Text fontSize="xl" fontWeight="bold">
            {formatTime(dep)} <Text as="span" color="fg.muted" fontWeight="normal">→</Text> {formatTime(arr)}
          </Text>
          <Text fontSize="sm" color="fg.muted">
            {formatDuration(s.durationSec)}
            {s.changes > 0 ? ` · ${s.changes} change${s.changes > 1 ? 's' : ''}` : ' · Direct'}
          </Text>
        </Box>
        <Text fontSize="lg" fontWeight="bold" color="teal.500" fontVariantNumeric="tabular-nums">
          {countdown(dep, now)}
        </Text>
      </Flex>
      <HStack mt={3} gap={2} wrap="wrap">
        {transit.map((l, i) => (
          <LineBadge key={i} number={l.transportation?.number ?? l.transportation?.disassembledName} cls={l.transportation?.product?.class} />
        ))}
        <DelayBadge
          planned={s.depPlanned}
          estimated={s.depEstimated}
          realtime={s.realtime}
          cancelled={s.firstTransit?.properties?.isCancelled === true}
        />
        {alerts.length > 0 && (
          <Box color="orange.500" aria-label="Service alert"><LuTriangleAlert /></Box>
        )}
      </HStack>
    </Box>
  )
}
