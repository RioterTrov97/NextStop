export interface OccupancyLevel {
  label: string
  color: string
  /** 1 (quiet) to 4 (very busy); 0 unknown */
  level: number
}

const UNKNOWN: OccupancyLevel = { label: 'No data', color: '#94a3b8', level: 0 }

const LEVELS: OccupancyLevel[] = [
  { label: 'Plenty of seats', color: '#22c55e', level: 1 }, // 0 EMPTY
  { label: 'Plenty of seats', color: '#22c55e', level: 1 }, // 1 MANY_SEATS
  { label: 'Few seats', color: '#eab308', level: 2 }, // 2 FEW_SEATS
  { label: 'Standing room only', color: '#f97316', level: 3 }, // 3 STANDING_ROOM_ONLY
  { label: 'Very crowded', color: '#ef4444', level: 4 }, // 4 CRUSHED_STANDING
  { label: 'Full', color: '#b91c1c', level: 4 }, // 5 FULL
  { label: 'Full', color: '#b91c1c', level: 4 }, // 6 NOT_ACCEPTING
]

export function occupancyFromEnum(n?: number): OccupancyLevel {
  return n === undefined ? UNKNOWN : (LEVELS[n] ?? UNKNOWN)
}

const NAMES: Record<string, number> = {
  EMPTY: 0,
  MANY_SEATS: 1,
  MANY_SEATS_AVAILABLE: 1,
  FEW_SEATS: 2,
  FEW_SEATS_AVAILABLE: 2,
  STANDING_ROOM_ONLY: 3,
  CRUSHED_STANDING_ROOM_ONLY: 4,
  FULL: 5,
  NOT_ACCEPTING_PASSENGERS: 6,
}

export function occupancyFromName(name?: string): OccupancyLevel {
  return occupancyFromEnum(name ? NAMES[name.toUpperCase()] : undefined)
}
