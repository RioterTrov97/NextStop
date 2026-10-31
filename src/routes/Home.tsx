import { Box, Button, CloseButton, Dialog, Flex, HStack, IconButton, Image, Portal, Skeleton, Stack, Text } from '@chakra-ui/react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Fragment, useState, type ReactNode } from 'react'
import {
  LuArrowRight,
  LuBus,
  LuClock,
  LuFootprints,
  LuShip,
  LuTrainFront,
  LuTrainTrack,
  LuTramFront,
  LuBookmarkPlus,
  LuArrowUpDown,
  LuGripVertical,
  LuTrash2,
  LuEllipsisVertical,
  LuSearch,
} from 'react-icons/lu'
import type { IconType } from 'react-icons'
import { Link } from 'react-router-dom'
import { REALTIME_MS, useTrips, useJourneyVehicles } from '../api/hooks'
import { EmptyState } from '../components/EmptyState'
import { JourneySheet } from '../components/JourneySheet'
import { DelayText } from '../components/DelayBadge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CurrentTripCard } from '../components/CurrentTripCard'
import { WeekendNotice } from '../components/WeekendNotice'
import { ModePicker } from '../components/ModePicker'
import { LineBadge } from '../components/LineBadge'
import { PageHeader } from '../components/PageHeader'
import { WalkBadge } from '../components/WalkBadge'
import { RefreshButton } from '../components/RefreshButton'
import { SaveTripChip } from '../components/SaveTrip'
import { LoadIndicator, loadIndicatorWidth } from '../components/LoadIndicator'
import { useNow } from '../lib/hooks'
import { isTransit, summarize, trailingWalk, tripList } from '../lib/journey'
import { exclusionParams, MODES } from '../lib/lines'
import { tripPath } from '../lib/paths'
import { platformInfo } from '../lib/platforms'
import { isCancelled } from '../lib/replan'
import { countdown, formatTime } from '../lib/time'
import { currentTrip, tripKey, useCurrentTrip } from '../store/currentTrip'
import { SwipeToRemove } from '../components/SwipeToRemove'
import { dedupeRoutes, history, routeKey, useSearchHistory, useTripHistory } from '../store/history'
import { PERIODS, periodAt, savedTrips, useSavedTrips, type SavedTrip } from '../store/savedTrips'
import { END_WALK_OPTIONS, useSettings } from '../store/settings'

