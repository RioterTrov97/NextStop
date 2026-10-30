import { Drawer as ArkDrawer } from '@ark-ui/react/drawer'
import { Box, Button, CloseButton, Flex, IconButton, Portal, Stack, Text } from '@chakra-ui/react'
import { Suspense, lazy, memo, useState, type ReactNode } from 'react'
import { LuChevronDown, LuFootprints, LuInfo, LuNavigation, LuPin, LuPinOff } from 'react-icons/lu'
import type { VehicleInfo } from '../../shared/vehicles'
import { useVehicles } from '../api/hooks'
import type { InfoLink, Journey, Leg } from '../api/types'
import { journeyAlerts, isTransit, legOccupancy, stationName, vehicleModeForLeg } from '../lib/journey'
import { lineColor } from '../lib/lines'
import { useNow } from '../lib/hooks'
import { isMapExpanded } from '../lib/mapState'
import { formatDuration, formatTime } from '../lib/time'
import { AlertCard, toAlertProps } from './AlertCard'
import { CarriageStrip } from './CarriageStrip'
import { DelayBadge } from './DelayBadge'
import { LineBadge } from './LineBadge'
import { StopPlatform } from './PlatformPill'
import { RefreshButton } from './RefreshButton'
import { VehicleLoad } from './VehicleLoad'

const LiveMap = lazy(() => import('./LiveMap'))

/** The tallest the sheet gets: the page header (title, subtitle, padding and the notch) stays visible above it. */
const SHEET_MAX_H = 'calc(100dvh - 104px - min(env(safe-area-inset-top), 44px))'

interface LegProps {
  leg: Leg
  vehicles?: Map<string, VehicleInfo>
  vehiclesLoading?: boolean
  /** Already ridden on a followed trip: shown dimmed, without occupancy or map. */
  past?: boolean
}

