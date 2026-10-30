import type { Place } from '../api/types'
import stationRows from '../data/stations.json'

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

type StationRow = [id: string, name: string, modes: number[]]

// Every train and metro station, regenerated from the TfNSW timetables with `npm run stations`.
const ALL_STATIONS: Place[] = (stationRows as StationRow[]).map(([id, name, modes]) => ({
  id,
  name,
  disassembledName: name,
  type: 'stop',
  modes,
}))

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bstation\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const INDEX = ALL_STATIONS.map((p) => ({ p, n: normalise(p.name) }))

/**
 * Stations matching what the user has typed so far, best first, answered on the device with no network wait:
 * exact name, then name starting with it, then every typed word starting a word of the name, then anywhere in it.
 */
export function searchStations(text: string, limit = 3): Place[] {
  const q = normalise(text)
  if (!q) return []
  const words = q.split(' ')
  const scored: { p: Place; n: string; score: number }[] = []
  for (const { p, n } of INDEX) {
    const nameWords = n.split(' ')
    const score =
      n === q ? 0 : n.startsWith(q) ? 1 : words.every((w) => nameWords.some((nw) => nw.startsWith(w))) ? 2 : n.includes(q) ? 3 : -1
    if (score >= 0) scored.push({ p, n, score })
  }
  return scored
    .sort((a, b) => a.score - b.score || a.n.length - b.n.length || a.n.localeCompare(b.n))
    .slice(0, limit)
    .map((s) => s.p)
}
