import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import { useColorMode } from '../lib/colorMode'
import type { VehicleInfo } from '../../shared/vehicles'
import type { Leg } from '../api/types'
import { lineColor } from '../lib/lines'

interface Props {
  legs: Leg[]
  vehicles: VehicleInfo[]
  height?: number | string
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [24, 24] })
  }, [map, points])
  return null
}

const vehicleIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#0f766e;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

export default function LiveMap({ legs, vehicles, height = 220 }: Props) {
  const dark = useColorMode() === 'dark'
  const lines = legs.filter((l) => l.coords?.length)
  const all = lines.flatMap((l) => l.coords!)
  const stops = legs.flatMap((l) => [l.origin, l.destination]).filter((s) => s.coord)

  return (
    <MapContainer center={[-33.8688, 151.2093]} zoom={12} style={{ height, borderRadius: 12, zIndex: 0 }} attributionControl>
      <TileLayer
        url={`https://{s}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`}
        attribution='&copy; OpenStreetMap contributors &copy; CARTO'
      />
      <FitBounds points={all} />
      {lines.map((l, i) => (
        <Polyline
          key={i}
          positions={l.coords!}
          pathOptions={{
            color: lineColor(l.transportation?.number, l.transportation?.product?.class),
            weight: 5,
            dashArray: (l.transportation?.product?.class ?? 99) >= 99 ? '2 8' : undefined,
          }}
        />
      ))}
      {stops.map((s, i) => (
        <CircleMarker key={i} center={s.coord!} radius={5} pathOptions={{ color: '#fff', fillColor: '#0f172a', fillOpacity: 1, weight: 2 }} />
      ))}
      {vehicles
        .filter((v) => v.lat !== undefined && v.lon !== undefined)
        .map((v) => (
          <Marker key={v.tripId} position={[v.lat!, v.lon!]} icon={vehicleIcon} />
        ))}
    </MapContainer>
  )
}
