import { Box, Button, Flex } from '@chakra-ui/react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef, useState } from 'react'
import { LuCheck } from 'react-icons/lu'
import { requestFresh } from '../api/client'
import { REALTIME_MS, isTimetableKey } from '../api/hooks'
import { getNextRefreshAt, refreshRealtime } from '../api/realtime'
import { useNow } from '../lib/hooks'

const SIZE = 32
const R = 13
const C = 2 * Math.PI * R
/** How long the tick shows after fresh data lands. */
const DONE_MS = 900

/**
 * The live-data countdown: a ring that drains until the next shared refresh, a spinning arc while it refreshes,
 * then a brief tick once fresh data is in. Tapping it refreshes everything now.
 */
export function RefreshButton({ color = 'white' }: { color?: string } = {}) {
  const qc = useQueryClient()
  const now = useNow(250)
  const fetching = useIsFetching({ predicate: (q) => isTimetableKey(q.queryKey) }) > 0

  // Note when a refresh finishes, in the same render, so the tick replaces the spinner with no countdown flash between.
  const [doneAt, setDoneAt] = useState(0)
  const [wasFetching, setWasFetching] = useState(fetching)
  if (wasFetching !== fetching) {
    setWasFetching(fetching)
    if (!fetching) setDoneAt(now)
  }

  const nextAt = getNextRefreshAt()
  const msLeft = nextAt - now
  // At the end of the countdown the refresh is already underway, so never show 0.
  const refreshing = fetching || msLeft <= 0
  const done = !refreshing && now - doneAt < DONE_MS
  const seconds = Math.min(REALTIME_MS / 1000, Math.max(1, Math.ceil(msLeft / 1000)))
  const fraction = Math.min(1, Math.max(0, msLeft / REALTIME_MS))

  // The ring drains in one continuous animation from where it is now to empty, rather than following the 250ms
  // re-renders (which moved it in visible steps, and in jumps once reduced motion turned the smoothing transition off).
  // It restarts only when the countdown does. A slow linear drain is a progress indicator, so it runs under reduced
  // motion too.
  const ringRef = useRef<SVGCircleElement>(null)
  const draining = !refreshing && !done
  useLayoutEffect(() => {
    const ring = ringRef.current
    if (!draining || !ring?.animate) return
    const left = nextAt - Date.now()
    if (left <= 0) return
    const from = C * (1 - Math.min(1, left / REALTIME_MS))
    const drain = ring.animate([{ strokeDashoffset: from }, { strokeDashoffset: C }], {
      duration: left,
      easing: 'linear',
      fill: 'forwards',
    })
    return () => drain.cancel()
  }, [nextAt, draining])

  return (
    <Button
      className="ns-refresh"
      aria-label={refreshing ? 'Refreshing live data' : `Refresh live data, next refresh in ${seconds} seconds`}
      aria-live="polite"
      variant="ghost"
      color={color}
      size="sm"
      px={1}
      borderRadius="full"
      title={refreshing ? 'Refreshing' : 'Refresh now'}
      disabled={refreshing}
      _disabled={{ opacity: 1, cursor: 'default' }}
      onClick={() => {
        requestFresh()
        void refreshRealtime(qc)
      }}
    >
      <Box position="relative" w={`${SIZE}px`} h={`${SIZE}px`} flexShrink={0}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE} // Fixed size: Chakra's Button shrinks any svg inside it to icon size.
          style={{ display: 'block', width: SIZE, height: SIZE }}
          aria-hidden
        >
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="currentColor" strokeOpacity={0.22} strokeWidth={2.5} />
          {refreshing ? (
            // Indeterminate arc: grows and shrinks while it turns.
            <g className="ns-refresh-spin" style={{ transformOrigin: 'center' }}>
              <circle
                className="ns-refresh-arc"
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray={`${C * 0.25} ${C}`}
              />
            </g>
          ) : (
            <circle
              ref={ringRef}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={C}
              // The resting position; while draining, the animation above drives it.
              strokeDashoffset={C * (1 - (done ? 1 : fraction))}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              // Refilling for the tick eases back.
              style={{ transition: done ? 'stroke-dashoffset 0.45s ease-out' : 'none' }}
            />
          )}
        </svg>
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
            // Three soft dots in a gentle wave: fills the ring quietly while the spinner does the talking.
            <Flex gap="2.5px" align="center" aria-hidden>
              {[0, 1, 2].map((i) => (
                <Box
                  key={i}
                  className="ns-refresh-dot"
                  w="3px"
                  h="3px"
                  borderRadius="full"
                  bg="currentColor"
                  style={{ animationDelay: `${i * 0.16}s` }}
                />
              ))}
            </Flex>
          ) : done ? (
            <Box className="ns-refresh-pop" lineHeight={0}>
              <LuCheck size={14} strokeWidth={3} style={{ width: 14, height: 14 }} />
            </Box>
          ) : (
            <span key={seconds} className="ns-refresh-tick">
              {seconds}
            </span>
          )}
        </Flex>
      </Box>
    </Button>
  )
}
