import { Skeleton, Stack, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useDepartureJourney, useDepartures, useJourneyVehicles } from '../api/hooks'
import type { Journey, StopEvent } from '../api/types'
import { JourneyRow } from '../components/JourneyRow'
import { JourneySheet } from '../components/JourneySheet'
import { NoConnection } from '../components/NoConnection'
import { PageHeader } from '../components/PageHeader'
import { PlatformFilter, type PlatformFilterValue } from '../components/PlatformFilter'
import { RefreshButton } from '../components/RefreshButton'
import { departureJourney, departureKey } from '../lib/departure'
import { useNow } from '../lib/hooks'
import { isTransit } from '../lib/journey'
import { comparePlatforms, platformInfo, type PlatformInfo, type PlatformKind } from '../lib/platforms'
import { currentTrip, useCurrentTrip } from '../store/currentTrip'
import { history } from '../store/history'

const rideId = (j?: Journey) => j?.legs.find(isTransit)?.transportation?.properties?.RealtimeTripId

export default function StationBoard() {
  const { id = '' } = useParams()
  const [sp] = useSearchParams()
  const stationName = sp.get('n')?.split(',')[0] ?? 'Station'
  const now = useNow(1000)
  const current = useCurrentTrip()
  const { data, isLoading, error, fetchStatus } = useDepartures(id)
  const [filter, setFilter] = useState<PlatformFilterValue>()
  const [selectedKey, setSelectedKey] = useState<string>()

  const items = useMemo(
    () =>
      (data ?? []).map((e) => ({
        e,
        key: departureKey(e),
        platform: platformInfo(e.location, e.transportation),
        journey: departureJourney(e),
      })),
    [data],
  )
  // Every platform with a departure, grouped by kind: numbered train and metro platforms, lettered bus stands.
  const groups = useMemo(() => {
    const unique = new Map<string, PlatformInfo>()
    for (const { platform } of items) if (platform) unique.set(platform.key, platform)
    const byKind = new Map<PlatformKind, PlatformInfo[]>()
    for (const p of [...unique.values()].sort(comparePlatforms)) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), p])
    return [...byKind.entries()]
  }, [items])

  const counts = useMemo(() => {
    const c: Partial<Record<PlatformKind, number>> = {}
    for (const { platform } of items) if (platform) c[platform.kind] = (c[platform.kind] ?? 0) + 1
    return c
  }, [items])

  const shown = items.filter(({ platform }) => !filter || (platform?.kind === filter.kind && (!filter.key || platform.key === filter.key)))
  const { vehicles, isLoading: vehiclesLoading } = useJourneyVehicles(shown.map((i) => i.journey))

  const selected = items.find((i) => i.key === selectedKey)
  const detail = useDepartureJourney(selected?.e, id)
  const following = !!selected && rideId(current?.journey) === rideId(selected.journey)

  const follow = (e: StopEvent) => {
    if (!detail) return
    const t = e.transportation
    const toName = (t?.destination?.name ?? '').replace(/ via .*$/i, '')
    currentTrip.set({ journey: detail, fromId: id, toId: t?.destination?.id ?? '', fromName: stationName, toName, boardId: id })
    history.addTrip({ fromId: id, toId: t?.destination?.id ?? '', fromName: stationName, toName, modes: [], journey: detail })
  }

  return (
    <>
      <PageHeader title={stationName} subtitle="Next departures" back action={<RefreshButton />} />
      <Stack gap={3} p={4}>
        {groups.length > 0 && (groups.length > 1 || groups[0][1].length > 1) && (
          <PlatformFilter groups={groups} counts={counts} total={items.length} value={filter} onChange={setFilter} />
        )}
        {!data && fetchStatus === 'paused' && <NoConnection what="this station" />}
        {isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} h="110px" borderRadius="2xl" />)}
        {error && !data && <Text color="red.500">{(error as Error).message}</Text>}
        {data && shown.length === 0 && (
          <Text color="fg.muted" textAlign="center" py={8}>
            No departures found.
          </Text>
        )}
        {shown.map(({ key, journey }) => (
          <JourneyRow
            key={key}
            journey={journey}
            now={now}
            vehicles={vehicles}
            title={`to ${journey.legs[0].destination.name}`}
            onClick={() => setSelectedKey(key)}
          />
        ))}
      </Stack>
      <JourneySheet
        journey={detail}
        vehicles={vehicles}
        vehiclesLoading={vehiclesLoading}
        isCurrent={following}
        onToggleCurrent={() => {
          if (!selected) return
          if (following) currentTrip.clear()
          else follow(selected.e)
        }}
        onClose={() => setSelectedKey(undefined)}
      />
    </>
  )
}
