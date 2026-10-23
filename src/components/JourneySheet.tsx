import { Box, Button, CloseButton, Drawer, Flex, HStack, IconButton, Portal, Stack, Text } from '@chakra-ui/react'
import { Suspense, lazy, useState } from 'react'
import { LuFootprints, LuInfo, LuPin, LuPinOff } from 'react-icons/lu'
import type { VehicleInfo } from '../../shared/vehicles'
import { useVehicles } from '../api/hooks'
import type { InfoLink, Journey, Leg } from '../api/types'
import { journeyAlerts, isTransit, legOccupancy, platformOf, vehicleModeForLeg } from '../lib/journey'
import { lineColor } from '../lib/lines'
import { isMapExpanded } from '../lib/mapState'
import { formatDuration, formatTime } from '../lib/time'
import { AlertCard, toAlertProps } from './AlertCard'
import { CarriageStrip } from './CarriageStrip'
import { DelayBadge } from './DelayBadge'
import { LineBadge } from './LineBadge'
import { VehicleLoad } from './VehicleLoad'

const LiveMap = lazy(() => import('./LiveMap'))

interface LegProps {
  leg: Leg
  vehicles?: Map<string, VehicleInfo>
  vehiclesLoading?: boolean
}

function TransitLeg({ leg, vehicles, vehiclesLoading }: LegProps) {
  const [showStops, setShowStops] = useState(false)
  const t = leg.transportation
  const tripId = t?.properties?.RealtimeTripId
  const mode = vehicleModeForLeg(leg)
  const hasConsist = mode === 'train' || mode === 'metro'
  // Rail loads come from the list's shared batched query; other modes only need a position for the map.
  const shared = tripId ? vehicles?.get(tripId) : undefined
  const own = useVehicles(mode, tripId ? [tripId] : [], !shared && !(hasConsist && vehicles))
  const vehicle = shared ?? own.data?.[0]
  const isLoading = hasConsist && vehicles ? !!vehiclesLoading : own.isLoading
  const platform = platformOf(leg)
  const stops = leg.stopSequence ?? []
  const color = lineColor(t?.number, t?.product?.class)

  return (
    <Box borderLeftWidth="4px" pl={3} style={{ borderColor: color }}>
      <Flex align="center" gap={2} wrap="wrap">
        <LineBadge number={t?.number ?? t?.disassembledName} cls={t?.product?.class} />
        <Text fontWeight="semibold" flex={1} minW={0}>
          {t?.destination?.name ? `to ${t.destination.name}` : t?.description}
        </Text>
        <DelayBadge
          planned={leg.origin.departureTimePlanned}
          estimated={leg.origin.departureTimeEstimated}
          realtime={leg.isRealtimeControlled}
        />
      </Flex>
      <Text fontSize="sm" mt={1}>
        <b>{formatTime(leg.origin.departureTimeEstimated ?? leg.origin.departureTimePlanned)}</b>{' '}
        {leg.origin.disassembledName ?? leg.origin.name}
        {platform && (
          <Text as="span" color="fg.muted">
            {' '}
            · Platform {platform}
          </Text>
        )}
      </Text>
      <Text fontSize="sm">
        <b>{formatTime(leg.destination.arrivalTimeEstimated ?? leg.destination.arrivalTimePlanned)}</b>{' '}
        {leg.destination.disassembledName ?? leg.destination.name}
      </Text>
      <Text fontSize="xs" color="fg.muted">
        {formatDuration(leg.duration ?? 0)} · {Math.max(0, stops.length - 1)} stops
      </Text>

      {hasConsist && (
        <Box mt={2}>
          <CarriageStrip vehicle={vehicle} loading={isLoading} fallback={legOccupancy(leg)} />
        </Box>
      )}

      {(mode === 'bus' || mode === 'lightrail') && (
        <Box mt={2} bg="bg.muted" borderRadius="xl" p={3}>
          <VehicleLoad mode={mode} vehicle={vehicle} fallback={legOccupancy(leg)} size="md" />
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
            <LiveMap legs={[leg]} vehicles={vehicle ? [vehicle] : []} mode={mode} />
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
      <Text>
        Walk {formatDuration(leg.duration ?? 0)} to {leg.destination.disassembledName ?? leg.destination.name}
      </Text>
    </HStack>
  )
}

interface Props {
  journey?: Journey
  vehicles?: Map<string, VehicleInfo>
  vehiclesLoading?: boolean
  isCurrent?: boolean
  onToggleCurrent?: () => void
  onClose: () => void
}

const isImportant = (a: InfoLink) => a.priority === 'high' || a.priority === 'veryHigh'

export function JourneySheet({ journey, vehicles, vehiclesLoading, isCurrent, onToggleCurrent, onClose }: Props) {
  const [showInfo, setShowInfo] = useState(false)
  const alerts = journey ? journeyAlerts(journey) : []
  const important = alerts.filter(isImportant)
  const minor = alerts.filter((a) => !isImportant(a))
  return (
    <Drawer.Root open={!!journey} placement="bottom" onOpenChange={(e) => !e.open && !isMapExpanded() && onClose()}>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content borderTopRadius="3xl" maxH="92vh" pb="env(safe-area-inset-bottom)">
            <Drawer.Header pr={12}>
              <Flex align="center" gap={2} w="full">
                <Drawer.Title flex={1}>Trip details</Drawer.Title>
                {minor.length > 0 && (
                  <Box position="relative">
                    <IconButton
                      ml="2"
                      aria-label={showInfo ? 'Hide service information' : 'Show service information'}
                      aria-pressed={showInfo}
                      size="sm"
                      variant={showInfo ? 'subtle' : 'ghost'}
                      onClick={() => setShowInfo((s) => !s)}
                    >
                      <LuInfo />
                    </IconButton>
                    <Box
                      position="absolute"
                      top="0px"
                      right="0px"
                      minW="16px"
                      h="16px"
                      px="4px"
                      borderRadius="full"
                      bg="blue.500"
                      color="white"
                      fontSize="10px"
                      fontWeight="bold"
                      textAlign="center"
                      lineHeight="16px"
                      pointerEvents="none"
                    >
                      {minor.length}
                    </Box>
                  </Box>
                )}
                {onToggleCurrent && (
                  <Button
                    size="sm"
                    borderRadius="full"
                    colorPalette="teal"
                    variant={isCurrent ? 'solid' : 'outline'}
                    onClick={onToggleCurrent}
                  >
                    {isCurrent ? <LuPinOff /> : <LuPin />}
                    {isCurrent ? 'Following' : 'Follow'}
                  </Button>
                )}
              </Flex>
            </Drawer.Header>
            <Drawer.Body>
              <Stack gap={4} pb={4}>
                {(important.length > 0 || (showInfo && minor.length > 0)) && (
                  <Stack gap={2}>
                    {important.map((a, i) => (
                      <AlertCard key={`i${i}`} {...toAlertProps(a)} />
                    ))}
                    {showInfo && minor.map((a, i) => <AlertCard key={`m${i}`} {...toAlertProps(a)} />)}
                  </Stack>
                )}
                {journey?.legs.map((l, i) =>
                  isTransit(l) ? (
                    <TransitLeg key={i} leg={l} vehicles={vehicles} vehiclesLoading={vehiclesLoading} />
                  ) : (
                    <WalkLeg key={i} leg={l} />
                  ),
                )}
              </Stack>
            </Drawer.Body>
            <Drawer.CloseTrigger asChild>
              <CloseButton position="absolute" top={5} right={2} />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}
