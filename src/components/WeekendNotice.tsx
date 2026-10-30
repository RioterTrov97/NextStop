import { Box, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useQueries } from '@tanstack/react-query'
import { useState } from 'react'
import { LuBus, LuChevronDown } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { fetchAlerts, fetchTripsDirect } from '../api/client'
import type { Alert, Journey } from '../api/types'
import { exclusionParams } from '../lib/lines'
import { tripPath } from '../lib/paths'
import { formatDuration } from '../lib/time'
import { checkTime, dayImpact, matchingAlerts, sydneyTime, upcomingWeekend, type DayImpact } from '../lib/weekend'
import { useSettings } from '../store/settings'
import type { SavedTrip } from '../store/savedTrips'
import { AlertCard, toAlertProps } from './AlertCard'
import { PlatformPill } from './PlatformPill'

const DISMISSED_KEY = 'nextstop.weekendNotice.v1'
/** Each saved trip costs one planner request per weekend day, so only the first few are checked. */
const MAX_TRIPS = 6
const PLAN_STALE_MS = 3 * 3600_000

const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) ?? ''
  } catch {
    return ''
  }
}

/** "between Hornsby and Gosford on bus 21CN from Stand X1" for each replacement leg. */
function LegsLine({ impact }: { impact: DayImpact }) {
  return (
    <Stack gap={1}>
      {impact.legs.map((l, i) => (
        <Flex key={i} align="center" gap={1.5} wrap="wrap" fontSize="sm">
          <Text>
            Bus{l.line ? ` ${l.line}` : ''} from {l.from} to {l.to}
          </Text>
          {l.stand && <PlatformPill info={l.stand} />}
        </Flex>
      ))}
    </Stack>
  )
}

interface TripImpact {
  trip: SavedTrip
  impacts: DayImpact[]
  alerts: Alert[]
}

function TripNotice({ item }: { item: TripImpact }) {
  const [open, setOpen] = useState(false)
  const { trip, impacts, alerts } = item
  // Same buses both days: say it once.
  const sameBothDays =
    impacts.length === 2 &&
    JSON.stringify(impacts[0].legs.map((l) => [l.from, l.to])) === JSON.stringify(impacts[1].legs.map((l) => [l.from, l.to]))
  const groups = sameBothDays
    ? [{ label: 'Saturday and Sunday', impact: impacts[0] }]
    : impacts.map((i) => ({ label: i.day.label, impact: i }))
  const first = impacts[0]
  const plannedAt = first.journey.legs[0]?.origin.departureTimePlanned

  return (
    <Box borderTopWidth="1px" borderColor="orange.muted" pt={3}>
      <Text fontWeight="semibold">
        {trip.fromName.split(',')[0]} to {trip.toName.split(',')[0]}
      </Text>
      <Stack gap={2} mt={1}>
        {groups.map(({ label, impact }) => (
          <Box key={label}>
            <Text fontSize="sm" color="fg.muted">
              {label}: {impact.unavoidable ? 'buses replace trains' : 'some trips use replacement buses'}, about{' '}
              {formatDuration(impact.durationSec)} door to door.
            </Text>
            <LegsLine impact={impact} />
          </Box>
        ))}
      </Stack>
      <HStack mt={2} gap={2}>
        <Button asChild size="xs" colorPalette="orange" borderRadius="full">
          <Link to={tripPath(trip, plannedAt ? { w: plannedAt, m: 'dep' } : {})}>Plan {first.day.label}'s trip</Link>
        </Button>
        {alerts.length > 0 && (
          <Button size="xs" variant="ghost" borderRadius="full" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            Details <LuChevronDown style={{ transform: open ? 'rotate(180deg)' : undefined }} />
          </Button>
        )}
      </HStack>
      {open && (
        <Stack gap={2} mt={2}>
          {alerts.map((a) => (
            <AlertCard key={a.id} {...toAlertProps(a)} />
          ))}
        </Stack>
      )}
    </Box>
  )
}

/**
 * A one-off heads-up on Home, from Thursday to Sunday, when any saved trip needs replacement buses that weekend.
 * Each trip is planned for Saturday and Sunday at its usual time of day; dismissing hides it until the next weekend.
 */
export function WeekendNotice({ trips, now }: { trips: SavedTrip[]; now: number }) {
  const { walkPace } = useSettings()
  const [dismissed, setDismissed] = useState(readDismissed)
  const weekend = upcomingWeekend(now)
  const checked = trips.slice(0, MAX_TRIPS)
  const pairs = weekend ? checked.flatMap((trip) => weekend.days.map((day) => ({ trip, day }))) : []
  const active = !!weekend && dismissed !== weekend.key

  const plans = useQueries({
    queries: pairs.map(({ trip, day }) => {
      // The key leaves the exact time out: a check for "later today" would otherwise refetch every second.
      const at = checkTime(trip, day, now)
      return {
        queryKey: ['weekend', trip.fromId, trip.toId, trip.modes, day.ymd, trip.period ?? 'all', walkPace] as const,
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          fetchTripsDirect(
            { from: trip.fromId, to: trip.toId, mode: 'dep', when: at, excluded: exclusionParams(trip.modes), count: 3, walkPace },
            signal,
          ),
        enabled: active,
        staleTime: PLAN_STALE_MS,
      }
    }),
  })
  const alertDays = weekend?.days ?? []
  const alerts = useQueries({
    queries: alertDays.map((day) => ({
      queryKey: ['alerts', day.ymd] as const,
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchAlerts(signal, sydneyTime(day.ymd, 12, 0)),
      enabled: active,
      staleTime: 30 * 60_000,
    })),
  })

  if (!active) return null

  const items: TripImpact[] = []
  for (const trip of checked) {
    const impacts: DayImpact[] = []
    pairs.forEach((p, i) => {
      if (p.trip !== trip) return
      const impact = dayImpact(p.day, (plans[i]?.data as Journey[] | undefined) ?? [])
      if (impact) impacts.push(impact)
    })
    if (!impacts.length) continue
    const seen = new Set<string>()
    const tripAlerts = impacts
      .flatMap((impact) => matchingAlerts((alerts[alertDays.indexOf(impact.day)]?.data as Alert[] | undefined) ?? [], impact))
      .filter((a) => !seen.has(a.id) && !!seen.add(a.id))
    items.push({ trip, impacts, alerts: tripAlerts })
  }
  if (!items.length) return null

  return (
    <Box
      role="region"
      aria-label="Weekend trackwork"
      bg="orange.subtle"
      borderWidth="1px"
      borderColor="orange.muted"
      borderRadius="2xl"
      p={4}
    >
      <HStack gap={2} color="orange.fg">
        <LuBus />
        <Text fontWeight="bold">Replacement buses this weekend</Text>
      </HStack>
      <Text fontSize="sm" color="fg.muted" mt={1} mb={3}>
        Trackwork changes {items.length === 1 ? 'one of your saved trips' : `${items.length} of your saved trips`}. Allow extra time.
      </Text>
      <Stack gap={3}>
        {items.map((item) => (
          <TripNotice key={item.trip.id} item={item} />
        ))}
      </Stack>
      <Button
        size="sm"
        variant="outline"
        colorPalette="orange"
        borderRadius="full"
        mt={4}
        onClick={() => {
          if (!weekend) return
          localStorage.setItem(DISMISSED_KEY, weekend.key)
          setDismissed(weekend.key)
        }}
      >
        Got it
      </Button>
    </Box>
  )
}
