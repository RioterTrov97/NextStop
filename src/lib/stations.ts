import type { Place } from '../api/types'

// Bundled so quick picks never need a stop-finder call. Ids are TfNSW stop ids; modes 1 = train, 2 = metro.
export const QUICK_STATIONS: Place[] = [
  { id: '214110', name: 'Lidcombe Station, Lidcombe', disassembledName: 'Lidcombe Station', type: 'stop', modes: [1, 5, 11] },
  { id: '200080', name: 'Wynyard Station, Sydney', disassembledName: 'Wynyard Station', type: 'stop', modes: [1, 4, 5, 11] },
  { id: '213510', name: 'Strathfield Station, Strathfield', disassembledName: 'Strathfield Station', type: 'stop', modes: [1, 5, 7, 11] },
  { id: '219410', name: 'Campsie Station, Campsie', disassembledName: 'Campsie Station', type: 'stop', modes: [2, 5, 11] },
  { id: '213410', name: 'Burwood Station, Burwood', disassembledName: 'Burwood Station', type: 'stop', modes: [1, 5, 11] },
  { id: '200060', name: 'Central Station, Sydney', disassembledName: 'Central Station', type: 'stop', modes: [1, 2, 4, 5, 7, 11] },
  { id: '200070', name: 'Town Hall Station, Sydney', disassembledName: 'Town Hall Station', type: 'stop', modes: [1, 4, 5, 11] },
  { id: '201510', name: 'Redfern Station, Eveleigh', disassembledName: 'Redfern Station', type: 'stop', modes: [1, 5] },
  { id: '215020', name: 'Parramatta Station, Parramatta', disassembledName: 'Parramatta Station', type: 'stop', modes: [1, 5, 7, 11] },
]
