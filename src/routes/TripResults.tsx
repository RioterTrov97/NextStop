import { Button, IconButton, Skeleton, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuArrowLeftRight, LuBookmark, LuBookmarkCheck } from 'react-icons/lu'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useJourneyVehicles, useTrips } from '../api/hooks'
import { JourneyRow } from '../components/JourneyRow'
import { JourneySheet } from '../components/JourneySheet'
import { PageHeader } from '../components/PageHeader'
import { useNow } from '../lib/hooks'
import { journeyComparator, summarize } from '../lib/journey'
import { exclusionParams } from '../lib/lines'
import { tripPath } from '../lib/paths'
import { savedTrips, tripId, useSavedTrips } from '../store/savedTrips'
import { currentTrip, tripKey, useCurrentTrip } from '../store/currentTrip'

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
  const when = sp.get('w') ? new Date(sp.get('w')!) : undefined
  const mode = sp.get('m') === 'arr' ? 'arr' : 'dep'

  const [count, setCount] = useState(6)
  const [selected, setSelected] = useState<number>()

  const { data, isLoading, error, isFetching, refetch } = useTrips({ from, to, mode, when, excluded: exclusionParams(modes), count })
  const isSaved = saved.some((t) => t.id === tripId(from, to))
  const visible = (data ?? [])
    .filter((j) => {
      if (when) return true
      const s = summarize(j)
      return new Date(s.depEstimated ?? s.depPlanned ?? 0).getTime() > now - 60_000
    })
    .sort(journeyComparator(mode, when))

  const { vehicles, isLoading: vehiclesLoading } = useJourneyVehicles(visible)

  const swap = () => navigate(tripPath({ fromId: to, toId: from, fromName: toName, toName: fromName, modes }), { replace: true })

  return (
    <>
      <PageHeader
        title={fromName.split(',')[0]}
        subtitle={`to ${toName.split(',')[0]}`}
        back
        action={
          <>
            <IconButton aria-label="Swap direction" variant="ghost" color="white" onClick={swap}>
              <LuArrowLeftRight />
            </IconButton>
            <IconButton
              aria-label={isSaved ? 'Remove from saved trips' : 'Save trip'}
              variant="ghost"
              color="white"
              onClick={() =>
                isSaved ? savedTrips.remove(tripId(from, to)) : savedTrips.add({ fromId: from, fromName, toId: to, toName, modes })
              }
            >
              {isSaved ? <LuBookmarkCheck /> : <LuBookmark />}
            </IconButton>
          </>
        }
      />
      <Stack gap={3} p={4}>
        {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} h="110px" borderRadius="2xl" />)}
        {error && !data && (
          <Stack align="center" py={8} gap={2}>
            <Text color="red.500">{(error as Error).message}</Text>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </Stack>
        )}
        {data && visible.length === 0 && (
          <Text textAlign="center" color="fg.muted" py={8}>
            No trips found.
          </Text>
        )}
        {visible.map((j, i) => (
          <JourneyRow key={`${summarize(j).depPlanned}-${i}`} journey={j} now={now} vehicles={vehicles} onClick={() => setSelected(i)} />
        ))}
        {data && (
          <Button variant="subtle" borderRadius="xl" loading={isFetching} onClick={() => setCount((c) => c + 4)}>
            Show later trips
          </Button>
        )}
      </Stack>
      <JourneySheet
        journey={selected === undefined ? undefined : visible[selected]}
        vehicles={vehicles}
        vehiclesLoading={vehiclesLoading}
        isCurrent={selected !== undefined && !!visible[selected] && !!current && tripKey(visible[selected]) === tripKey(current.journey)}
        onToggleCurrent={() => {
          const j = selected === undefined ? undefined : visible[selected]
          if (!j) return
          if (current && tripKey(j) === tripKey(current.journey)) currentTrip.clear()
          else currentTrip.set({ journey: j, fromId: from, toId: to, fromName, toName })
        }}
        onClose={() => setSelected(undefined)}
      />
    </>
  )
}
