import { Box, Button, Flex, HStack, Skeleton, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useDepartures } from '../api/hooks'
import { DelayBadge } from '../components/DelayBadge'
import { LineBadge } from '../components/LineBadge'
import { PageHeader } from '../components/PageHeader'
import { RefreshButton } from '../components/RefreshButton'
import { useNow } from '../lib/hooks'
import { countdown, formatTime } from '../lib/time'

const platformOf = (p?: string) => (p ? p.replace(/^[A-Za-z]+(?=\d)/, '') : undefined)

export default function StationBoard() {
  const { id = '' } = useParams()
  const [sp] = useSearchParams()
  const now = useNow(1000)
  const { data, isLoading, error } = useDepartures(id)
  const [platform, setPlatform] = useState<string>()

  const events = data ?? []
  const platforms = [...new Set(events.map((e) => platformOf(e.location?.properties?.platform)).filter(Boolean))] as string[]
  const shown = events.filter((e) => !platform || platformOf(e.location?.properties?.platform) === platform)

  return (
    <>
      <PageHeader title={sp.get('n')?.split(',')[0] ?? 'Station'} subtitle="Next departures" back action={<RefreshButton />} />
      <Stack gap={3} p={4}>
        {platforms.length > 1 && (
          <HStack wrap="wrap" gap={2}>
            <Button
              size="xs"
              borderRadius="full"
              variant={!platform ? 'solid' : 'outline'}
              colorPalette="teal"
              onClick={() => setPlatform(undefined)}
            >
              All platforms
            </Button>
            {platforms.map((p) => (
              <Button
                key={p}
                size="xs"
                borderRadius="full"
                variant={platform === p ? 'solid' : 'outline'}
                colorPalette="teal"
                onClick={() => setPlatform(p)}
              >
                Platform {p}
              </Button>
            ))}
          </HStack>
        )}
        {isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} h="68px" borderRadius="xl" />)}
        {error && !data && <Text color="red.500">{(error as Error).message}</Text>}
        {data && shown.length === 0 && (
          <Text color="fg.muted" textAlign="center" py={8}>
            No departures found.
          </Text>
        )}
        {shown.map((e, i) => {
          const t = e.transportation
          const dep = e.departureTimeEstimated ?? e.departureTimePlanned
          const p = platformOf(e.location?.properties?.platform)
          return (
            <Flex key={i} bg="bg.panel" borderWidth="1px" borderRadius="xl" p={3} align="center" gap={3}>
              <LineBadge number={t?.number ?? t?.disassembledName} cls={t?.product?.class} />
              <Box flex={1} minW={0}>
                <Text fontWeight="semibold" truncate>
                  {t?.destination?.name ?? t?.description}
                </Text>
                <HStack gap={2} fontSize="sm" color="fg.muted">
                  <span>{formatTime(dep)}</span>
                  {p && <span>Platform {p}</span>}
                  <DelayBadge planned={e.departureTimePlanned} estimated={e.departureTimeEstimated} realtime={e.isRealtimeControlled} />
                </HStack>
              </Box>
              <Text fontWeight="bold" color="teal.500" fontVariantNumeric="tabular-nums">
                {countdown(dep, now)}
              </Text>
            </Flex>
          )
        })}
      </Stack>
    </>
  )
}