function Upcoming({ trip, now }: { trip: SavedTrip; now: number }) {
  const { maxEndWalk: globalEndWalk, walkPace, minTransfer } = useSettings()
  const maxEndWalk = trip.maxEndWalk ?? globalEndWalk
  const current = useCurrentTrip()
  const [selected, setSelected] = useState<number>()
  // Same query key as the trip results page, so opening a trip reuses this data.
  const { data, isLoading, isFetching, dataUpdatedAt, error, fetchStatus } = useTrips({
    from: trip.fromId,
    to: trip.toId,
    mode: 'dep',
    excluded: exclusionParams(trip.modes),
  })
  const upcoming = tripList(data ?? [], {
    now,
    mode: 'dep',
    maxEndWalkMin: maxEndWalk,
    minTransferMin: minTransfer,
    pace: walkPace,
  }).visible
  // Data restored from the persisted cache can be hours old, so every journey looks departed until the refetch lands.
  const refreshingStale = isFetching && upcoming.length === 0 && now - dataUpdatedAt > REALTIME_MS
  const selectedJourney = selected === undefined ? undefined : upcoming[selected]
  // Loads for the rows on show; rail comes from one shared feed query, so this adds no requests per card.
  const shown = upcoming.slice(0, 3)
  const { vehicles, isLoading: vehiclesLoading } = useJourneyVehicles(
    selectedJourney && !shown.includes(selectedJourney) ? [...shown, selectedJourney] : shown,
  )
  // One load column per card, as wide as its widest icon, so the line badges get everything else.
  const loadWidth = Math.max(
    0,
    ...shown.flatMap((j) => {
      const leg = j.legs.find(isTransit)
      return leg ? [loadIndicatorWidth(leg, vehicles.get(leg.transportation?.properties?.RealtimeTripId ?? ''))] : []
    }),
  )
  const isCurrent = !!selectedJourney && !!current && tripKey(selectedJourney) === tripKey(current.journey)

  return (
    <Stack gap={0} px={2} pb={2}>
      {(isLoading || refreshingStale) && <Skeleton h="44px" m={2} borderRadius="lg" />}
      {!data && fetchStatus === 'paused' && (
        <Text px={2} py={2} fontSize="sm" color="fg.muted">
          Offline. Not saved on this device yet.
        </Text>
      )}
      {error && !data && (
        <Text px={2} py={2} fontSize="sm" color="red.500">
          {(error as Error).message}
        </Text>
      )}
      {data && upcoming.length === 0 && !refreshingStale && (
        <Text px={2} py={2} fontSize="sm" color="fg.muted">
          No upcoming services found.
        </Text>
      )}
      {shown.map((j, i) => {
        const s = summarize(j)
        const dep = s.depEstimated ?? s.depPlanned
        const arr = s.arrEstimated ?? s.arrPlanned
        const transit = j.legs.filter(isTransit)
        const tailWalk = trailingWalk(j, walkPace)
        const boardAt = transit[0] && platformInfo(transit[0].origin, transit[0].transportation)?.long
        return (
          // Two options can share a departure (a direct train and one that changes), so the whole route is the key.
          <Fragment key={tripKey(j)}>
            {/* A thin divider between trips, inset so it clears the rounded hover highlight. */}
            {i > 0 && <Box h="1px" mx={2} bg="border.muted" aria-hidden />}
            <Flex
              as="button"
              align="center"
              // Even, clear gaps between the time, ride, load and countdown columns.
              gap={3}
              px={2}
              py={2}
              borderRadius="lg"
              onClick={() => setSelected(i)}
              _hover={{ bg: 'bg.muted' }}
            >
              {/* Fixed width, wide enough for "arrives 12:43 am", so line badges and platforms start at the same place in every row. */}
              <Box w="84px" flexShrink={0} textAlign="start" fontVariantNumeric="tabular-nums" whiteSpace="nowrap" lineHeight="short">
                <Text fontSize="sm" fontWeight="bold">
                  {formatTime(dep)}
                </Text>
                {arr && (
                  <Text color="fg.muted" fontSize="2xs">
                    arrives {formatTime(arr)}
                  </Text>
                )}
              </Box>
              <Box flex={1} minW={0}>
                <HStack gap={1} wrap="wrap">
                  {transit.map((leg, legIndex) => (
                    <LineBadge
                      key={legIndex}
                      number={leg.transportation?.number ?? leg.transportation?.disassembledName}
                      cls={leg.transportation?.product?.class}
                      size="sm"
                    />
                  ))}
                  {tailWalk && <WalkBadge seconds={tailWalk.durationSec} meters={tailWalk.distanceM} size="sm" />}
                </HStack>
                {/* Secondary line, like "arrives …": the platform or stand the first ride leaves from. */}
                {boardAt && (
                  <Text color="fg.muted" fontSize="2xs" mt={1} textAlign="start" truncate>
                    {boardAt}
                  </Text>
                )}
              </Box>
              {/* As wide as the widest icon on show, so the icons line up row under row without taking space from the badges. */}
              <Flex w={`${loadWidth}px`} flexShrink={0} justify="center">
                {transit[0] && (
                  <LoadIndicator leg={transit[0]} vehicle={vehicles.get(transit[0].transportation?.properties?.RealtimeTripId ?? '')} />
                )}
              </Flex>
              {/* Minutes to go with the running status tucked right under it, as one unit. */}
              <Flex w="56px" flexShrink={0} direction="column" align="flex-end" whiteSpace="nowrap">
                <Text fontSize="sm" fontWeight="bold" color="teal.500" fontVariantNumeric="tabular-nums" lineHeight="1.2">
                  {countdown(dep, now)}
                </Text>
                <DelayText
                  planned={s.depPlanned}
                  estimated={s.depEstimated}
                  realtime={s.realtime}
                  cancelled={!!s.firstTransit && isCancelled(s.firstTransit)}
                />
              </Flex>
            </Flex>
          </Fragment>
        )
      })}
      <JourneySheet
        journey={selectedJourney}
        vehicles={vehicles}
        vehiclesLoading={vehiclesLoading}
        // Home's header only carries the countdown while a trip is followed.
        showRefresh={!current}
        isCurrent={isCurrent}
        onToggleCurrent={() => {
          if (!selectedJourney) return
          if (isCurrent) currentTrip.clear()
          else {
            currentTrip.set({
              journey: selectedJourney,
              fromId: trip.fromId,
              toId: trip.toId,
              fromName: trip.fromName,
              toName: trip.toName,
            })
            history.addTrip({
              fromId: trip.fromId,
              toId: trip.toId,
              fromName: trip.fromName,
              toName: trip.toName,
              modes: [],
              journey: selectedJourney,
            })
          }
        }}
        onClose={() => setSelected(undefined)}
      />
    </Stack>
  )
}

