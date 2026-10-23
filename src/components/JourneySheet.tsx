import { Box, CloseButton, Drawer, Flex, HStack, Portal, Stack, Text } from '@chakra-ui/react'
import { Suspense, lazy, useState } from 'react'
import { LuFootprints } from 'react-icons/lu'
import { useVehicles } from '../api/hooks'
import type { Journey, Leg } from '../api/types'
import { journeyAlerts, isTransit, platformOf, vehicleModeForLeg } from '../lib/journey'
import { lineColor } from '../lib/lines'
import { occupancyFromName } from '../lib/occupancy'
import { formatDuration, formatTime } from '../lib/time'
import { AlertCard, toAlertProps } from './AlertCard'
import { CarriageStrip } from './CarriageStrip'
import { DelayBadge } from './DelayBadge'
import { LineBadge } from './LineBadge'

const LiveMap = lazy(() => import('./LiveMap'))

function TransitLeg({ leg }: { leg: Leg }) {
  const [showStops, setShowStops] = useState(false)
  const t = leg.transportation
  const tripId = t?.properties?.RealtimeTripId
  const mode = vehicleModeForLeg(leg)
  const { data, isLoading } = useVehicles(mode, tripId ? [tripId] : [])
  const vehicle = data?.[0]
  const platform = platformOf(leg)
  const stops = leg.stopSequence ?? []
  const color = lineColor(t?.number, t?.product?.class)
  const hasConsist = mode === 'train' || mode === 'metro'

  return (
    <Box borderLeftWidth="4px" pl={3} style={{ borderColor: color }}>
      <Flex align="center" gap={2} wrap="wrap">
        <LineBadge number={t?.number ?? t?.disassembledName} cls={t?.product?.class} />
        <Text fontWeight="semibold" flex={1} minW={0}>{t?.destination?.name ? `to ${t.destination.name}` : t?.description}</Text>
        <DelayBadge
          planned={leg.origin.departureTimePlanned}
          estimated={leg.origin.departureTimeEstimated}
          realtime={leg.isRealtimeControlled}
        />
      </Flex>
      <Text fontSize="sm" mt={1}>
        <b>{formatTime(leg.origin.departureTimeEstimated ?? leg.origin.departureTimePlanned)}</b> {leg.origin.disassembledName ?? leg.origin.name}
        {platform && <Text as="span" color="fg.muted"> · Platform {platform.replace(/^[A-Z]+/, '')}</Text>}
      </Text>
      <Text fontSize="sm">
        <b>{formatTime(leg.destination.arrivalTimeEstimated ?? leg.destination.arrivalTimePlanned)}</b> {leg.destination.disassembledName ?? leg.destination.name}
      </Text>
      <Text fontSize="xs" color="fg.muted">{formatDuration(leg.duration ?? 0)} · {Math.max(0, stops.length - 1)} stops</Text>

      {hasConsist && (
        <Box mt={2}>
          <CarriageStrip
            vehicle={vehicle}
            loading={isLoading}
            fallback={occupancyFromName(typeof leg.properties?.occupancy === 'string' ? leg.properties.occupancy : leg.origin.properties?.occupancy)}
          />
        </Box>
      )}

      {stops.length > 2 && (
        <Box mt={2}>
          <Box as="button" fontSize="sm" color="teal.500" onClick={() => setShowStops((s) => !s)}>
            {showStops ? 'Hide stops' : 'Show stops'}
          </Box>
          {showStops && (
            <Stack gap={1} mt={1} fontSize="sm">
              {stops.map((s, i) => (
                <Flex key={i} gap={3}>
                  <Text w="64px" color="fg.muted" fontVariantNumeric="tabular-nums">
                    {formatTime(s.departureTimeEstimated ?? s.arrivalTimeEstimated ?? s.departureTimePlanned ?? s.arrivalTimePlanned)}
                  </Text>
                  <Text>{s.disassembledName ?? s.name}</Text>
                </Flex>
              ))}
            </Stack>
          )}
        </Box>
      )}

      {(leg.coords?.length ?? 0) > 0 && (
        <Box mt={3}>
          <Suspense fallback={<Box h="220px" bg="bg.muted" borderRadius="xl" />}>
            <LiveMap legs={[leg]} vehicles={vehicle ? [vehicle] : []} />
          </Suspense>
        </Box>
      )}
    </Box>
  )
}

function WalkLeg({ leg }: { leg: Leg }) {
  return (
    <HStack borderLeftWidth="4px" borderStyle="dotted" pl={3} color="fg.muted" fontSize="sm">
      <LuFootprints />
      <Text>Walk {formatDuration(leg.duration ?? 0)} to {leg.destination.disassembledName ?? leg.destination.name}</Text>
    </HStack>
  )
}

interface Props {
  journey?: Journey
  onClose: () => void
}

export function JourneySheet({ journey, onClose }: Props) {
  const alerts = journey ? journeyAlerts(journey) : []
  return (
    <Drawer.Root open={!!journey} placement="bottom" onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content borderTopRadius="3xl" maxH="92dvh" pb="env(safe-area-inset-bottom)">
            <Drawer.Header>
              <Drawer.Title>Trip details</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>
              <Stack gap={4} pb={4}>
                {alerts.length > 0 && (
                  <Stack gap={2}>
                    {alerts.map((a, i) => (
                      <AlertCard key={i} {...toAlertProps(a)} />
                    ))}
                  </Stack>
                )}
                {journey?.legs.map((l, i) => (isTransit(l) ? <TransitLeg key={i} leg={l} /> : <WalkLeg key={i} leg={l} />))}
              </Stack>
            </Drawer.Body>
            <Drawer.CloseTrigger asChild>
              <CloseButton position="absolute" top={3} right={3} />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}
