import { Box, Stack, Text } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import type { Place } from '../api/types'
import { LiveTabs } from '../components/LiveTabs'
import { PageHeader } from '../components/PageHeader'
import { StopSearch } from '../components/StopSearch'
import { useSavedTrips } from '../store/savedTrips'

export default function Departures() {
  const navigate = useNavigate()
  const trips = useSavedTrips()
  const open = (id: string, name: string) => navigate(`/station/${encodeURIComponent(id)}?n=${encodeURIComponent(name)}`)

  const recent = new Map<string, string>()
  for (const t of trips) {
    recent.set(t.fromId, t.fromName)
    recent.set(t.toId, t.toName)
  }

  return (
    <>
      <PageHeader title="Live" subtitle="Departures and alerts">
        <LiveTabs />
      </PageHeader>
      <Stack gap={4} p={4}>
        <StopSearch label="Search a station or stop" onChange={(p?: Place) => p && open(p.id, p.name)} />
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
      </Stack>
    </>
  )
}
