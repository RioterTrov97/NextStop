export interface Place {
  id: string
  name: string
  disassembledName?: string
  type?: string
  modes?: number[]
  isBest?: boolean
  /** Stop finder relevance, higher is better. */
  matchQuality?: number
  coord?: [number, number]
}

export interface Product {
  class?: number
  name?: string
}

export interface Transportation {
  id?: string
  name?: string
  number?: string
  description?: string
  disassembledName?: string
  product?: Product
  operator?: { name?: string }
  destination?: { id?: string; name?: string }
  properties?: { RealtimeTripId?: string; [k: string]: unknown }
}

export interface InfoLink {
  id?: string
  priority?: string
  type?: string
  urlText?: string
  url?: string
  subtitle?: string
  content?: string
}

export interface StopPoint {
  id?: string
  name?: string
  disassembledName?: string
  type?: string
  coord?: [number, number]
  /** The station a platform belongs to; `type` is "stop" for a real station. */
  parent?: { id?: string; name?: string; disassembledName?: string; type?: string }
  arrivalTimePlanned?: string
  arrivalTimeEstimated?: string
  departureTimePlanned?: string
  departureTimeEstimated?: string
  properties?: { platform?: string; platformName?: string; plannedPlatformName?: string; occupancy?: string; [k: string]: unknown }
}

export interface Leg {
  origin: StopPoint
  destination: StopPoint
  duration?: number
  distance?: number
  transportation?: Transportation
  stopSequence?: StopPoint[]
  infos?: InfoLink[]
  coords?: [number, number][]
  isRealtimeControlled?: boolean
  /** e.g. ["MONITORED"], or a cancellation status when the service won't run. */
  realtimeStatus?: string[]
  properties?: { [k: string]: unknown }
  footPathInfo?: unknown[]
}

export interface Journey {
  legs: Leg[]
  interchanges?: number
  isAdditional?: boolean
}

export interface StopEvent {
  departureTimePlanned?: string
  departureTimeEstimated?: string
  isRealtimeControlled?: boolean
  realtimeStatus?: string[]
  /** RealtimeTripId lives here on departures, not on the transportation as in trip legs. */
  properties?: { RealtimeTripId?: string; [k: string]: unknown }
  location?: StopPoint
  transportation?: Transportation
  infos?: InfoLink[]
}

export interface AlertAffected {
  lines?: { id?: string; number?: string; name?: string; product?: Product }[]
  stops?: { id?: string; name?: string }[]
}

export interface Alert {
  id: string
  priority?: 'veryHigh' | 'high' | 'normal' | 'low' | 'veryLow' | string
  type?: string
  subtitle?: string
  content?: string
  url?: string
  urlText?: string
  affected?: AlertAffected
  timestamps?: { lastModification?: string; creation?: string; validity?: { from?: string; to?: string }[] }
  /** "trackwork" marks planned engineering work, the cause of most replacement buses. */
  properties?: { announcementType?: string; [k: string]: unknown }
}
