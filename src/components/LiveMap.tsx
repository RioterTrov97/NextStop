import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuMaximize2, LuX } from 'react-icons/lu'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import type { VehicleInfo, VehicleMode } from '../../shared/vehicles'
import type { Leg } from '../api/types'
import { isTransit } from '../lib/journey'
import { useColorMode } from '../lib/colorMode'
import { lineColor } from '../lib/lines'
import { markMapExpanded } from '../lib/mapState'

// Baked in at build time; MapTiler keys are public by design, so restrict this one to your domain in the MapTiler dashboard.
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined

interface Props {
  legs: Leg[]
  vehicles: VehicleInfo[]
  mode?: VehicleMode
  height?: number | string
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  // `points` is a new array each render; key on its contents so polling re-renders don't re-fit and undo user zoom/pan.
  const signature = JSON.stringify(points)
  useEffect(() => {
    const pts = JSON.parse(signature) as [number, number][]
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [24, 24] })
  }, [map, signature])
  return null
}

// 24x24 stroke paths, drawn white on a coloured disc.
const MODE_ICON: Record<VehicleMode, string> = {
  bus: '<rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16M8 21v-4M16 21v-4"/>',
  train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/>',
  metro: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/>',
  lightrail: '<rect x="5" y="4" width="14" height="13" rx="3"/><path d="M5 11h14M12 4V1M8 21l2-4M16 21l-2-4"/>',
  ferry: '<path d="M3 15l2 5h14l2-5-9-3z"/><path d="M12 12V4M8 8h8"/>',
}

function vehicleIcon(mode: VehicleMode | undefined, color: string) {
  const glyph = MODE_ICON[mode ?? 'bus']
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

function MapView({ legs, vehicles, mode, height = 220, fullscreen }: Props & { fullscreen?: boolean }) {
  const dark = useColorMode() === 'dark'
  const first = legs.find((l) => l.transportation)?.transportation
  const icon = useMemo(
    () => vehicleIcon(mode, lineColor(first?.number, first?.product?.class)),
    [mode, first?.number, first?.product?.class],
  )
  const lines = legs.filter((l) => l.coords?.length)
  const all = lines.flatMap((l) => l.coords!)
  const stops = legs.flatMap((l) => [l.origin, l.destination]).filter((s) => s.coord)

  return (
    <MapContainer
      center={[-33.8688, 151.2093]}
      zoom={12}
      // Without a MapTiler key the OSM fallback has no dark style, so the theme inverts it.
      className={MAPTILER_KEY ? undefined : 'tiles-invert'}
      style={{ height, borderRadius: fullscreen ? 0 : 12, zIndex: 0 }}
      attributionControl
    >
      {MAPTILER_KEY ? (
        <TileLayer
          url={`https://api.maptiler.com/maps/${dark ? 'streets-v2-dark' : 'streets-v2'}/256/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`}
          attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
      ) : (
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
      )}
      <FitBounds points={all} />
      {lines.map((l, i) => (
        <Polyline
          key={i}
          positions={l.coords!}
          pathOptions={{
            color:
              dark && !isTransit(l)
                ? '#ffffff'
                : lineColor(l.transportation?.number, l.transportation?.product?.class),
            weight: 5,
            dashArray: !isTransit(l) ? '2 8' : undefined,
          }}
        />
      ))}
      {stops.map((s, i) => (
        <CircleMarker
          key={i}
          center={s.coord!}
          radius={5}
          pathOptions={{ color: '#fff', fillColor: '#0f172a', fillOpacity: 1, weight: 2 }}
        />
      ))}
      {vehicles
        .filter((v) => v.lat !== undefined && v.lon !== undefined)
        .map((v) => (
          <Marker key={v.tripId} position={[v.lat!, v.lon!]} icon={icon} />
        ))}
    </MapContainer>
  )
}

function MapButton({ label, onClick, children, top }: { label: string; onClick: () => void; children: React.ReactNode; top: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        position: 'absolute',
        top,
        right: 10,
        zIndex: 1,
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        color: '#0f172a',
        border: '2px solid rgba(0,0,0,.2)',
        borderRadius: 4,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

export default function LiveMap(props: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [host, setHost] = useState<Element | null>(null)

  useEffect(() => {
    if (!host) return
    const release = markMapExpanded()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setHost(null)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      release()
    }
  }, [host])

  // Inside the journey drawer, portal to its positioner: the drawer's transform traps fixed children and body-level portals count as outside clicks.
  const expand = () => setHost(ref.current?.closest('[data-part="positioner"]') ?? document.body)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <MapView {...props} />
      <MapButton label="Expand map" top="10px" onClick={expand}>
        <LuMaximize2 size={16} />
      </MapButton>
      {host &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2000,
              // The drawer's positioner/body disable pointer events outside its content.
              pointerEvents: 'auto',
              background: '#fff',
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <div style={{ position: 'relative', height: '100%' }}>
              <MapView {...props} height="100%" fullscreen />
              <MapButton label="Close map" top="10px" onClick={() => setHost(null)}>
                <LuX size={18} />
              </MapButton>
            </div>
          </div>,
          host,
        )}
    </div>
  )
}
