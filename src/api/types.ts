export interface Place {
  id: string
  name: string
  disassembledName?: string
  type?: string
  modes?: number[]
  isBest?: boolean
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
  destination?: { name?: string }
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
  arrivalTimePlanned?: string
  arrivalTimeEstimated?: string
  departureTimePlanned?: string
  departureTimeEstimated?: string
  properties?: { platform?: string; plannedPlatformName?: string; occupancy?: string; [k: string]: unknown }
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
  timestamps?: { lastModification?: string; creation?: string }
}
