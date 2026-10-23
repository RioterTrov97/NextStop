import { Box, Button, Flex, HStack, IconButton, Image, Skeleton, Stack, Text, VStack } from '@chakra-ui/react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, type ReactNode } from 'react'
import { LuGripVertical, LuPlus, LuTrash2 } from 'react-icons/lu'
import { Link, useNavigate } from 'react-router-dom'
import { useTrips } from '../api/hooks'
import { DelayBadge } from '../components/DelayBadge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CurrentTripCard } from '../components/CurrentTripCard'
import { LineBadge } from '../components/LineBadge'
import { PageHeader } from '../components/PageHeader'
import { RefreshButton } from '../components/RefreshButton'
import { useNow } from '../lib/hooks'
import { summarize, journeyComparator } from '../lib/journey'
import { exclusionParams, MODES } from '../lib/lines'
import { tripPath } from '../lib/paths'
import { countdown, formatTime } from '../lib/time'
import { useCurrentTrip } from '../store/currentTrip'
import { savedTrips, useSavedTrips, type SavedTrip } from '../store/savedTrips'
import { useSettings } from '../store/settings'

function Upcoming({ trip, now }: { trip: SavedTrip; now: number }) {
  const navigate = useNavigate()
  // Same query key as the trip results page, so opening a trip reuses this data.
  const { data, isLoading, error, fetchStatus } = useTrips({
    from: trip.fromId,
    to: trip.toId,
    mode: 'dep',
    excluded: exclusionParams(trip.modes),
  })
  const upcoming = (data ?? [])
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
        const cls = s.firstTransit?.transportation
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
            <Text w="88px" fontWeight="bold" textAlign="start" fontVariantNumeric="tabular-nums">
              {formatTime(dep)}
            </Text>
            <LineBadge number={cls?.number ?? cls?.disassembledName} cls={cls?.product?.class} size="sm" />
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

  return (
    <Box bg="bg.panel" borderRadius="2xl" borderWidth="1px" overflow="hidden">
      <Flex align="center" p={4} pb={compact ? 4 : 2} gap={2}>
        {handle}
        <Box asChild flex={1} minW={0}>
          <Link to={tripPath(trip)}>
            <Text fontWeight="bold" truncate>
              {trip.fromName.split(',')[0]}
            </Text>
            <Text fontSize="sm" color="fg.muted" truncate>
              to {trip.toName.split(',')[0]}
              {trip.modes.length > 0 &&
                ` · ${MODES.filter((m) => trip.modes.includes(m.key))
                  .map((m) => m.label)
                  .join(', ')}`}
            </Text>
          </Link>
        </Box>
        <IconButton aria-label="Remove saved trip" variant="ghost" size="sm" colorPalette="red" onClick={() => setConfirmRemove(true)}>
          <LuTrash2 />
        </IconButton>
      </Flex>
      <ConfirmDialog
        open={confirmRemove}
        title={`Remove ${trip.fromName.split(',')[0]} → ${trip.toName.split(',')[0]}?`}
        does="Removes this saved trip from your home screen."
        doesNot="Doesn't affect your other saved trips or the trip you're currently following. You can save it again any time from Plan."
        confirmLabel="Remove"
        onConfirm={() => savedTrips.remove(trip.id)}
        onClose={() => setConfirmRemove(false)}
      />
      {!compact && <Upcoming trip={trip} now={now} />}
    </Box>
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
            <Image src="/logo.svg" alt="" boxSize="40px" borderRadius="lg" />
          </>
        }
      />
      <Stack gap={3} p={4}>
        {current && <CurrentTripCard trip={current} now={now} />}
        {trips.length === 0 ? (
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
        ) : (
          <>
            <Box>
              <Text fontSize="lg" fontWeight="bold">
                Saved trips
              </Text>
              <Text fontSize="sm" color="fg.muted">
                Tap a trip for live times{trips.length > 1 ? '. Drag the handle to reorder.' : '.'}
              </Text>
            </Box>
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
            <HStack justify="center" pt={2}>
              <Button asChild variant="subtle" colorPalette="teal" borderRadius="xl">
                <Link to="/plan">
                  <LuPlus /> Add trip
                </Link>
              </Button>
            </HStack>
          </>
        )}
      </Stack>
    </>
  )
}
