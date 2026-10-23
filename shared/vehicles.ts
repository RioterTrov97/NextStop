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
