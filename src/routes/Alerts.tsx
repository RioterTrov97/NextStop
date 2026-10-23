import { Button, HStack, Skeleton, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { useAlerts } from '../api/hooks'
import type { Alert } from '../api/types'
import { AlertCard } from '../components/AlertCard'
import { PageHeader } from '../components/PageHeader'
import { useSavedTrips } from '../store/savedTrips'

const RANK: Record<string, number> = { veryHigh: 0, high: 1, normal: 2, low: 3, veryLow: 4 }

export default function Alerts() {
  const { data, isLoading, error } = useAlerts()
  const trips = useSavedTrips()
  const [all, setAll] = useState(false)

  const stations = trips.flatMap((t) => [t.fromName, t.toName]).map((n) => n.split(',')[0].toLowerCase())
  const relevant = (a: Alert) => (a.affected?.stops ?? []).some((s) => stations.some((n) => s.name?.toLowerCase().includes(n)))

  const list = [...(data ?? [])]
    .filter((a) => all || !trips.length || relevant(a))
    .sort((a, b) => (RANK[a.priority ?? 'normal'] ?? 2) - (RANK[b.priority ?? 'normal'] ?? 2))
    .slice(0, 60)

  return (
    <>
      <PageHeader title="Alerts" subtitle="Disruptions and notices" />
      <Stack gap={3} p={4}>
        {trips.length > 0 && (
          <HStack gap={2}>
            <Button size="sm" borderRadius="full" colorPalette="teal" variant={!all ? 'solid' : 'outline'} onClick={() => setAll(false)}>
              My trips
            </Button>
            <Button size="sm" borderRadius="full" colorPalette="teal" variant={all ? 'solid' : 'outline'} onClick={() => setAll(true)}>
              Everything
            </Button>
          </HStack>
        )}
        {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} h="64px" borderRadius="lg" />)}
        {error && !data && <Text color="red.500">{(error as Error).message}</Text>}
        {data && list.length === 0 && (
          <Text color="fg.muted" textAlign="center" py={8}>
            No alerts affecting your trips right now.
          </Text>
        )}
        {list.map((a) => (
          <AlertCard key={a.id} title={a.subtitle} html={a.content} priority={a.priority} url={a.url} urlText={a.urlText} />
        ))}
      </Stack>
    </>
  )
}
