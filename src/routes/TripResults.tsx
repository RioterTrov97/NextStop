import { Box, Button, Flex, HStack, IconButton, Skeleton, Spinner, Stack, Text } from '@chakra-ui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { requestFresh } from '../api/client'
import { refreshRealtime } from '../api/realtime'
import { LuArrowLeftRight, LuTrainFront } from 'react-icons/lu'
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import type { Journey } from '../api/types'
import { useJourneyVehicles, useRunningForecasts, useTrips, useTripsMany } from '../api/hooks'
import { EmptyState } from '../components/EmptyState'
import { JourneyRow } from '../components/JourneyRow'
import { JourneySheet } from '../components/JourneySheet'
import { ModePicker } from '../components/ModePicker'
import { NoConnection } from '../components/NoConnection'
import { PageHeader } from '../components/PageHeader'
import { RefreshButton } from '../components/RefreshButton'
import { SaveTripChip } from '../components/SaveTrip'
import { useNow } from '../lib/hooks'
import { usePullDown } from '../lib/usePullDown'
import { summarize, tripList } from '../lib/journey'
import { exclusionParams } from '../lib/lines'
import { tripPath } from '../lib/paths'
import { useSettings } from '../store/settings'
import { history } from '../store/history'
import { savedTrips, tripId, useSavedTrips } from '../store/savedTrips'
import { currentTrip, tripKey, useCurrentTrip } from '../store/currentTrip'

const PAGE = 4
const PAST_CHUNK_MIN = 90
// Phones pull down; devices without touch get a button instead.
const canTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

