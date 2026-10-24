import { Box, Button, Flex, IconButton, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuArrowRight, LuBookmark, LuBookmarkCheck, LuChevronDown, LuChevronUp } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { LineBadge } from '../components/LineBadge'
import { WalkBadge } from '../components/WalkBadge'
import { SwipeToRemove } from '../components/SwipeToRemove'
import { PageHeader } from '../components/PageHeader'
import { isTransit, stationName, summarize } from '../lib/journey'
import { tripPath } from '../lib/paths'
import { formatDuration, formatTime } from '../lib/time'
import { history, routeKey, tripEntryKey, useSearchHistory, useTripHistory, type HistoryEntry } from '../store/history'
import { savedTrips, useSavedTrips } from '../store/savedTrips'

const dayLabel = (at?: number) =>
  at ? new Date(at).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : undefined

function TripDetails({ entry }: { entry: HistoryEntry }) {
  const journey = entry.journey!
  return (
    <Stack gap={2} px={4} pb={4} pt={1} borderTopWidth="1px" borderColor="border.muted">
      {journey.legs.map((l, i) => {
        const transit = isTransit(l)
        const dep = l.origin.departureTimeEstimated ?? l.origin.departureTimePlanned
        const arr = l.destination.arrivalTimeEstimated ?? l.destination.arrivalTimePlanned
        return (
          <Flex key={i} align="center" gap={3} pt={2}>
            <Box w="48px" flexShrink={0}>
              {transit ? (
                <LineBadge
                  number={l.transportation?.number ?? l.transportation?.disassembledName}
                  cls={l.transportation?.product?.class}
                  size="sm"
                />
              ) : (
                <WalkBadge seconds={l.duration ?? 0} meters={l.distance} size="sm" />
              )}
            </Box>
            <Box flex={1} minW={0} fontSize="sm">
              <Text truncate fontWeight="medium">
                {transit ? `${stationName(l.origin)} to ${stationName(l.destination)}` : `Walk to ${stationName(l.destination)}`}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                {formatTime(dep)} to {formatTime(arr)}
                {transit && ` · ${formatDuration(l.duration ?? 0)}`}
              </Text>
            </Box>
          </Flex>
        )
      })}
      <Button asChild size="xs" variant="subtle" colorPalette="teal" alignSelf="flex-start" mt={1}>
        <Link to={tripPath({ ...entry, modes: [] })}>See live times for this route</Link>
      </Button>
    </Stack>
  )
}

function RouteList({
  items,
  saved,
  empty,
  onRemove,
}: {
  items: HistoryEntry[]
  saved: Set<string>
  empty: string
  onRemove: (e: HistoryEntry) => void
}) {
  const [open, setOpen] = useState<string>()
  if (items.length === 0) {
    return (
      <Text color="fg.muted" fontSize="sm" textAlign="center" py={10}>
        {empty}
      </Text>
    )
  }
  return (
    <Stack gap={2}>
      {items.map((e) => {
        const isSaved = saved.has(routeKey(e))
        const k = tripEntryKey(e)
        const expandable = !!e.journey
        const expanded = expandable && open === k
        const s = e.journey ? summarize(e.journey) : undefined
        const title = (
          <Box minW={0} textAlign="start">
            <Flex align="center" gap={2} fontWeight="semibold">
              <Text truncate>{e.fromName.split(',')[0]}</Text>
              <LuArrowRight style={{ flexShrink: 0 }} />
              <Text truncate>{e.toName.split(',')[0]}</Text>
            </Flex>
            {s && (
              <Text fontSize="xs" color="fg.muted">
                {dayLabel(e.at)} · {formatTime(s.depEstimated ?? s.depPlanned)} to {formatTime(s.arrEstimated ?? s.arrPlanned)} ·{' '}
                {formatDuration(s.durationSec)}
              </Text>
            )}
          </Box>
        )
        return (
          <SwipeToRemove key={k} onRemove={() => onRemove(e)}>
            <Box bg="bg.panel" borderRadius="2xl" borderWidth="1px">
              <Flex align="center" gap={2} p={3} ps={4}>
                {expandable ? (
                  <Box
                    as="button"
                    flex={1}
                    minW={0}
                    aria-expanded={expanded}
                    display="flex"
                    alignItems="center"
                    gap={2}
                    onClick={() => setOpen(expanded ? undefined : k)}
                  >
                    {title}
                    <Box ms="auto" color="fg.subtle" flexShrink={0}>
                      {expanded ? <LuChevronUp /> : <LuChevronDown />}
                    </Box>
                  </Box>
                ) : (
                  <Box asChild flex={1} minW={0}>
                    <Link to={tripPath({ ...e, modes: [] })}>{title}</Link>
                  </Box>
                )}
                <IconButton
                  aria-label={isSaved ? 'Saved' : 'Save trip'}
                  variant="ghost"
                  size="sm"
                  color={isSaved ? 'teal.fg' : 'fg.muted'}
                  disabled={isSaved}
                  onClick={() => savedTrips.add({ fromId: e.fromId, fromName: e.fromName, toId: e.toId, toName: e.toName, modes: [] })}
                >
                  {isSaved ? <LuBookmarkCheck /> : <LuBookmark />}
                </IconButton>
              </Flex>
              {expanded && <TripDetails entry={e} />}
            </Box>
          </SwipeToRemove>
        )
      })}
    </Stack>
  )
}

export default function History() {
  const trips = useTripHistory()
  const searches = useSearchHistory()
  const saved = new Set(useSavedTrips().map(routeKey))
  const [tab, setTab] = useState<'trips' | 'searches'>('trips')

  return (
    <>
      <PageHeader title="History" subtitle="Trips you followed and routes you searched">
        <Flex mt={3} p="3px" bg="blackAlpha.300" borderRadius="full" role="tablist">
          {(
            [
              ['trips', 'Trips'],
              ['searches', 'Searches'],
            ] as const
          ).map(([k, label]) => (
            <Box
              key={k}
              as="button"
              role="tab"
              aria-selected={tab === k}
              flex={1}
              py={1.5}
              borderRadius="full"
              fontSize="sm"
              fontWeight="semibold"
              bg={tab === k ? 'white' : 'transparent'}
              color={tab === k ? 'teal.700' : 'whiteAlpha.900'}
              cursor="pointer"
              onClick={() => setTab(k)}
            >
              {label}
            </Box>
          ))}
        </Flex>
      </PageHeader>
      <Stack gap={5} p={4} pt={6}>
        {tab === 'trips' ? (
          <RouteList
            items={trips}
            saved={saved}
            onRemove={history.removeTrip}
            empty="No followed trips yet. Follow a trip from its details and it shows up here."
          />
        ) : (
          <RouteList items={searches} saved={saved} onRemove={history.removeSearch} empty="No searches yet." />
        )}
      </Stack>
    </>
  )
}