const MODE_ICONS: Record<string, IconType> = {
  train: LuTrainFront,
  metro: LuTrainTrack,
  lightrail: LuTramFront,
  bus: LuBus,
  ferry: LuShip,
}

/** Beyond the user's limit the card is just the route, so a long list doesn't fire a live request per trip. */
function SavedTripCard({ trip, now, compact, handle }: { trip: SavedTrip; now: number; compact: boolean; handle?: ReactNode }) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [editing, setEditing] = useState(false)
  const period = PERIODS.find((p) => p.key === (trip.period ?? 'all')) ?? PERIODS[0]
  const { maxEndWalk: globalEndWalk } = useSettings()
  const maxEndWalk = trip.maxEndWalk ?? globalEndWalk
  // No filter, or every mode picked, means no icons are needed.
  const shownModes = trip.modes.length && trip.modes.length < MODES.length ? MODES.filter((m) => trip.modes.includes(m.key)) : []
  const hours = period.key === 'all' ? undefined : `(${period.hours.replace(/ – /g, '-')})`

  return (
    <>
      <SwipeToRemove confirm onRemove={() => setConfirmRemove(true)}>
        <Box bg="bg.panel" borderRadius="2xl" borderWidth="1px" overflow="hidden" css={{ containerType: 'inline-size' }}>
          <Flex align="center" p={4} pb={compact ? 4 : 2} gap={2}>
            {handle}
            <Flex direction="column" align="center" gap="3px" mt={1.5} alignSelf="flex-start" flexShrink={0} aria-hidden>
              <Box boxSize="9px" borderRadius="full" borderWidth="2px" borderColor="teal.solid" />
              <Box w="2px" h="14px" borderRadius="full" bg="border.emphasized" />
              <Box boxSize="9px" borderRadius="full" bg="teal.solid" />
            </Flex>
            {/* Takes what the time slot leaves. The names add nothing to the column's natural width (w=0, minW=full), so it never gets narrower than the widest item of the modes/walk line, and that line wraps only when the column is squeezed below its full width. */}
            <Box asChild flex="1 1 0">
              <Link to={tripPath(trip)}>
                <Text fontWeight="bold" truncate w={0} minW="full">
                  {trip.fromName.split(',')[0]}
                </Text>
                <Text fontWeight="bold" truncate w={0} minW="full">
                  {trip.toName.split(',')[0]}
                </Text>
                <HStack fontSize="xs" color="fg.muted" columnGap={2} rowGap={0.5} wrap="wrap" mt={0.5}>
                  {shownModes.length === 0 ? (
                    <Text flexShrink={0}>All modes</Text>
                  ) : (
                    <HStack gap={1} flexShrink={0} aria-label={shownModes.map((m) => m.label).join(', ')}>
                      {shownModes.map((m) => {
                        const Icon = MODE_ICONS[m.key]
                        return <Icon key={m.key} title={m.label} />
                      })}
                    </HStack>
                  )}
                  {maxEndWalk > 0 && (
                    <>
                      <Text aria-hidden>·</Text>
                      <HStack gap={1} flexShrink={0} aria-label={`${maxEndWalk} minute walk`}>
                        <LuFootprints aria-hidden />
                        <Text>{maxEndWalk} min</Text>
                      </HStack>
                    </>
                  )}
                </HStack>
              </Link>
            </Box>
            {/* Stacked (label over hours) as wide as its longest word; one line when the card is wide enough for that and the names. */}
            <Box
              display="flex"
              flexDirection="column"
              flexShrink={0}
              color="fg.muted"
              fontSize="xs"
              lineHeight="short"
              whiteSpace="nowrap"
              css={{ '@container (min-width: 460px)': { flexDirection: 'row', alignItems: 'center', columnGap: '4px' } }}
            >
              <HStack gap={1}>
                <LuClock aria-hidden />
                <Text>{period.label}</Text>
              </HStack>
              {hours && <Text>{hours}</Text>}
            </Box>
            <IconButton
              data-no-swipe
              aria-label="Edit trip"
              aria-haspopup="dialog"
              variant="ghost"
              size="sm"
              color="fg.muted"
              flexShrink={0}
              onClick={() => setEditing((e) => !e)}
            >
              <LuEllipsisVertical />
            </IconButton>
          </Flex>
          {!compact && <Upcoming trip={trip} now={now} />}
        </Box>
      </SwipeToRemove>
      <Dialog.Root open={editing} placement="center" lazyMount onOpenChange={(e) => setEditing(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content mx={4} borderRadius="2xl">
              <Dialog.Header>
                <Dialog.Title>
                  {trip.fromName.split(',')[0]} → {trip.toName.split(',')[0]}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
              <Dialog.Body>
                <Stack gap={4}>
                  <Box>
                    <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb={1.5}>
                      Show this trip
                    </Text>
                    <HStack gap={1.5} wrap="wrap">
                      {PERIODS.map((p) => (
                        <Button
                          key={p.key}
                          size="xs"
                          borderRadius="full"
                          colorPalette="teal"
                          variant={p.key === period.key ? 'solid' : 'outline'}
                          aria-pressed={p.key === period.key}
                          title={p.hours}
                          onClick={() => {
                            savedTrips.setPeriod(trip.id, p.key)
                          }}
                        >
                          {p.label}
                        </Button>
                      ))}
                    </HStack>
                    <Text fontSize="xs" color="fg.muted" mt={1.5}>
                      {period.hours}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb={1.5}>
                      Transport modes
                    </Text>
                    <ModePicker
                      hideWalk
                      value={trip.modes}
                      onChange={(m) => {
                        savedTrips.setModes(trip.id, m)
                      }}
                    />
                  </Box>
                  <Box>
                    <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb={1.5}>
                      Longest walk at the end
                    </Text>
                    <HStack gap={1.5} wrap="wrap">
                      {END_WALK_OPTIONS.map((n) => (
                        <Button
                          key={n}
                          size="xs"
                          borderRadius="full"
                          colorPalette="teal"
                          variant={n === maxEndWalk ? 'solid' : 'outline'}
                          aria-pressed={n === maxEndWalk}
                          onClick={() => {
                            savedTrips.setEndWalk(trip.id, n)
                          }}
                        >
                          {n === 0 ? 'None' : `${n} min`}
                        </Button>
                      ))}
                    </HStack>
                  </Box>
                  <HStack gap={2}>
                    <Button
                      size="xs"
                      variant="outline"
                      borderRadius="full"
                      onClick={() => {
                        savedTrips.reverse(trip.id)
                      }}
                    >
                      <LuArrowUpDown /> Reverse
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      colorPalette="red"
                      borderRadius="full"
                      onClick={() => {
                        setConfirmRemove(true)
                        setEditing(false)
                      }}
                    >
                      <LuTrash2 /> Remove
                    </Button>
                  </HStack>
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button>Done</Button>
                </Dialog.ActionTrigger>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
      <ConfirmDialog
        open={confirmRemove}
        title={`Remove ${trip.fromName.split(',')[0]} → ${trip.toName.split(',')[0]}?`}
        does="Removes this saved trip from your home screen."
        doesNot="Doesn't affect your other saved trips or the trip you're currently following. You can save it again any time from Plan."
        confirmLabel="Remove"
        onConfirm={() => savedTrips.remove(trip.id)}
        onClose={() => setConfirmRemove(false)}
      />
    </>
  )
}

function SortableTrip({ trip, now, compact, sortable }: { trip: SavedTrip; now: number; compact: boolean; sortable: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: trip.id })
  return (
    <Box
      ref={setNodeRef}
      position="relative"
      zIndex={isDragging ? 1 : undefined}
      opacity={isDragging ? 0.9 : 1}
      shadow={isDragging ? 'lg' : undefined}
      borderRadius="2xl"
      style={{ transform: CSS.Transform.toString(transform && { ...transform, x: 0 }), transition }}
    >
      <SavedTripCard
        trip={trip}
        now={now}
        compact={compact}
        handle={
          sortable && (
            <IconButton
              ref={setActivatorNodeRef}
              aria-label="Drag to reorder"
              data-no-swipe
              variant="ghost"
              size="sm"
              ms={-2}
              color="fg.muted"
              cursor="grab"
              touchAction="none"
              {...attributes}
              {...listeners}
            >
              <LuGripVertical />
            </IconButton>
          )
        }
      />
    </Box>
  )
}

