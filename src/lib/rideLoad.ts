import { reportedCarriages, type VehicleInfo } from '../../shared/vehicles'
import type { Leg } from '../api/types'
import { legOccupancy, vehicleModeForLeg } from './journey'
import { occupancyFromEnum, type OccupancyLevel } from './occupancy'

export interface RideLoad {
  mode: 'train' | 'metro' | 'bus' | 'lightrail'
  vehicle?: VehicleInfo
  /** Per-carriage readings, front to back, when the service sends them. */
  carriages: boolean
  /** Whole-ride summary for the label. */
  level: OccupancyLevel
  /** With carriage data: the level most carriages are at, for a one-word status. */
  typical?: OccupancyLevel
  /** From the trip planner's forecast rather than a live reading. */
  predicted: boolean
}

/** What we actually know about how busy one ride is, from the best source available; undefined when nothing is known. */
export function rideLoad(leg: Leg, vehicle: VehicleInfo | undefined): RideLoad | undefined {
  const mode = vehicleModeForLeg(leg)
  if (mode !== 'train' && mode !== 'metro' && mode !== 'bus' && mode !== 'lightrail') return undefined
  const cars = reportedCarriages(vehicle?.carriages)
  const known = cars.map((c) => occupancyFromEnum(c.occupancy)).filter((l) => l.level > 0)
  if ((mode === 'train' || mode === 'metro') && known.length) {
    // The label spans the quietest to the busiest carriage, so "Plenty" never hides a packed end of the train.
    const quiet = known.reduce((a, b) => (b.level < a.level ? b : a))
    const busy = known.reduce((a, b) => (b.level > a.level ? b : a))
    const label = quiet.level === busy.level ? busy.label : `${quiet.short} to ${busy.short.toLowerCase()}`
    // Most carriages' level; ties go to the busier one so the status never undersells a crowd.
    const counts = new Map<number, number>()
    for (const l of known) counts.set(l.level, (counts.get(l.level) ?? 0) + 1)
    const typical = known.reduce((a, b) => {
      const ca = counts.get(a.level)!
      const cb = counts.get(b.level)!
      return cb > ca || (cb === ca && b.level > a.level) ? b : a
    })
    return { mode, vehicle, carriages: true, level: { ...busy, label }, typical, predicted: false }
  }
  if (vehicle?.occupancy !== undefined && occupancyFromEnum(vehicle.occupancy).level > 0) {
    return { mode, vehicle, carriages: false, level: occupancyFromEnum(vehicle.occupancy), predicted: false }
  }
  const forecast = legOccupancy(leg)
  return forecast ? { mode, vehicle, carriages: false, level: forecast, predicted: true } : undefined
}

const NAMES = { train: 'Train', metro: 'Metro', bus: 'Bus', lightrail: 'Light rail' }

/**
 * The tiny caption under a card's load shape, and a full sentence for screen readers and long-press. The caption
 * always gives the status, and says when it is a forecast, covers only the whole train, or is missing.
 */
export function loadCaption(mode: RideLoad['mode'], load: RideLoad | undefined): { caption?: string; detail: string } {
  const name = NAMES[mode]
  if (!load) {
    return {
      caption: 'No data',
      detail:
        mode === 'lightrail'
          ? 'Light rail does not report how busy it is.'
          : `${name} load: no data. This service doesn't report how busy it is, or isn't running yet.`,
    }
  }
  if (load.carriages) return { caption: (load.typical ?? load.level).short, detail: `${name} load by carriage: ${load.level.label}.` }
  const rail = mode === 'train' || mode === 'metro'
  if (load.predicted) {
    return {
      caption: `${load.level.short} · est.`,
      detail: `${name} load: ${load.level.label}, predicted by the trip planner${rail ? '. No live carriage data for this service' : ''}.`,
    }
  }
  return rail
    ? {
        caption: `${load.level.short} · overall`,
        detail: `${name} load: ${load.level.label} across the whole ${name.toLowerCase()}. No per-carriage data.`,
      }
    : { caption: load.level.short, detail: `${name} load: ${load.level.label}.` }
}
