import { Box, Button, Flex, HStack, IconButton, Skeleton, Spinner, Stack, Text } from '@chakra-ui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { requestFresh } from '../api/client'
import { refreshRealtime } from '../api/realtime'
import { LuArrowLeftRight, LuEyeOff, LuTrainFront } from 'react-icons/lu'
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import type { Journey } from '../api/types'
import { VIA_MS, useJourneyVehicles, useRunningForecasts, useTrips, useTripsMany } from '../api/hooks'
import { EmptyState } from '../components/EmptyState'
import { HiddenTripsNote } from '../components/HiddenTripsNote'
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
import { useScrollAnchor } from '../lib/useScrollAnchor'
import { useSettings } from '../store/settings'
import { history } from '../store/history'
import { savedTrips, tripId, useSavedTrips } from '../store/savedTrips'
import { currentTrip, tripKey, useCurrentTrip } from '../store/currentTrip'
import { PageBody } from '../components/PageBody'

const PAGE = 4
// Later trips (departing) load like earlier ones, a stretch at a time: each search starts after the last trip shown and
// returns about an hour of services, and the next one loads when the end of the list nears the screen.
const LATER_COUNT = 12 // the planner answers with only about 20 minutes of services at a time, so a stretch is a few searches
const MAX_LATER_CHUNKS = 40
const LATER_SPAN_MS = 60 * 60_000
const loadedLater = new Map<string, number[]>()
const depMs = (j: Journey) => Date.parse(summarize(j).depEstimated ?? summarize(j).depPlanned ?? '')
const PAST_SPAN_MS = 60 * 60_000 // each pull of earlier trips reaches an hour further back
// Phones pull down; devices without touch get a button instead.
const canTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

