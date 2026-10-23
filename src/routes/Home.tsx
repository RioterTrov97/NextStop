import { Box, Button, Flex, HStack, IconButton, Image, Skeleton, Stack, Text } from '@chakra-ui/react'
import { LuArrowLeftRight, LuPlus, LuTrash2 } from 'react-icons/lu'
import { Link, useNavigate } from 'react-router-dom'
import { useTrips } from '../api/hooks'
import { DelayBadge } from '../components/DelayBadge'
import { LineBadge } from '../components/LineBadge'
import { PageHeader } from '../components/PageHeader'
import { useNow } from '../lib/hooks'
import { summarize } from '../lib/journey'
import { exclusionParams } from '../lib/lines'
import { tripPath } from '../lib/paths'
import { countdown, formatTime } from '../lib/time'
import { savedTrips, useSavedTrips, type SavedTrip } from '../store/savedTrips'

function SavedTripCard({ trip, now }: { trip: SavedTrip; now: number }) {
  const navigate = useNavigate()
  const { data, isLoading, error } = useTrips({
    from: trip.fromId,
    to: trip.toId,
    mode: 'dep',
    excluded: exclusionParams(trip.modes),
    count: 3,
  })
  const upcoming = (data ?? []).filter((j) => {
    const s = summarize(j)
    return new Date(s.depEstimated ?? s.depPlanned ?? 0).getTime() > now - 60_000
  })

  return (
    <Box bg="bg.panel" borderRadius="2xl" borderWidth="1px" overflow="hidden">
      <Flex align="center" p={4} pb={2} gap={2}>
        <Box asChild flex={1} minW={0}>
          <Link to={tripPath(trip)}>
            <Text fontWeight="bold" truncate>{trip.fromName.split(',')[0]}</Text>
            <Text fontSize="sm" color="fg.muted" truncate>to {trip.toName.split(',')[0]}</Text>
          </Link>
        </Box>
        <IconButton aria-label="Reverse trip" variant="ghost" size="sm" onClick={() => savedTrips.reverse(trip.id)}>
          <LuArrowLeftRight />
        </IconButton>
        <IconButton aria-label="Remove saved trip" variant="ghost" size="sm" colorPalette="red" onClick={() => savedTrips.remove(trip.id)}>
          <LuTrash2 />
        </IconButton>
      </Flex>
      <Stack gap={0} px={2} pb={2}>
        {isLoading && <Skeleton h="44px" m={2} borderRadius="lg" />}
        {error && !data && <Text px={2} py={2} fontSize="sm" color="red.500">{(error as Error).message}</Text>}
        {data && upcoming.length === 0 && <Text px={2} py={2} fontSize="sm" color="fg.muted">No upcoming services found.</Text>}
        {upcoming.slice(0, 3).map((j, i) => {
          const s = summarize(j)
          const dep = s.depEstimated ?? s.depPlanned
          const cls = s.firstTransit?.transportation
          return (
            <Flex key={i} as="button" align="center" gap={3} px={2} py={2} borderRadius="lg" onClick={() => navigate(tripPath(trip))} _hover={{ bg: 'bg.muted' }}>
              <Text w="72px" fontWeight="bold" textAlign="start" fontVariantNumeric="tabular-nums">{formatTime(dep)}</Text>
              <LineBadge number={cls?.number ?? cls?.disassembledName} cls={cls?.product?.class} size="sm" />
              <Box flex={1} textAlign="start"><DelayBadge planned={s.depPlanned} estimated={s.depEstimated} realtime={s.realtime} /></Box>
              <Text fontWeight="bold" color="teal.500" fontVariantNumeric="tabular-nums">{countdown(dep, now)}</Text>
            </Flex>
          )
        })}
      </Stack>
    </Box>
  )
}

export function Home() {
  const trips = useSavedTrips()
  const now = useNow(1000)

  return (
    <>
      <PageHeader
        title="NextStop"
        subtitle="Your saved trips, live"
        action={<Image src="/logo.svg" alt="" boxSize="40px" borderRadius="lg" />}
      />
      <Stack gap={3} p={4}>
        {trips.length === 0 ? (
          <Stack align="center" textAlign="center" py={16} gap={3}>
            <Image src="/logo.svg" alt="" boxSize="72px" />
            <Text fontSize="xl" fontWeight="bold">Save your first trip</Text>
            <Text color="fg.muted" maxW="260px">Pick where you're going, for example Lidcombe to Wynyard, and it will live here.</Text>
            <Button asChild colorPalette="teal" size="lg" borderRadius="xl">
              <Link to="/plan">Plan a trip</Link>
            </Button>
          </Stack>
        ) : (
          <>
            {trips.map((t) => (
              <SavedTripCard key={t.id} trip={t} now={now} />
            ))}
            <HStack justify="center" pt={2}>
              <Button asChild variant="subtle" colorPalette="teal" borderRadius="xl">
                <Link to="/plan"><LuPlus /> Add trip</Link>
              </Button>
            </HStack>
          </>
        )}
      </Stack>
    </>
  )
}

