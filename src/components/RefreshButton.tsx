import { Box, Button, Flex } from '@chakra-ui/react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { requestFresh } from '../api/client'
import { REALTIME_MS, isRealtimeKey } from '../api/hooks'
import { getNextRefreshAt, refreshRealtime } from '../api/realtime'
import { useNow } from '../lib/hooks'

const SIZE = 32
const R = 12
const C = 2 * Math.PI * R

/** Shows a ring that drains until the next shared refresh, and refetches every live query right now when tapped. */
export function RefreshButton() {
  const qc = useQueryClient()
  const now = useNow(250)
  const fetching = useIsFetching({ predicate: (q) => isRealtimeKey(q.queryKey) }) > 0

  const msLeft = getNextRefreshAt() - now
  // Never show 0: at the end of the countdown the refresh is already underway.
  const refreshing = fetching || msLeft <= 0
  const seconds = Math.min(REALTIME_MS / 1000, Math.max(1, Math.ceil(msLeft / 1000)))
  const fraction = refreshing ? 0.25 : Math.min(1, Math.max(0, msLeft / REALTIME_MS))

  return (
    <Button
      aria-label={refreshing ? 'Refreshing live data' : `Refresh live data, next refresh in ${seconds} seconds`}
      variant="ghost"
      color="white"
      size="sm"
      px={1}
      borderRadius="full"
      title={refreshing ? 'Refreshing' : undefined}
      disabled={refreshing}
      _disabled={{ opacity: 1, cursor: 'default' }}
      onClick={() => {
        requestFresh()
        void refreshRealtime(qc)
      }}
    >
      <Box position="relative" w={`${SIZE}px`} h={`${SIZE}px`} flexShrink={0}>
        <Box
          animationName={refreshing ? 'spin' : undefined}
          animationDuration="1s"
          animationTimingFunction="linear"
          animationIterationCount="infinite"
          aria-hidden
        >
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} style={{ display: 'block', width: SIZE, height: SIZE }}>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={2} />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - fraction)}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              style={{ transition: refreshing ? undefined : 'stroke-dashoffset 0.25s linear' }}
            />
          </svg>
        </Box>
        <Flex
          position="absolute"
          inset={0}
          align="center"
          justify="center"
          fontSize="11px"
          fontWeight="bold"
          fontVariantNumeric="tabular-nums"
        >
          {refreshing ? (
            <Flex gap="2px" aria-hidden>
              {[0, 1, 2].map((i) => (
                <Box key={i} w="2px" h="2px" borderRadius="full" bg="currentColor" />
              ))}
            </Flex>
          ) : (
            seconds
          )}
        </Flex>
      </Box>
    </Button>
  )
}
