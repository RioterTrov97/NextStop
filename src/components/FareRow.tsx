import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { memo, type ReactNode } from 'react'
import { LuTicket } from 'react-icons/lu'
import type { Journey } from '../api/types'
import { FARE_TYPES, formatFare, type FarePart } from '../lib/fares'
import { isTransit, stationName } from '../lib/journey'
import { useFare, useFareData } from '../lib/useFares'
import { useSettings } from '../store/settings'
import { LineBadge } from './LineBadge'

const MODE_LABEL = { bus: 'Bus', lightrail: 'Light rail', ferry: 'Ferry' } as const

/** "Train", "Metro" or "Train and metro" for rail (one fare covers both); the mode's name otherwise. */
function partLabel(p: FarePart): string {
  if (p.mode !== 'rail') return MODE_LABEL[p.mode]
  const metro = p.legs.map((l) => l.transportation?.product?.class === 2)
  return metro.every(Boolean) ? 'Metro' : metro.some(Boolean) ? 'Train and metro' : 'Train'
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

function Line({ label, sub, amount, strong }: { label: ReactNode; sub?: string; amount: string; strong?: boolean }) {
  return (
    <Flex gap={3} align="flex-start">
      <Box flex={1} minW={0}>
        <Box fontSize="sm" fontWeight={strong ? 'semibold' : 'normal'}>
          {label}
        </Box>
        {sub && (
          <Text fontSize="xs" color="fg.muted">
            {sub}
          </Text>
        )}
      </Box>
      <Text fontSize="sm" fontWeight={strong ? 'semibold' : 'normal'} fontVariantNumeric="tabular-nums" whiteSpace="nowrap">
        {amount}
      </Text>
    </Flex>
  )
}

/** The estimated Opal fare at the top of trip details, broken down by ride, discount and fee. */
export const FareRow = memo(function FareRow({ journey }: { journey: Journey }) {
  const { fareType } = useSettings()
  const data = useFareData()
  const fare = useFare(journey)
  // Walking only: there is nothing to pay.
  if (!data || !journey.legs.some(isTransit)) return null
  const label = FARE_TYPES.find((f) => f.key === fareType)!.label

  return (
    <Box p={3} borderWidth="1px" borderRadius="xl" aria-label="Opal fare estimate">
      <Flex gap={3} align="center">
        <Box color="fg.muted">
          <LuTicket />
        </Box>
        <Box flex={1} minW={0}>
          <Text fontWeight="medium">Opal fare</Text>
          <Text fontSize="xs" color="fg.muted">
            {fare ? `Estimate for ${label}` : 'Not known: part of this trip has its own fares, or isn’t on Opal.'}
          </Text>
        </Box>
        {fare && (
          <Text fontWeight="semibold" fontSize="lg" fontVariantNumeric="tabular-nums">
            {formatFare(fare.cents)}
          </Text>
        )}
      </Flex>
      {fare && (
        <Stack gap={2} mt={3} pt={3} borderTopWidth="1px">
          {fare.parts.map((p, i) => {
            const first = p.legs[0]
            const last = p.legs[p.legs.length - 1]
            const prev = fare.parts[i - 1]
            return (
              <Stack key={i} gap={2}>
                {p.discount > 0 && prev && (
                  <Line
                    label={`Transfer discount, ${lower(partLabel(prev))} to ${lower(partLabel(p))}`}
                    amount={`−${formatFare(p.discount)}`}
                  />
                )}
                <Line
                  label={
                    <HStack gap={1.5} wrap="wrap">
                      {p.legs.map((l, j) => (
                        <LineBadge
                          key={j}
                          number={l.transportation?.number ?? l.transportation?.disassembledName}
                          cls={l.transportation?.product?.class}
                          size="sm"
                        />
                      ))}
                      <Text as="span">
                        {partLabel(p)} · {stationName(first.origin)} to {stationName(last.destination)}
                      </Text>
                    </HStack>
                  }
                  sub={[
                    p.distance,
                    p.mode === 'ferry' ? 'same fare all day' : p.peak ? 'peak' : 'off-peak',
                    p.legs.length > 1 && 'charged as one trip',
                    p.newJourney && 'new journey: over an hour since the last ride',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  amount={formatFare(p.cents)}
                />
              </Stack>
            )
          })}
          {fare.airportFee > 0 && <Line label="Sydney Airport station access fee" amount={formatFare(fare.airportFee)} />}
          {fare.capOff > 0 && <Line label="Daily cap reached" amount={`−${formatFare(fare.capOff)}`} />}
          <Box borderTopWidth="1px" pt={2}>
            <Line label="Total" amount={formatFare(fare.cents)} strong />
          </Box>
        </Stack>
      )}
    </Box>
  )
})