/** Trip history first, then searches, minus anything already saved. */
function PreviousTrips({ limit, saved }: { limit: number; saved: SavedTrip[] }) {
  const tripHistory = useTripHistory()
  const searches = useSearchHistory()
  const savedKeys = new Set(saved.map(routeKey))
  const items = dedupeRoutes([...tripHistory, ...searches])
    .filter((e) => !savedKeys.has(routeKey(e)))
    .slice(0, limit)
  if (items.length === 0) return null

  return (
    <Stack gap={2} mt={2}>
      <Text fontSize="lg" fontWeight="bold" px={1} lineHeight="short">
        Previous trips
      </Text>
      {items.map((e) => (
        <SwipeToRemove key={routeKey(e)} onRemove={() => history.removeRoute(e)}>
          <Flex align="center" gap={2} bg="bg.panel" borderRadius="2xl" borderWidth="1px" shadow="xs" p={3} ps={4}>
            <Box asChild flex={1} minW={0}>
              <Link to={tripPath({ ...e, modes: [] })}>
                <Flex align="center" gap={2} fontWeight="semibold">
                  <Text truncate>{e.fromName.split(',')[0]}</Text>
                  <LuArrowRight style={{ flexShrink: 0 }} />
                  <Text truncate>{e.toName.split(',')[0]}</Text>
                </Flex>
              </Link>
            </Box>
            <SaveTripChip route={{ fromId: e.fromId, fromName: e.fromName, toId: e.toId, toName: e.toName, modes: [] }} />
          </Flex>
        </SwipeToRemove>
      ))}
    </Stack>
  )
}

