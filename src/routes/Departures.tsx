import { Box, Stack, Text } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import type { Place } from '../api/types'
import { LiveTabs } from '../components/LiveTabs'
import { PageHeader } from '../components/PageHeader'
import { StopSearch } from '../components/StopSearch'
import { isStopId } from '../store/places'
import { useSavedTrips } from '../store/savedTrips'
import { PageBody } from '../components/PageBody'

export default function Departures() {
  const navigate = useNavigate()
  const trips = useSavedTrips()
  const open = (id: string, name: string) => navigate(`/station/${encodeURIComponent(id)}?n=${encodeURIComponent(name)}`)

  const recent = new Map<string, string>()
  // Only stations and stops have a departure board; addresses and Home or Work don't.
  for (const t of trips) {
    if (isStopId(t.fromId)) recent.set(t.fromId, t.fromName)
    if (isStopId(t.toId)) recent.set(t.toId, t.toName)
  }

  return (
    <>
      <PageHeader title="Live" subtitle="Departures and alerts">
        <LiveTabs />
      </PageHeader>
      <PageBody gap={6}>
        <StopSearch label="Search a station or stop" stopsOnly onChange={(p?: Place) => p && open(p.id, p.name)} />
        {recent.size > 0 && (
          <Box>
            <Text fontSize="sm" fontWeight="semibold" mb={2}>
              From your saved trips
            </Text>
            <Stack gap={2}>
              {[...recent].map(([id, name]) => (
                <Box
                  key={id}
                  as="button"
                  textAlign="start"
                  bg="bg.panel"
                  borderWidth="1px"
                  borderRadius="xl"
                  px={4}
                  py={3}
                  onClick={() => open(id, name)}
                >
                  {name}
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </PageBody>
    </>
  )
}
