import type { Carriage, VehicleInfo } from '../shared/vehicles'
import { readFields, toFloat, toStr } from './protobuf'

// TfNSW GTFS-R extension number carrying the per-carriage "consist" list.
const CONSIST_EXTENSION = 1007

function decodeCarriage(buf: Uint8Array): Carriage {
  const c: Carriage = { position: 0, quiet: false }
  for (const f of readFields(buf)) {
    if (f.field === 1 && f.wire === 2) c.name = toStr(f.value)
    else if (f.field === 2 && f.wire === 0) c.position = f.value as number
    else if (f.field === 3 && f.wire === 0) c.occupancy = f.value as number
    else if (f.field === 4 && f.wire === 0) c.quiet = f.value === 1
  }
  return c
}

function decodeVehicle(buf: Uint8Array): VehicleInfo {
  const v: VehicleInfo = { tripId: '', carriages: [] }
  for (const f of readFields(buf)) {
    if (f.wire === 2 && f.field === 1) {
      for (const t of readFields(f.value as Uint8Array)) {
        if (t.field === 1 && t.wire === 2) v.tripId = toStr(t.value)
        else if (t.field === 5 && t.wire === 2) v.routeId = toStr(t.value)
      }
    } else if (f.wire === 2 && f.field === 2) {
      for (const p of readFields(f.value as Uint8Array)) {
        if (p.wire !== 5) continue
        if (p.field === 1) v.lat = toFloat(p.value)
        else if (p.field === 2) v.lon = toFloat(p.value)
        else if (p.field === 3) v.bearing = toFloat(p.value)
      }
    } else if (f.wire === 0 && f.field === 5) v.timestamp = f.value as number
    else if (f.wire === 0 && f.field === 9) v.occupancy = f.value as number
    else if (f.wire === 2 && f.field === 8) {
      for (const d of readFields(f.value as Uint8Array)) {
        if (d.field === 2 && d.wire === 2) v.label = toStr(d.value)
        else if (d.field === CONSIST_EXTENSION && d.wire === 2) v.carriages.push(decodeCarriage(d.value as Uint8Array))
      }
    } else if (f.wire === 2 && f.field === CONSIST_EXTENSION) v.carriages.push(decodeCarriage(f.value as Uint8Array))
  }
  v.carriages = v.carriages.filter((c) => c.position > 0).sort((a, b) => a.position - b.position)
  return v
}

export function decodeVehiclePositions(buf: Uint8Array, wanted?: Set<string>): VehicleInfo[] {
  const out: VehicleInfo[] = []
  for (const entity of readFields(buf)) {
    if (entity.field !== 2 || entity.wire !== 2) continue
    for (const e of readFields(entity.value as Uint8Array)) {
      if (e.field !== 4 || e.wire !== 2) continue
      const v = decodeVehicle(e.value as Uint8Array)
      if (v.tripId && (!wanted || wanted.has(v.tripId))) out.push(v)
    }
  }
  return out
}