export function Home() {
  const trips = useSavedTrips()
  const current = useCurrentTrip()
  const now = useNow(1000)
  const { expandUpTo } = useSettings()
  const period = periodAt(now)
  const active = trips.filter((t) => period && t.period && t.period !== 'all' && t.period === period)
  const rest = trips.filter((t) => !active.includes(t))
  // The grip handle starts a drag after a small move, so taps and page scrolling elsewhere are unaffected.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) savedTrips.reorder(String(active.id), String(over.id))
  }

  return (
    <>
      <PageHeader
        title="NextStop"
        subtitle="Plan your trips"
        action={
          <>
            {current && <RefreshButton />}
            <Image src="/logo-mark.svg" alt="" h="34px" />
          </>
        }
      />
      <Stack gap={3} p={4} pt={6}>
        {current && <CurrentTripCard trip={current} now={now} />}
        <WeekendNotice trips={trips} now={now} />
        {trips.length === 0 && current ? (
          <>
            <Box borderWidth="2px" borderStyle="dashed" borderRadius="2xl" mt={2}>
              <EmptyState
                icon={LuBookmarkPlus}
                title="No saved trips yet"
                action={
                  <Button asChild colorPalette="teal" borderRadius="xl">
                    <Link to="/plan">
                      <LuSearch /> Plan a trip
                    </Link>
                  </Button>
                }
              >
                Search a trip, then tap Save to Home to keep it here with live departures.
              </EmptyState>
            </Box>
            <PreviousTrips limit={4} saved={trips} />
          </>
        ) : trips.length === 0 ? (
          <>
            <Stack align="center" textAlign="center" py={16} gap={3}>
              <Image src="/logo.svg" alt="" boxSize="72px" />
              <Text fontSize="xl" fontWeight="bold">
                Save your first trip
              </Text>
              <Text color="fg.muted" maxW="300px">
                Your everyday trips, live at a glance.
              </Text>
              <Button mt="4" asChild colorPalette="teal" size="lg" borderRadius="xl">
                <Link to="/plan">
                  <LuSearch /> Plan a trip
                </Link>
              </Button>
            </Stack>
            <PreviousTrips limit={4} saved={trips} />
          </>
        ) : (
          <>
            <Flex align="flex-start" justify="space-between" gap={3} px={1} mb={3}>
              <Box minW={0}>
                <Text fontSize="lg" fontWeight="bold" lineHeight="short">
                  Saved trips
                </Text>
                {/* Quiet, and wraps only between phrases, so a small phone never strands a single word on its own line. */}
                <Text fontSize="xs" color="fg.subtle" mt={0.5}>
                  {(trips.length > 1
                    ? ['Tap for live times', 'drag to sort', 'swipe to remove']
                    : ['Tap for live times', 'swipe to remove']
                  ).map((phrase, i, all) => (
                    <Fragment key={phrase}>
                      <Box as="span" whiteSpace="nowrap">
                        {phrase}
                        {i < all.length - 1 && ' ·'}
                      </Box>{' '}
                    </Fragment>
                  ))}
                </Text>
              </Box>
              <Button asChild size="sm" variant="subtle" colorPalette="teal" borderRadius="full" flexShrink={0}>
                <Link to="/plan">
                  <LuSearch /> Plan
                </Link>
              </Button>
            </Flex>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              {active.length > 0 && (
                <>
                  <Flex align="center" gap={2} px={1} color="teal.fg">
                    <Box boxSize="8px" borderRadius="full" bg="teal.solid" aria-hidden />
                    <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
                      Active now
                    </Text>
                  </Flex>
                  <SortableContext items={active.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {active.map((t) => (
                      <SortableTrip key={t.id} trip={t} now={now} compact={false} sortable={trips.length > 1} />
                    ))}
                  </SortableContext>
                  <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider" color="fg.muted" px={1} mt={2}>
                    Other trips
                  </Text>
                </>
              )}
              <SortableContext items={rest.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {rest.map((t, i) => (
                  <SortableTrip
                    key={t.id}
                    trip={t}
                    now={now}
                    compact={!!current || active.length > 0 || i >= expandUpTo}
                    sortable={trips.length > 1}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {trips.length === 1 && <PreviousTrips limit={3} saved={trips} />}
          </>
        )}
      </Stack>
    </>
  )
}
