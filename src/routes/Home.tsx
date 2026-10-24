import { Box, Button, Flex, HStack, IconButton, Image, Skeleton, Stack, Text, VStack } from '@chakra-ui/react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, type ReactNode } from 'react'
import { LuArrowRight, LuBookmark, LuBookmarkPlus, LuGripVertical, LuChevronRight, LuPlus } from 'react-icons/lu'
import { Link, useNavigate } from 'react-router-dom'
import { useTrips } from '../api/hooks'
import { EmptyState } from '../components/EmptyState'
import { DelayBadge } from '../components/DelayBadge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CurrentTripCard } from '../components/CurrentTripCard'
import { LineBadge } from '../components/LineBadge'
import { PageHeader } from '../components/PageHeader'
import { WalkBadge } from '../components/WalkBadge'
import { RefreshButton } from '../components/RefreshButton'
import { useNow } from '../lib/hooks'
import { summarize, journeyComparator, trailingWalk } from '../lib/journey'
import { exclusionParams, MODES } from '../lib/lines'
import { tripPath } from '../lib/paths'
import { countdown, formatTime } from '../lib/time'
import { useCurrentTrip } from '../store/currentTrip'
import { SwipeToRemove } from '../components/SwipeToRemove'
import { dedupeRoutes, history, routeKey, useSearchHistory, useTripHistory } from '../store/history'
import { savedTrips, useSavedTrips, type SavedTrip } from '../store/savedTrips'
import { useSettings } from '../store/settings'

function Upcoming({ trip, now }: { trip: SavedTrip; now: number }) {
  const navigate = useNavigate()
  const { maxEndWalk } = useSettings()
  // Same query key as the trip results page, so opening a trip reuses this data.
  const { data, isLoading, error, fetchStatus } = useTrips({
    from: trip.fromId,
    to: trip.toId,
    mode: 'dep',
    excluded: exclusionParams(trip.modes),
  })
  const upcoming = (data ?? [])
    .filter((j) => (trailingWalk(j)?.durationSec ?? 0) <= maxEndWalk * 60)
    .filter((j) => {
      const s = summarize(j)
      return new Date(s.depEstimated ?? s.depPlanned ?? 0).getTime() > now - 60_000
    })
    .sort(journeyComparator('dep'))

  return (
    <Stack gap={0} px={2} pb={2}>
      {isLoading && <Skeleton h="44px" m={2} borderRadius="lg" />}
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
      {data && upcoming.length === 0 && (
        <Text px={2} py={2} fontSize="sm" color="fg.muted">
          No upcoming services found.
        </Text>
      )}
      {upcoming.slice(0, 3).map((j, i) => {
        const s = summarize(j)
        const dep = s.depEstimated ?? s.depPlanned
        const arr = s.arrEstimated ?? s.arrPlanned
        const cls = s.firstTransit?.transportation
        const tailWalk = trailingWalk(j)
        return (
          <Flex
            key={i}
            as="button"
            align="center"
            gap={3}
            px={2}
            py={2}
            borderRadius="lg"
            onClick={() => navigate(tripPath(trip))}
            _hover={{ bg: 'bg.muted' }}
          >
            <Box minW="88px" flexShrink={0} textAlign="start" fontVariantNumeric="tabular-nums" whiteSpace="nowrap" lineHeight="short">
              <Text fontWeight="bold">{formatTime(dep)}</Text>
              {arr && (
                <Text color="fg.muted" fontSize="xs">
                  arrives {formatTime(arr)}
                </Text>
              )}
            </Box>
            <HStack gap={1.5} flexShrink={0}>
              <LineBadge number={cls?.number ?? cls?.disassembledName} cls={cls?.product?.class} size="sm" />
              {tailWalk && <WalkBadge seconds={tailWalk.durationSec} size="sm" />}
            </HStack>
            <Box flex={1} textAlign="start">
              <DelayBadge planned={s.depPlanned} estimated={s.depEstimated} realtime={s.realtime} />
            </Box>
            <Text fontWeight="bold" color="teal.500" fontVariantNumeric="tabular-nums">
              {countdown(dep, now)}
            </Text>
          </Flex>
        )
      })}
    </Stack>
  )
}