/** The last ride has arrived, so there is nothing left to follow. */
const ended = (j: Journey, now: number) => {
  const last = j.legs[j.legs.length - 1]
  return Date.parse(last?.destination.arrivalTimeEstimated ?? last?.destination.arrivalTimePlanned ?? '') <= now
}
const MAX_PAST_CHUNKS = 24 // hours
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
  const { maxEndWalk: globalEndWalk, maxStartWalk, walkPace, minTransfer } = useSettings()
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
  const [laterStarts, setLaterStartsState] = useState<number[]>(() => loadedLater.get(routeKey) ?? [])
  const setLaterStarts = (next: number[]) => {
    loadedLater.set(routeKey, next)
    setLaterStartsState(next)
  }

  // Earlier trips: loaded only when asked for (pull down or button), shown above the live list.
  // Each pull reaches another hour further back.
  const [pastBase, setPastBase] = useState<number>()
  // Hours pulled so far; the hour being pulled is [lo, hi), and searches (starts) follow each other until it is covered.
  const [pastChunks, setPastChunks] = useState(0)
  const [pastStarts, setPastStarts] = useState<number[]>([])
  const [pastWin, setPastWin] = useState<{ lo: number; hi: number }>()
  const pastEnabled = mode === 'dep' && !when
  const pastFrom = pastBase !== undefined && pastChunks > 0 ? new Date(pastBase) : undefined
  // Earlier trips load above the list without moving it: the trip at the top stays exactly where it is, and the earlier
  // ones wait above for the user to scroll up to.
  const firstShownKey = useRef<string>(undefined)
  const scrollAnchor = useScrollAnchor()
  const revealPast = () => {
    if (!pastEnabled || pastChunks >= MAX_PAST_CHUNKS || pastBusy) return
    const key = firstShownKey.current
    scrollAnchor.hold(key === undefined ? null : document.querySelector(`[data-trip-key="${CSS.escape(key)}"]`))
    const base = pastBase ?? Date.now()
    if (pastBase === undefined) setPastBase(base)
    // Only the hour beyond what is already loaded: it ends where the previous one began.
    const hi = pastWin?.lo ?? base
    const lo = hi - PAST_SPAN_MS
    setPastWin({ lo, hi })
    setPastStarts((st) => [...st, lo])
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
  const { visible, hiddenByStartWalk, hiddenByWalk, hiddenByTransfer } = tripList(data ?? [], {
    now,
    when,
    mode,
    maxEndWalkMin: maxEndWalk,
    maxStartWalkMin: maxStartWalk,
    minTransferMin: minTransfer,
    pace: walkPace,
  })

  const hiddenCount = hiddenByStartWalk + hiddenByWalk + hiddenByTransfer

  const pastQueries = useMemo(
    () =>
      pastStarts.map((t) => ({
        from,
        to,
        mode: 'dep' as const,
        when: new Date(t),
        excluded: exclusionParams(modes),
        count: 12,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pastStarts, from, to, modes.join(',')],
  )
  // Direct searches only, and no refresh: trips that have left don't need the extra routes or live updates.
  const earlier = useTripsMany(pastQueries, true, true)
  // The planner answers with about 20 minutes of services, so the hour is covered by following searches, each starting
  // a minute after the last trip found inside it.
  const inWindow = pastWin ? earlier.journeys.map(depMs).filter((d) => Number.isFinite(d) && d >= pastWin.lo && d < pastWin.hi) : []
  const nextPastStart = inWindow.length ? Math.floor(Math.max(...inWindow) / 60_000) * 60_000 + 60_000 : undefined
  const pastMore = !!pastWin && nextPastStart !== undefined && nextPastStart < pastWin.hi - 60_000 && !pastStarts.includes(nextPastStart)
  const pastBusy = earlier.isFetching || pastMore
  useEffect(() => {
    if (!earlier.isFetching && pastMore) setPastStarts((st) => [...st, nextPastStart!])
  }, [earlier.isFetching, pastMore, nextPastStart])
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
  // Later trips: one direct search per stretch, each starting a minute after the last trip shown so far, refreshed slowly.
  const laterOn = mode === 'dep'
  const laterQueries = useMemo(
    () =>
      laterStarts.map((t) => ({
        from,
        to,
        mode: 'dep' as const,
        when: new Date(t),
        excluded: exclusionParams(modes),
        count: LATER_COUNT,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [laterStarts, from, to, modes.join(',')],
  )
  const later = useTripsMany(laterQueries, true, false, VIA_MS)
  const mainKeys = new Set((data ?? []).map(tripKey))
  const laterAll = [...new Map(later.journeys.map((j) => [tripKey(j), j])).values()].filter((j) => !mainKeys.has(tripKey(j)))
  const laterShown = laterOn
    ? tripList(laterAll, { now, mode, maxEndWalkMin: maxEndWalk, maxStartWalkMin: maxStartWalk, minTransferMin: minTransfer, pace: walkPace }).visible
    : []
  const lastDep = Math.max(-Infinity, ...(data ?? []).map(depMs).filter(Number.isFinite), ...laterAll.map(depMs).filter(Number.isFinite))
  const nextStart = Math.floor(lastDep / 60_000) * 60_000 + 60_000
  // No new trips after the last search means the planner has nothing further.
  const laterDone = laterStarts.length >= MAX_LATER_CHUNKS || laterStarts.includes(nextStart)
  const addChunk = () => {
    if (Number.isFinite(nextStart) && !laterDone) setLaterStarts([...laterStarts, nextStart])
  }
  // One stretch is an hour of services past the last trip shown: searches follow each other until it is covered.
  const [laterTarget, setLaterTarget] = useState(0)
  const loadLater = () => {
    setLaterTarget(lastDep + LATER_SPAN_MS)
    addChunk()
  }
  useEffect(() => {
    if (laterTarget > 0 && laterStarts.length > 0 && !later.isFetching && !laterDone && lastDep < laterTarget) addChunk()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laterTarget, later.isFetching, lastDep, laterDone])
  const laterReady = laterOn && !!data && !isPlaceholderData && !laterDone && !later.isFetching && (visible.length > 0 || hiddenCount > 0)
  const laterEnd = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!laterReady || !laterEnd.current || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && loadLater(), { rootMargin: '150px' })
    io.observe(laterEnd.current)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laterReady, nextStart])
  // Current results look up a running trip's forecast; earlier ones only once opened or followed (one call each).
  const [unlocked, setUnlocked] = useState<string[]>([])
  const unlock = (key: string) => setUnlocked((u) => (u.includes(key) ? u : [...u, key]))
  const currentKey = current ? tripKey(current.journey) : undefined
  const shownVisible = useRunningForecasts(visible)
  const unlockedPast = useRunningForecasts(past.filter((j) => unlocked.includes(tripKey(j)) || tripKey(j) === currentKey))
  const shownPast = past.map((j) => unlockedPast.find((u) => tripKey(u) === tripKey(j)) ?? j)
  const everything = [...shownPast, ...shownVisible, ...laterShown]
  firstShownKey.current = everything[0] && tripKey(everything[0])

  // Let go of the top trip shortly after the earlier ones have all landed (the timer restarts while any still load).
  const pastKeys = shownPast.map(tripKey).join('|')
  useEffect(() => {
    if (pastBusy) return
    const t = setTimeout(scrollAnchor.release, 400)
    return () => clearTimeout(t)
  }, [pastBusy, pastKeys, scrollAnchor.release])
  const selectedJourney = selectedKey === undefined ? undefined : everything.find((j) => tripKey(j) === selectedKey)

  // A short list means the planner has no further trips; a growing request keeps the button while loading.
  // With every trip hidden by the user's limits, later ones may still fit, so the button stays.
  const canLoadMore = !laterOn && !!data && (visible.length > 0 || hiddenCount > 0) && (isPlaceholderData || data.length >= count)

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
            <IconButton aria-label="Swap direction" variant="ghost" color="inherit" onClick={swap}>
              <LuArrowLeftRight />
            </IconButton>
            <SaveTripChip route={{ fromId: from, fromName, toId: to, toName, modes }} onHeader removable />
          </>
        }
      />
      <PageBody ref={pullRef} position="relative">
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
        <HiddenTripsNote
          allHidden={!!data && visible.length === 0 && !settling}
          reasons={[
            {
              count: hiddenByStartWalk,
              text: `${hiddenByStartWalk === 1 ? 'One has' : `${hiddenByStartWalk} have`} a walk to the first stop over ${maxStartWalk} min. Change this in Settings under "Walking to the first stop".`,
            },
            {
              count: hiddenByWalk,
              text: `${hiddenByWalk === 1 ? 'One ends' : `${hiddenByWalk} end`} ${maxEndWalk === 0 ? 'with a walk' : `with a walk over ${maxEndWalk} min`}. Tap the footprints icon to allow longer walks.`,
            },
            {
              count: hiddenByTransfer,
              text: `${hiddenByTransfer === 1 ? 'One has a change' : `${hiddenByTransfer} have a change`} under ${minTransfer} min, or too little time to walk to the next platform. Tap the footprints icon to allow tighter changes.`,
            },
          ]}
        />
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
        {data && visible.length === 0 && !settling && hiddenCount > 0 && (
          <EmptyState icon={LuEyeOff} title="All trips hidden">
            {hiddenCount === 1 ? 'The trip found breaks' : `All ${hiddenCount} trips found break`} your walking or change limits, as
            explained above. Change them with the footprints icon or in Settings, or try later trips.
          </EmptyState>
        )}
        {data && visible.length === 0 && !settling && hiddenCount === 0 && (
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
        {pastEnabled && !canTouch && data && !pastBusy && pastChunks < MAX_PAST_CHUNKS && (
          <Button variant="subtle" size="sm" borderRadius="xl" alignSelf="center" onClick={revealPast}>
            {pastChunks === 0 ? 'Show earlier trips' : 'Show even earlier trips'}
          </Button>
        )}
        {pastFrom && pastBusy && (
          // As tall as the "Show earlier trips" button it replaces, so the list doesn't shift up at the top of the page.
          <HStack justify="center" gap={2} color="fg.muted" fontSize="xs" h="9">
            <Spinner size="xs" />
            <Text>Pulling older trips…</Text>
          </HStack>
        )}
        {pastFrom && !pastBusy && past.length === 0 && (
          <Text fontSize="xs" color="fg.muted" textAlign="center">
            No earlier trips found.
          </Text>
        )}
        {shownPast.map((j, i) => (
          <Box key={`past-${summarize(j).depPlanned}-${i}`} data-trip-key={tripKey(j)} opacity={0.55}>
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
          <Box key={`${summarize(j).depPlanned}-${i}`} data-trip-key={tripKey(j)}>
            <JourneyRow journey={j} now={now} vehicles={vehicles} onClick={() => setSelectedKey(tripKey(j))} />
          </Box>
        ))}
        {isLoadingMore && visible.length > 0 && (
          <HStack justify="center" gap={2} color="fg.muted" fontSize="sm" py={1}>
            <Spinner size="xs" />
            <Text>Checking more routes through the city interchanges…</Text>
          </HStack>
        )}
        {laterShown.map((j, i) => (
          <Box key={`later-${summarize(j).depPlanned}-${i}`} data-trip-key={tripKey(j)}>
            <JourneyRow journey={j} now={now} vehicles={vehicles} onClick={() => setSelectedKey(tripKey(j))} />
          </Box>
        ))}
        {laterOn && !!data && (visible.length > 0 || hiddenCount > 0) && (
          <>
            <div ref={laterEnd} aria-hidden />
            {later.isFetching ? (
              <HStack justify="center" gap={2} color="fg.muted" fontSize="sm" h="9">
                <Spinner size="xs" />
                <Text>Loading later trips…</Text>
              </HStack>
            ) : laterDone ? (
              <Text fontSize="xs" color="fg.muted" textAlign="center">
                No more later trips
              </Text>
            ) : (
              <Button variant="subtle" size="sm" borderRadius="xl" alignSelf="center" h="9" onClick={loadLater}>
                Show later trips
              </Button>
            )}
          </>
        )}
        {canLoadMore && (
          <Button variant="subtle" borderRadius="xl" loading={isFetching && isPlaceholderData} onClick={() => setCount(count + PAGE)}>
            Show later trips
          </Button>
        )}
      </PageBody>
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
