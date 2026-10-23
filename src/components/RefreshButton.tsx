import { Box, Button } from '@chakra-ui/react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { LuRefreshCw } from 'react-icons/lu'
import { requestFresh } from '../api/client'
import { REALTIME_MS, isRealtimeKey } from '../api/hooks'
import { useNow } from '../lib/hooks'

/** Refetches every live query (trips, departures, vehicles) right now, bypassing the proxy cache. */
export function RefreshButton() {
  const qc = useQueryClient()
  const now = useNow(1000)
  const fetching = useIsFetching({ predicate: (q) => isRealtimeKey(q.queryKey) }) > 0

  // The next poll fires one interval after the most recent update among the queries on screen.
  const lastUpdate = Math.max(
    0,
    ...qc
      .getQueryCache()
      .findAll({ predicate: (q) => isRealtimeKey(q.queryKey) && q.getObserversCount() > 0 })
      .map((q) => q.state.dataUpdatedAt),
  )
  const secondsLeft = lastUpdate ? Math.min(REALTIME_MS / 1000, Math.max(0, Math.ceil((lastUpdate + REALTIME_MS - now) / 1000))) : undefined

  return (
    <Button
      aria-label={`Refresh live data${secondsLeft === undefined ? '' : `, next refresh in ${secondsLeft} seconds`}`}
      variant="ghost"
      color="white"
      size="sm"
      px={2}
      gap={1}
      disabled={fetching}
      onClick={() => {
        requestFresh()
        void qc.invalidateQueries({ predicate: (q) => isRealtimeKey(q.queryKey) })
      }}
    >
      <Box
        as="span"
        display="inline-flex"
        animationName={fetching ? 'spin' : undefined}
        animationDuration="0.8s"
        animationIterationCount="infinite"
      >
        <LuRefreshCw />
      </Box>
      {secondsLeft !== undefined && (
        <Box as="span" minW="2ch" fontSize="xs" fontWeight="semibold" fontVariantNumeric="tabular-nums">
          {fetching ? '' : secondsLeft}
        </Box>
      )}
    </Button>
  )
}