// Memoised: the pages behind the sheet re-render every second for their countdowns, and a leg with a map is costly.
const TransitLeg = memo(function TransitLeg({ leg, vehicles, vehiclesLoading, past }: LegProps) {
  const [showStops, setShowStops] = useState(false)
  const t = leg.transportation
  const tripId = t?.properties?.RealtimeTripId
  const mode = vehicleModeForLeg(leg)
  const hasConsist = mode === 'train' || mode === 'metro'
  // Rail loads come from the list's shared batched query; other modes only need a position for the map.
  const shared = tripId ? vehicles?.get(tripId) : undefined
  const own = useVehicles(mode, tripId ? [tripId] : [], !past && !shared && !(hasConsist && vehicles))
  const vehicle = shared ?? own.data?.[0]
  const isLoading = hasConsist && vehicles ? !!vehiclesLoading : own.isLoading
  const stops = leg.stopSequence ?? []
  const color = lineColor(t?.number, t?.product?.class)

  return (
    <Box
      bg="bg.subtle"
      borderWidth="1px"
      borderLeftWidth="5px"
      borderRadius="xl"
      p={3}
      opacity={past ? 0.6 : undefined}
      style={{ borderLeftColor: color }}
    >
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
      <Flex align="center" gap={2} fontSize="sm" mt={1} wrap="wrap">
        <b>{formatTime(leg.origin.departureTimeEstimated ?? leg.origin.departureTimePlanned)}</b>
        <Text>{stationName(leg.origin)}</Text>
        <StopPlatform point={leg.origin} transportation={t} />
      </Flex>
      {(leg.destination.arrivalTimePlanned || leg.destination.id) && (
        <Flex align="center" gap={2} fontSize="sm" mt={1} wrap="wrap">
          <b>{formatTime(leg.destination.arrivalTimeEstimated ?? leg.destination.arrivalTimePlanned)}</b>
          <Text>{stationName(leg.destination)}</Text>
          <StopPlatform point={leg.destination} transportation={t} />
        </Flex>
      )}
      <Text fontSize="xs" color="fg.muted" mt={1} hidden={!leg.duration}>
        {formatDuration(leg.duration ?? 0)} · {Math.max(0, stops.length - 1)} stops
      </Text>

      {!past && (mode === 'train' || mode === 'metro') && (
        <Box mt={2}>
          <CarriageStrip mode={mode} vehicle={vehicle} loading={isLoading} fallback={legOccupancy(leg)} />
        </Box>
      )}

      {!past && (mode === 'bus' || (mode === 'lightrail' && (vehicle?.occupancy !== undefined || legOccupancy(leg)))) && (
        <Box mt={2} bg="bg.muted" borderRadius="xl" p={3}>
          <VehicleLoad mode={mode} vehicle={vehicle} fallback={legOccupancy(leg)} loading={isLoading} size="md" />
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

      {!past && (leg.coords?.length ?? 0) > 0 && (
        <Box mt={3} data-no-drag>
          <Suspense fallback={<Box h="220px" bg="bg.muted" borderRadius="xl" />}>
            <LiveMap legs={[leg]} vehicles={vehicle ? [vehicle] : []} mode={mode} />
          </Suspense>
        </Box>
      )}
    </Box>
  )
})

function walkMapsUrl(leg: Leg): string {
  const dest = leg.destination.coord
    ? `${leg.destination.coord[0]},${leg.destination.coord[1]}`
    : encodeURIComponent(leg.destination.disassembledName ?? leg.destination.name ?? '')
  const origin = leg.origin?.coord ? `${leg.origin.coord[0]},${leg.origin.coord[1]}` : undefined
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking${origin ? `&origin=${origin}` : ''}`
}

const WalkLeg = memo(function WalkLeg({ leg, isFinal, past }: { leg: Leg; isFinal: boolean; past?: boolean }) {
  // The walk that ends the trip opens on the map; shorter in-station walks stay collapsed.
  const [showMap] = useState(isFinal)
  const canMap = (leg.coords?.length ?? 0) > 1 && (leg.duration ?? 0) >= 120
  const long = isFinal && (leg.duration ?? 0) >= 120
  const mapsUrl = walkMapsUrl(leg)

  return (
    <Box
      opacity={past ? 0.6 : undefined}
      bg={long ? 'orange.subtle' : 'bg.subtle'}
      borderWidth="1px"
      borderColor={long ? 'orange.muted' : undefined}
      borderRadius="xl"
      p={3}
      fontSize="sm"
    >
      <Flex align="center" gap={3}>
        <Flex
          boxSize="32px"
          borderRadius="full"
          bg={long ? 'orange.solid' : 'bg.emphasized'}
          color={long ? 'white' : 'fg.muted'}
          align="center"
          justify="center"
          flexShrink={0}
        >
          <LuFootprints />
        </Flex>
        <Box flex={1} minW={0}>
          {long && (
            <Text fontSize="xs" fontWeight="bold" letterSpacing="wider" color="orange.fg">
              WALK TO YOUR DESTINATION
            </Text>
          )}
          <Text fontWeight="semibold">
            Walk {formatDuration(leg.duration ?? 0)} to {leg.destination.disassembledName ?? leg.destination.name}
          </Text>
        </Box>
        <Flex align="center" gap={1} flexShrink={0}>
          <IconButton
            asChild
            size="sm"
            variant="ghost"
            aria-label="Open directions in Google Maps"
            title="Open in Google Maps"
            onClick={(e) => e.stopPropagation()}
          >
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
              <LuNavigation />
            </a>
          </IconButton>
        </Flex>
      </Flex>
      {!past && canMap && showMap && (
        <Box mt={3} data-no-drag>
          <Suspense fallback={<Box h="200px" bg="bg.muted" borderRadius="xl" />}>
            <LiveMap legs={[leg]} vehicles={[]} height={200} />
          </Suspense>
        </Box>
      )}
    </Box>
  )
})

interface Props {
  journey?: Journey
  vehicles?: Map<string, VehicleInfo>
  vehiclesLoading?: boolean
  isCurrent?: boolean
  /** Shown above the legs, e.g. a faster route for a followed trip. */
  banner?: ReactNode
  /** Show the live refresh countdown; only needed when the page header behind the sheet has none. */
  showRefresh?: boolean
  onToggleCurrent?: () => void
  onClose: () => void
}

const isImportant = (a: InfoLink) => a.priority === 'high' || a.priority === 'veryHigh'

export function JourneySheet({ journey, vehicles, vehiclesLoading, isCurrent, banner, showRefresh, onToggleCurrent, onClose }: Props) {
  const [showInfo, setShowInfo] = useState(false)
  // Keep drawing the last trip while the sheet slides away, instead of emptying it mid-animation.
  const [last, setLast] = useState(journey)
  if (journey && journey !== last) setLast(journey)
  const shown = journey ?? last
  // On the followed trip, what's still ahead comes first and finished rides fold into "Previous stops" at the bottom.
  const now = useNow(30_000)
  const [showPrevious, setShowPrevious] = useState(false)
  const legs = (shown?.legs ?? []).map((l, i) => ({ l, i }))
  const done = (l: Leg) =>
    !!isCurrent && Date.parse(l.destination.arrivalTimeEstimated ?? l.destination.arrivalTimePlanned ?? '') < now - 60_000
  const finished = legs.length > 0 && legs.every((x) => done(x.l))
  const ahead = finished ? legs : legs.filter((x) => !done(x.l))
  const previous = finished ? [] : legs.filter((x) => done(x.l))
  const renderLeg = ({ l, i }: { l: Leg; i: number }, past = false) =>
    isTransit(l) ? (
      <TransitLeg key={i} leg={l} vehicles={vehicles} vehiclesLoading={vehiclesLoading} past={past} />
    ) : (
      <WalkLeg key={i} leg={l} isFinal={i === legs.length - 1} past={past} />
    )
  const alerts = shown ? journeyAlerts(shown) : []
  const important = alerts.filter(isImportant)
  const minor = alerts.filter((a) => !isImportant(a))
  return (
    <ArkDrawer.Root
      open={!!journey}
      // An expanded map covers the screen; closing it shouldn't also close the sheet underneath.
      onOpenChange={(e) => !e.open && !isMapExpanded() && onClose()}
      swipeDirection="down"
      // Focus the sheet itself on open, not its first button, so Safari doesn't draw a focus box on the info icon.
      initialFocusEl={() => document.querySelector<HTMLElement>('.ns-sheet')}
      // A quarter of the sheet's height, or a quick flick, closes it; the library default (half) needs too long a pull.
      closeThreshold={0.25}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <ArkDrawer.Backdrop asChild>
          <Box className="ns-sheet-backdrop" position="fixed" inset={0} zIndex="overlay" bg="blackAlpha.500" />
        </ArkDrawer.Backdrop>
        <ArkDrawer.Positioner asChild>
          <Flex position="fixed" insetX={0} bottom={0} zIndex="modal" justify="center" pointerEvents="none">
            <ArkDrawer.Content asChild>
              <Flex
                className="ns-sheet"
                direction="column"
                w="full"
                maxW="640px"
                // Stops a little below the page header, so its title and refresh countdown stay in view.
                maxH={SHEET_MAX_H}
                bg="bg.panel"
                borderTopRadius="3xl"
                shadow="lg"
                pb="env(safe-area-inset-bottom)"
                pointerEvents="auto"
                outline="none"
                position="relative"
              >
                <ArkDrawer.Grabber asChild>
                  <Flex justify="center" pt={2} pb={1} cursor="grab" touchAction="none">
                    <ArkDrawer.GrabberIndicator asChild>
                      <Box w="40px" h="5px" borderRadius="full" bg="border.emphasized" />
                    </ArkDrawer.GrabberIndicator>
                  </Flex>
                </ArkDrawer.Grabber>
                <Flex align="center" gap={2} px={6} pt={2} pb={3} pr={12}>
                  <ArkDrawer.Title asChild>
                    <Text flex={1} fontSize="lg" fontWeight="semibold">
                      Trip details
                    </Text>
                  </ArkDrawer.Title>
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
                  {showRefresh && (
                    <Box color="fg.muted">
                      <RefreshButton color="currentColor" />
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
                <Box flex={1} minH={0} overflowY="auto" overscrollBehavior="contain" px={6}>
                  <Stack gap={4} pb={4}>
                    {banner}
                    {(important.length > 0 || (showInfo && minor.length > 0)) && (
                      <Stack gap={2}>
                        {important.map((a, i) => (
                          <AlertCard key={`i${i}`} {...toAlertProps(a)} />
                        ))}
                        {showInfo && minor.map((a, i) => <AlertCard key={`m${i}`} {...toAlertProps(a)} />)}
                      </Stack>
                    )}
                    {ahead.map((x) => renderLeg(x))}
                    {previous.length > 0 && (
                      <Box>
                        <Box
                          as="button"
                          display="flex"
                          alignItems="center"
                          gap={1.5}
                          w="full"
                          py={1}
                          fontSize="sm"
                          fontWeight="semibold"
                          color="fg.muted"
                          aria-expanded={showPrevious}
                          onClick={() => setShowPrevious((v) => !v)}
                        >
                          Previous stops ({previous.length})
                          <LuChevronDown style={{ transform: showPrevious ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />
                        </Box>
                        {showPrevious && (
                          <Stack gap={3} mt={2}>
                            {previous.map((x) => renderLeg(x, true))}
                          </Stack>
                        )}
                      </Box>
                    )}
                  </Stack>
                </Box>
                <ArkDrawer.CloseTrigger asChild>
                  <CloseButton position="absolute" top={5} right={2} />
                </ArkDrawer.CloseTrigger>
              </Flex>
            </ArkDrawer.Content>
          </Flex>
        </ArkDrawer.Positioner>
      </Portal>
    </ArkDrawer.Root>
  )
}