/** Beyond the user's limit the card is just the route, so a long list doesn't fire a live request per trip. */
function SavedTripCard({ trip, now, compact, handle }: { trip: SavedTrip; now: number; compact: boolean; handle?: ReactNode }) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const modes = MODES.filter((m) => trip.modes.includes(m.key))
    .map((m) => m.label)
    .join(', ')

  return (
    <>
      <SwipeToRemove confirm onRemove={() => setConfirmRemove(true)}>
        <Box bg="bg.panel" borderRadius="2xl" borderWidth="1px" overflow="hidden">
          <Flex align="center" p={4} pb={compact ? 4 : 2} gap={3}>
            {handle}
            <Flex direction="column" align="center" gap="3px" flexShrink={0} aria-hidden>
              <Box boxSize="9px" borderRadius="full" borderWidth="2px" borderColor="teal.solid" />
              <Box w="2px" h="14px" borderRadius="full" bg="border.emphasized" />
              <Box boxSize="9px" borderRadius="full" bg="teal.solid" />
            </Flex>
            <Box asChild flex={1} minW={0}>
              <Link to={tripPath(trip)}>
                <Text fontWeight="bold" truncate>
                  {trip.fromName.split(',')[0]}
                </Text>
                <Text fontWeight="bold" truncate>
                  {trip.toName.split(',')[0]}
                </Text>
                {modes && (
                  <Text fontSize="xs" color="fg.muted" truncate>
                    {modes}
                  </Text>
                )}
              </Link>
            </Box>
            <Box color="fg.subtle" flexShrink={0} aria-hidden>
              <LuChevronRight />
            </Box>
          </Flex>
          {!compact && <Upcoming trip={trip} now={now} />}
        </Box>
      </SwipeToRemove>
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
            <IconButton
              aria-label="Save trip"
              variant="ghost"
              size="sm"
              color="fg.muted"
              onClick={() => savedTrips.add({ fromId: e.fromId, fromName: e.fromName, toId: e.toId, toName: e.toName, modes: [] })}
            >
              <LuBookmark />
            </IconButton>
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
        {trips.length === 0 && current ? (
          <>
            <Box borderWidth="2px" borderStyle="dashed" borderRadius="2xl" mt={2}>
              <EmptyState
                icon={LuBookmarkPlus}
                title="No saved trips yet"
                action={
                  <Button asChild colorPalette="teal" borderRadius="xl">
                    <Link to="/plan">
                      <LuPlus /> Save a trip
                    </Link>
                  </Button>
                }
              >
                Save the trips you take often and see their live departures here, one tap away.
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
              <VStack gap={0} maxW="300px">
                <Text color="fg.muted">Pick where you're going & it'll live here</Text>
                <Text color="fg.muted">For e.g. Lidcombe to Wynyard</Text>
              </VStack>
              <Button mt="4" asChild colorPalette="teal" size="lg" borderRadius="xl">
                <Link to="/plan">Plan a trip</Link>
              </Button>
            </Stack>
            <PreviousTrips limit={4} saved={trips} />
          </>
        ) : (
          <>
            <Flex align="center" justify="space-between" gap={3} px={1} mb={2}>
              <Box minW={0}>
                <Text fontSize="lg" fontWeight="bold" lineHeight="short">
                  Saved trips
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {`Tap for live times${trips.length > 1 ? ' · drag to reorder · swipe to remove' : ' · swipe to remove'}`}
                </Text>
              </Box>
              <Button asChild size="sm" variant="subtle" colorPalette="teal" borderRadius="full" flexShrink={0}>
                <Link to="/plan">
                  <LuPlus /> Add trip
                </Link>
              </Button>
            </Flex>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={trips.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {trips.map((t) => (
                  <SortableTrip
                    key={t.id}
                    trip={t}
                    now={now}
                    compact={!!current || trips.length > expandUpTo}
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
