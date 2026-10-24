import { Badge, Box, Button, Flex, HStack, IconButton, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { LuFootprints, LuX } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { useJourneyVehicles, useTrips } from '../api/hooks'
import type { Leg } from '../api/types'
import { isTransit, legOccupancy, platformAt, stationName, summarize, vehicleModeForLeg } from '../lib/journey'
import { lineColor } from '../lib/lines'
import { tripPath } from '../lib/paths'
import { countdown, formatDuration, formatTime } from '../lib/time'
import { currentTrip, tripKey, type CurrentTrip } from '../store/currentTrip'
import { DelayBadge } from './DelayBadge'
import { ConfirmDialog } from './ConfirmDialog'
import { LineBadge } from './LineBadge'
import { MiniTrain } from './MiniTrain'
import { VehicleLoad } from './VehicleLoad'

const EXPIRY_GRACE_MS = 5 * 60_000

interface Action {
  platform?: string
  time?: string
}

type Step = { type: 'stop'; station: string; board?: Action; alight?: Action } | { type: 'ride'; leg: Leg } | { type: 'walk'; leg: Leg }

function buildSteps(legs: Leg[]): Step[] {
  const steps: Step[] = []
  for (const leg of legs) {
    if (!isTransit(leg)) {
      steps.push({ type: 'walk', leg })
      continue
    }
    const station = stationName(leg.origin)
    const board: Action = { platform: platformAt(leg.origin), time: leg.origin.departureTimeEstimated ?? leg.origin.departureTimePlanned }
    const prev = steps[steps.length - 1]
    // An interchange: merge "get off" and "board" into a single station row.
    if (prev?.type === 'stop' && prev.alight && !prev.board && prev.station === station) prev.board = board
    else steps.push({ type: 'stop', station, board })
    steps.push({ type: 'ride', leg })
    steps.push({
      type: 'stop',
      station: stationName(leg.destination),
      alight: { platform: platformAt(leg.destination), time: leg.destination.arrivalTimeEstimated ?? leg.destination.arrivalTimePlanned },
    })
  }
  return steps
}

const isPending = (iso: string | undefined, now: number) => !iso || new Date(iso).getTime() > now

/** Drops everything already behind the user: departed stops, finished rides and walks. */
function pendingSteps(steps: Step[], now: number): Step[] {
  const out: Step[] = []
  for (const st of steps) {
    if (st.type === 'stop') {
      const board = st.board && isPending(st.board.time, now) ? st.board : undefined
      const alight = st.alight && isPending(st.alight.time, now) ? st.alight : undefined
      if (board || alight) out.push({ ...st, board, alight })
    } else if (isPending(st.leg.destination.arrivalTimeEstimated ?? st.leg.destination.arrivalTimePlanned, now)) {
      out.push(st)
    }
  }
  return out.length ? out : steps.slice(-1)
}

function ActionRow({ kind, action }: { kind: 'board' | 'alight'; action: Action }) {
  return (
    <Flex justify="space-between" align="center" gap={2}>
      <HStack gap={2}>
        <Badge colorPalette={kind === 'board' ? 'teal' : 'orange'} variant="subtle">
          {kind === 'board' ? 'Board' : 'Get off'}
        </Badge>
        <Text fontSize="sm" fontWeight="semibold" color={action.platform ? undefined : 'fg.muted'}>
          {action.platform ? `Platform ${action.platform}` : 'Platform TBC'}
        </Text>
      </HStack>
      <Text fontWeight="bold" fontVariantNumeric="tabular-nums" whiteSpace="nowrap">
        {formatTime(action.time)}
      </Text>
    </Flex>
  )
}

function StopRow({ step, divider }: { step: Extract<Step, { type: 'stop' }>; divider?: boolean }) {
  return (
    <Flex gap={3} pt={divider ? 2 : 0}>
      <Flex w="20px" justify="center" pt="5px" flexShrink={0}>
        <Box w="14px" h="14px" borderRadius="full" borderWidth="3px" borderColor="teal.500" bg="bg.panel" />
      </Flex>
      <Box flex={1} minW={0} pb={1}>
        <Text fontWeight="bold" truncate>
          {step.station}
        </Text>
        {step.alight && <ActionRow kind="alight" action={step.alight} />}
        {step.alight && step.board && <Box borderTopWidth="1px" borderStyle="dashed" my={2} />}
        {step.board && <ActionRow kind="board" action={step.board} />}
      </Box>
    </Flex>
  )
}

function RideRow({ leg, vehicle }: { leg: Leg; vehicle?: Parameters<typeof MiniTrain>[0]['vehicle'] }) {
  const t = leg.transportation
  const color = lineColor(t?.number, t?.product?.class)
  const mode = vehicleModeForLeg(leg)
  return (
    <Flex gap={3}>
      <Flex w="20px" justify="center" flexShrink={0}>
        <Box w="4px" borderRadius="full" style={{ background: color }} />
      </Flex>
      <Flex flex={1} minW={0} py={2} align="center" gap={2} wrap="wrap">
        <LineBadge number={t?.number ?? t?.disassembledName} cls={t?.product?.class} />
        <Text fontSize="sm" color="fg.muted" flex={1} minW={0} truncate>
          {t?.destination?.name ? `to ${t.destination.name.split(',')[0]}` : formatDuration(leg.duration ?? 0)}
        </Text>
        <DelayBadge
          planned={leg.origin.departureTimePlanned}
          estimated={leg.origin.departureTimeEstimated}
          realtime={leg.isRealtimeControlled}
        />
        {mode === 'train' && <MiniTrain vehicle={vehicle} fallback={legOccupancy(leg)} />}
        {(mode === 'bus' || mode === 'lightrail' || mode === 'metro') && (
          <VehicleLoad mode={mode} vehicle={vehicle} fallback={legOccupancy(leg)} />
        )}
      </Flex>
    </Flex>
  )
}

function WalkRow({ leg }: { leg: Leg }) {
  return (
    <Flex gap={3}>
      <Flex w="20px" justify="center" flexShrink={0}>
        <Box borderLeftWidth="3px" borderStyle="dotted" borderColor="fg.muted" />
      </Flex>
      <HStack py={2} fontSize="sm" color="fg.muted">
        <LuFootprints />
        <Text>Walk {formatDuration(leg.duration ?? 0)}</Text>
      </HStack>
    </Flex>
  )
}

export function CurrentTripCard({ trip, now }: { trip: CurrentTrip; now: number }) {
  const [confirmClear, setConfirmClear] = useState(false)
  const planned = summarize(trip.journey).depPlanned
  const { data } = useTrips({
    from: trip.fromId,
    to: trip.toId,
    mode: 'dep',
    when: planned ? new Date(new Date(planned).getTime() - 60_000) : undefined,
    excluded: {},
    count: 4,
  })
  // Prefer the live version of the same trip so delays and platforms stay current.
  const journey = data?.find((j) => tripKey(j) === tripKey(trip.journey)) ?? trip.journey
  const { vehicles } = useJourneyVehicles([journey])

  const s = summarize(journey)
  const dep = s.depEstimated ?? s.depPlanned
  const arr = s.arrEstimated ?? s.arrPlanned
  const expired = !!arr && new Date(arr).getTime() + EXPIRY_GRACE_MS < now

  useEffect(() => {
    if (expired) currentTrip.clear()
  }, [expired])

  if (expired) return null

  const steps = pendingSteps(buildSteps(journey.legs), now)

  return (
    <Box bg="bg.panel" borderRadius="2xl" borderWidth="2px" borderColor="teal.500" p={4}>
      <Flex align="center" justify="space-between" mb={1}>
        <Text fontSize="xs" fontWeight="bold" letterSpacing="wider" color="teal.500">
          CURRENT TRIP
        </Text>
        <IconButton aria-label="Clear current trip" size="xs" variant="ghost" onClick={() => setConfirmClear(true)}>
          <LuX />
        </IconButton>
      </Flex>
      <ConfirmDialog
        open={confirmClear}
        title="Stop following this trip?"
        does="Removes it from the top of your home screen, along with its live platforms and carriage loads."
        doesNot="Doesn't delete any saved trips or cancel anything. You can follow it again from the trip details while it's still running."
        confirmLabel="Stop following"
        onConfirm={() => currentTrip.clear()}
        onClose={() => setConfirmClear(false)}
      />

      <Flex justify="space-between" align="center" gap={2} fontSize="sm" color="fg.muted">
        <Text truncate fontWeight="medium">
          {trip.fromName.split(',')[0]} → {trip.toName.split(',')[0]}
        </Text>
        <Text flexShrink={0}>{formatDuration(s.durationSec)}</Text>
      </Flex>
      <Flex justify="space-between" align="center" gap={2} mt={1.5} mb={3}>
        <Text fontSize="2xl" fontWeight="bold" whiteSpace="nowrap">
          {formatTime(dep)}{' '}
          <Text as="span" color="fg.muted" fontWeight="normal">
            →
          </Text>{' '}
          {formatTime(arr)}
        </Text>
        <Text fontSize="2xl" fontWeight="bold" color="teal.500" fontVariantNumeric="tabular-nums" whiteSpace="nowrap">
          {countdown(dep, now)}
        </Text>
      </Flex>

      <Box>
        {steps.map((st, i) =>
          st.type === 'stop' ? (
            <Box key={i}>
              {i > 0 && st.board && !st.alight && <Box borderTopWidth="1px" borderStyle="dashed" ml="32px" mt={2} />}
              <StopRow step={st} divider={i > 0 && !!st.board && !st.alight} />
            </Box>
          ) : st.type === 'ride' ? (
            <RideRow key={i} leg={st.leg} vehicle={vehicles.get(st.leg.transportation?.properties?.RealtimeTripId ?? '')} />
          ) : (
            <WalkRow key={i} leg={st.leg} />
          ),
        )}
      </Box>

      <Button asChild size="xs" variant="ghost" colorPalette="teal" mt={2}>
        <Link to={tripPath({ fromId: trip.fromId, toId: trip.toId, fromName: trip.fromName, toName: trip.toName, modes: [] })}>
          See other trips
        </Link>
      </Button>
    </Box>
  )
}
