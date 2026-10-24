import { Button, IconButton, Skeleton, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuArrowLeftRight, LuBookmark, LuBookmarkCheck, LuTrainFront } from 'react-icons/lu'
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useJourneyVehicles, useTrips } from '../api/hooks'
import { EmptyState } from '../components/EmptyState'
import { JourneyRow } from '../components/JourneyRow'
import { JourneySheet } from '../components/JourneySheet'
import { ModePicker } from '../components/ModePicker'
import { NoConnection } from '../components/NoConnection'
import { PageHeader } from '../components/PageHeader'
import { RefreshButton } from '../components/RefreshButton'
import { useNow } from '../lib/hooks'
import { journeyComparator, summarize } from '../lib/journey'
import { exclusionParams } from '../lib/lines'
import { tripPath } from '../lib/paths'
import { savedTrips, tripId, useSavedTrips } from '../store/savedTrips'
import { currentTrip, tripKey, useCurrentTrip } from '../store/currentTrip'

const PAGE = 4
// Trips loaded per route, so returning from another tab restores the longer list.
const loadedCounts = new Map<string, number>()

export default function TripResults() {
  const { from = '', to = '' } = useParams()
  const [sp] = useSearchParams()
  const navigate = useNavigate()
  const now = useNow(1000)
  const saved = useSavedTrips()
  const current = useCurrentTrip()

  const fromName = sp.get('fn') ?? from
  const toName = sp.get('tn') ?? to
  const modes = sp.get('modes')?.split(',').filter(Boolean) ?? []
  const when = sp.get('w') ? new Date(sp.get('w')!) : undefined
  const mode = sp.get('m') === 'arr' ? 'arr' : 'dep'

  const { pathname, search } = useLocation()
  const routeKey = pathname + search
  const [count, setCountState] = useState(() => loadedCounts.get(routeKey) ?? 6)
  const setCount = (n: number) => {
    loadedCounts.set(routeKey, n)
    setCountState(n)
  }
  const [selected, setSelected] = useState<number>()

  const { data, isLoading, error, isFetching, isPlaceholderData, fetchStatus, refetch } = useTrips({
    from,
    to,
    mode,
    when,
    excluded: exclusionParams(modes),
    count,
  })
  const isSaved = saved.some((t) => t.id === tripId(from, to))
  const visible = (data ?? [])
    .filter((j) => {
      if (when) return true
      const s = summarize(j)
      return new Date(s.depEstimated ?? s.depPlanned ?? 0).getTime() > now - 60_000
    })
    .sort(journeyComparator(mode, when))

  // A short list means the planner has no further trips; a growing request keeps the button while loading.
  const canLoadMore = !!data && visible.length > 0 && (isPlaceholderData || data.length >= count)

  // Cached trips may all be in the past; wait for the refetch instead of flashing "No trips found".
  const settling = !!data && visible.length === 0 && isFetching

  const { vehicles, isLoading: vehiclesLoading } = useJourneyVehicles(visible)

  const swap = () => navigate(tripPath({ fromId: to, toId: from, fromName: toName, toName: fromName, modes }), { replace: true })

  // Applies to this view and, for a saved trip, to the saved trip itself.
  const changeModes = (next: string[]) => {
    const extra: Record<string, string> = {}
    for (const k of ['m', 'w']) {
      const v = sp.get(k)
      if (v) extra[k] = v
    }
    if (isSaved) savedTrips.setModes(tripId(from, to), next)
    navigate(tripPath({ fromId: from, toId: to, fromName, toName, modes: next }, extra), { replace: true })
  }

  return (
    <>
      <PageHeader
        title={fromName.split(',')[0]}
        subtitle={`to ${toName.split(',')[0]}`}
        back
        action={
          <>
            <RefreshButton />
            <IconButton aria-label="Swap direction" variant="ghost" color="white" onClick={swap}>
              <LuArrowLeftRight />
            </IconButton>
            <IconButton
              aria-label={isSaved ? 'Remove from saved trips' : 'Save trip'}
              variant="ghost"
              color="white"
              onClick={() =>
                isSaved ? savedTrips.remove(tripId(from, to)) : savedTrips.add({ fromId: from, fromName, toId: to, toName, modes })
              }
            >
              {isSaved ? <LuBookmarkCheck /> : <LuBookmark />}
            </IconButton>
          </>
        }
      />
      <Stack gap={3} p={4}>
        <ModePicker value={modes} onChange={changeModes} size="xs" />
        {!data && fetchStatus === 'paused' && <NoConnection what="this trip" />}
        {(isLoading || settling) && [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h="110px" borderRadius="2xl" />)}
        {error && !data && (
          <Stack align="center" py={8} gap={2}>
            <Text color="red.500">{(error as Error).message}</Text>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </Stack>
        )}
        {data && visible.length === 0 && !settling && (
          <EmptyState
            icon={LuTrainFront}
            title="No trips found"
            action={
              <Button variant="subtle" size="sm" borderRadius="xl" onClick={swap}>
                <LuArrowLeftRight /> Swap direction
              </Button>
            }
          >
            Nothing matches {fromName.split(',')[0]} to {toName.split(',')[0]} right now. Try another time, add more transport modes, or
            swap direction.
          </EmptyState>
        )}
        {visible.map((j, i) => (
          <JourneyRow key={`${summarize(j).depPlanned}-${i}`} journey={j} now={now} vehicles={vehicles} onClick={() => setSelected(i)} />
        ))}
        {canLoadMore && (
          <Button variant="subtle" borderRadius="xl" loading={isFetching && isPlaceholderData} onClick={() => setCount(count + PAGE)}>
            Show later trips
          </Button>
        )}
      </Stack>
      <JourneySheet
        journey={selected === undefined ? undefined : visible[selected]}
        vehicles={vehicles}
        vehiclesLoading={vehiclesLoading}
        isCurrent={selected !== undefined && !!visible[selected] && !!current && tripKey(visible[selected]) === tripKey(current.journey)}
        onToggleCurrent={() => {
          const j = selected === undefined ? undefined : visible[selected]
          if (!j) return
          if (current && tripKey(j) === tripKey(current.journey)) currentTrip.clear()
          else currentTrip.set({ journey: j, fromId: from, toId: to, fromName, toName })
        }}
        onClose={() => setSelected(undefined)}
      />
    </>
  )
}
