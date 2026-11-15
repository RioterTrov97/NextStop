import { Box, Flex, Text } from '@chakra-ui/react'
import { memo, useEffect, useState } from 'react'
import { LuTicket } from 'react-icons/lu'
import type { Journey } from '../api/types'
import { estimateFare, FARE_TYPES, formatFare, loadFares, type FareData } from '../lib/fares'
import { isTransit } from '../lib/journey'
import { useSettings } from '../store/settings'

/** The estimated Opal fare at the foot of trip details. */
export const FareRow = memo(function FareRow({ journey }: { journey: Journey }) {
  const { fareType } = useSettings()
  const [data, setData] = useState<FareData>()
  useEffect(() => {
    let live = true
    loadFares()
      .then((d) => live && setData(d))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  // Walking only: there is nothing to pay.
  if (!data || !journey.legs.some(isTransit)) return null
  const fare = estimateFare(data, journey, fareType)
  const label = FARE_TYPES.find((f) => f.key === fareType)!.label
  const details = fare
    ? [
        label,
        fare.peak ? 'peak' : 'off-peak',
        fare.discount > 0 && `${formatFare(fare.discount)} transfer discount`,
        fare.airportFee > 0 && `includes ${formatFare(fare.airportFee)} airport station fee`,
        fare.capped && 'daily cap reached',
      ].filter(Boolean)
    : []

  return (
    <Flex gap={3} align="flex-start" p={3} borderWidth="1px" borderRadius="xl" aria-label="Opal fare estimate">
      <Box color="fg.muted" mt="2px">
        <LuTicket />
      </Box>
      <Box flex={1} minW={0}>
        <Text fontWeight="medium">Opal fare</Text>
        <Text fontSize="xs" color="fg.muted">
          {fare ? `Estimate · ${details.join(' · ')}` : 'Not known: part of this trip has its own fares, or isn’t on Opal.'}
        </Text>
      </Box>
      {fare && (
        <Text fontWeight="semibold" fontSize="lg" fontVariantNumeric="tabular-nums">
          {formatFare(fare.cents)}
        </Text>
      )}
    </Flex>
  )
})