/** The last ride has arrived, so there is nothing left to follow. */
const ended = (j: Journey, now: number) => {
  const last = j.legs[j.legs.length - 1]
  return Date.parse(last?.destination.arrivalTimeEstimated ?? last?.destination.arrivalTimePlanned ?? '') <= now
}
const MAX_PAST_CHUNKS = 16
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
  const { maxEndWalk: globalEndWalk, walkPace, minTransfer } = useSettings()
  const when = sp.get('w') ? new Date(sp.get('w')!) : undefined
  const mode = sp.get('m') === 'arr' ? 'arr' : 'dep'

  const { pathname, search } = useLocation()
  const routeKey = pathname + search
  const [count, setCountState] = useState(() => loadedCounts.get(routeKey) ?? 6)
  const setCount = (n: number) => {
    loadedCounts.set(routeKey, n)
    setCountState(n)
  }
  const [selectedKey, setSelectedKey] = useState<string>()

  // Earlier trips: loaded only when asked for (pull down or button), shown above the live list.
  // Each pull reaches another 90 minutes further back.
  const [pastBase, setPastBase] = useState<number>()
  const [pastChunks, setPastChunks] = useState(0)
  const pastEnabled = mode === 'dep' && !when
  const pastFrom = pastBase !== undefined && pastChunks > 0 ? new Date(pastBase) : undefined
  const revealPast = () => {
    if (!pastEnabled || pastChunks >= MAX_PAST_CHUNKS) return
    if (pastBase === undefined) setPastBase(Date.now())
    setPastChunks((n) => n + 1)
  }
  const { ref: pullRef, labelRef: pullLabelRef } = usePullDown({ enabled: pastEnabled && selectedKey === undefined, onRelease: revealPast })

  // Changing the route (swap, new modes) refetches live data now, even when a cached copy is still fresh.
  const qc = useQueryClient()
  const firstRoute = useRef(true)
  useEffect(() => {
    if (firstRoute.current) {
      firstRoute.current = false
      return
    }
    requestFresh()
    void refreshRealtime(qc)
  }, [routeKey, qc])

  const { data, isLoading, isLoadingMore, error, isFetching, isPlaceholderData, fetchStatus, refetch } = useTrips({
    from,
    to,
    mode,
    when,
    excluded: exclusionParams(modes),
    count,
  })
  const savedTrip = saved.find((t) => t.id === tripId(from, to))
  const isSaved = !!savedTrip
  const maxEndWalk = savedTrip?.maxEndWalk ?? globalEndWalk
  const { visible, hiddenByWalk, hiddenByTransfer } = tripList(data ?? [], {
    now,
    when,
    mode,
    maxEndWalkMin: maxEndWalk,
    minTransferMin: minTransfer,
    pace: walkPace,
  })

  const pastQueries = useMemo(
    () =>
      Array.from({ length: pastBase === undefined ? 0 : pastChunks }, (_, k) => ({
        from,
        to,
        mode: 'dep' as const,
        when: new Date(pastBase! - (k + 1) * PAST_CHUNK_MIN * 60_000),
        excluded: exclusionParams(modes),
        count: 8,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pastBase, pastChunks, from, to, modes.join(',')],
  )
  const earlier = useTripsMany(pastQueries, false, true)
  const past = pastFrom
    ? tripList([...new Map(earlier.journeys.map((j) => [tripKey(j), j])).values()], {
        now,
        when: pastFrom,
        mode,
        maxEndWalkMin: maxEndWalk,
        minTransferMin: minTransfer,
        pace: walkPace,
      }).visible.filter((j) => Date.parse(summarize(j).depEstimated ?? summarize(j).depPlanned ?? '') <= now - 60_000)
    : []
  // Current results look up a running trip's forecast; earlier ones only once opened or followed (one call each).
  const [unlocked, setUnlocked] = useState<string[]>([])
  const unlock = (key: string) => setUnlocked((u) => (u.includes(key) ? u : [...u, key]))
  const currentKey = current ? tripKey(current.journey) : undefined
  const shownVisible = useRunningForecasts(visible)
  const unlockedPast = useRunningForecasts(past.filter((j) => unlocked.includes(tripKey(j)) || tripKey(j) === currentKey))
  const shownPast = past.map((j) => unlockedPast.find((u) => tripKey(u) === tripKey(j)) ?? j)
  const everything = [...shownPast, ...shownVisible]
  const selectedJourney = selectedKey === undefined ? undefined : everything.find((j) => tripKey(j) === selectedKey)

  // A short list means the planner has no further trips; a growing request keeps the button while loading.
  const canLoadMore = !!data && visible.length > 0 && (isPlaceholderData || data.length >= count)

  // Cached trips may all be in the past; wait for the refetch instead of flashing "No trips found".
  const settling = !!data && visible.length === 0 && isFetching

  const { vehicles, isLoading: vehiclesLoading } = useJourneyVehicles(everything)

  const swap = () => {
    history.addSearch({ fromId: to, toId: from, fromName: toName, toName: fromName, modes: [] })
    navigate(tripPath({ fromId: to, toId: from, fromName: toName, toName: fromName, modes }), { replace: true })
  }

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
            <SaveTripChip route={{ fromId: from, fromName, toId: to, toName, modes }} onHeader removable />
          </>
        }
      />
      <Stack ref={pullRef} gap={3} p={4} position="relative">
        <Flex
          ref={pullLabelRef}
          position="absolute"
          left={0}
          right={0}
          top="-40px"
          h="40px"
          align="flex-end"
          justify="center"
          pb={2}
          opacity={0}
          pointerEvents="none"
          fontSize="xs"
          color="fg.muted"
          aria-hidden
        >
          {pastChunks >= MAX_PAST_CHUNKS ? (
            'No more earlier trips'
          ) : (
            <>
              <Text as="span" css={{ '[data-armed=true] > &': { display: 'none' } }}>
                Pull down for earlier trips
              </Text>
              <Text as="span" display="none" css={{ '[data-armed=true] > &': { display: 'inline' } }}>
                Release to load earlier trips
              </Text>
            </>
          )}
        </Flex>
        <ModePicker
          value={modes}
          onChange={changeModes}
          size="xs"
          endWalk={savedTrip && { value: maxEndWalk, onChange: (n) => savedTrips.setEndWalk(savedTrip.id, n) }}
        />
        {hiddenByWalk > 0 && (
          <Text fontSize="xs" color="fg.muted">
            {hiddenByWalk} {hiddenByWalk === 1 ? 'trip is' : 'trips are'} hidden because{' '}
            {maxEndWalk === 0 ? 'they end with a walk' : `the walk at the end is over ${maxEndWalk} min`}. Tap the footprints icon to allow
            longer walks.
          </Text>
        )}
        {hiddenByTransfer > 0 && (
          <Text fontSize="xs" color="fg.muted">
            {hiddenByTransfer} {hiddenByTransfer === 1 ? 'trip is' : 'trips are'} hidden because a change leaves under {minTransfer} min, or
            too little time to walk to the next platform. Tap the footprints icon to allow tighter changes.
          </Text>
        )}
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
        {pastEnabled && !canTouch && data && !earlier.isFetching && pastChunks < MAX_PAST_CHUNKS && (
          <Button variant="subtle" size="sm" borderRadius="xl" alignSelf="center" onClick={revealPast}>
            {pastChunks === 0 ? 'Show earlier trips' : 'Show even earlier trips'}
          </Button>
        )}
        {pastFrom && earlier.isFetching && (
          <HStack justify="center" gap={2} color="fg.muted" fontSize="xs" py={1}>
            <Spinner size="xs" />
            <Text>Pulling older trips…</Text>
          </HStack>
        )}
        {pastFrom && !earlier.isFetching && past.length === 0 && (
          <Text fontSize="xs" color="fg.muted" textAlign="center">
            No earlier trips found in the last hour or so.
          </Text>
        )}
        {shownPast.map((j, i) => (
          <Box key={`past-${summarize(j).depPlanned}-${i}`} opacity={0.55}>
            <JourneyRow
              journey={j}
              now={now}
              vehicles={vehicles}
              hideLoad={ended(j, now)}
              noLoadHint={unlocked.includes(tripKey(j)) || tripKey(j) === currentKey ? undefined : 'Follow to see load'}
              onClick={() => {
                unlock(tripKey(j))
                setSelectedKey(tripKey(j))
              }}
            />
          </Box>
        ))}
        {shownVisible.map((j, i) => (
          <JourneyRow
            key={`${summarize(j).depPlanned}-${i}`}
            journey={j}
            now={now}
            vehicles={vehicles}
            onClick={() => setSelectedKey(tripKey(j))}
          />
        ))}
        {isLoadingMore && visible.length > 0 && (
          <HStack justify="center" gap={2} color="fg.muted" fontSize="sm" py={1}>
            <Spinner size="xs" />
            <Text>Checking more routes through the city interchanges…</Text>
          </HStack>
        )}
        {canLoadMore && (
          <Button variant="subtle" borderRadius="xl" loading={isFetching && isPlaceholderData} onClick={() => setCount(count + PAGE)}>
            Show later trips
          </Button>
        )}
      </Stack>
      <JourneySheet
        journey={selectedJourney}
        vehicles={vehicles}
        vehiclesLoading={vehiclesLoading}
        isCurrent={!!selectedJourney && !!current && tripKey(selectedJourney) === tripKey(current.journey)}
        onToggleCurrent={() => {
          const j = selectedJourney
          if (!j) return
          if (current && tripKey(j) === tripKey(current.journey)) currentTrip.clear()
          else {
            currentTrip.set({ journey: j, fromId: from, toId: to, fromName, toName })
            history.addTrip({ fromId: from, toId: to, fromName, toName, modes: [], journey: j })
          }
        }}
        onClose={() => setSelectedKey(undefined)}
      />
    </>
  )
}
