/** GTFS-realtime OccupancyStatus: 0 empty .. 6 not accepting passengers. */
export interface Carriage {
  position: number
  name?: string
  occupancy?: number
  quiet: boolean
}

export interface VehicleInfo {
  tripId: string
  routeId?: string
  label?: string
  lat?: number
  lon?: number
  bearing?: number
  timestamp?: number
  occupancy?: number
  carriages: Carriage[]
}

export type VehicleMode = 'train' | 'metro' | 'lightrail' | 'ferry' | 'bus'

/** Carriages worth drawing: at least two, and at least one reporting a load. Anything else is no consist data at all. */
export function reportedCarriages(cars: Carriage[] | undefined): Carriage[] {
  return cars && cars.length > 1 && cars.some((c) => c.occupancy !== undefined) ? cars : []
}
