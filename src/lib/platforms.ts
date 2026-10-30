import type { StopPoint, Transportation } from '../api/types'
import { MODES } from './lines'

/**
 * Where a service leaves from, by kind. Numbered platforms are trains or metro; lettered stands are buses,
 * including the temporary buses that replace trains during trackwork; light rail and ferries have named stops.
 */
export type PlatformKind = 'train' | 'metro' | 'lightrail' | 'bus' | 'replacement' | 'ferry'

export interface PlatformInfo {
  kind: PlatformKind
  /** Short tag for chips and pills: "18", "E", "A2", "Chalmers St". */
  label: string
  /** Full name: "Platform 18", "Stand E", "Chalmers St". */
  long: string
  /** Street or area for bus stands, e.g. "Elizabeth St". */
  detail?: string
  /** Unique per platform at a station, for filtering. */
  key: string
}

const KIND_ORDER: PlatformKind[] = ['train', 'metro', 'lightrail', 'bus', 'replacement', 'ferry']

export const PLATFORM_KINDS: Record<PlatformKind, { label: string; color: string }> = {
  train: { label: 'Train platforms', color: MODES[0].color },
  metro: { label: 'Metro platforms', color: MODES[1].color },
  lightrail: { label: 'Light rail', color: MODES[2].color },
  bus: { label: 'Bus stands', color: MODES[3].color },
  // Same bus blue, darker, so a replacement stand reads as a bus but stands apart from regular routes.
  replacement: { label: 'Replacement buses', color: '#0072A3' },
  ferry: { label: 'Ferry wharves', color: MODES[4].color },
}

/** Temporary buses run during trackwork; the planner names their product "Temporary buses". */
export const isReplacementBus = (t?: Transportation) => /temporary bus|replacement/i.test(`${t?.product?.name ?? ''} ${t?.name ?? ''}`)

function kindOf(t?: Transportation): PlatformKind | undefined {
  const cls = t?.product?.class
  if (cls === 1) return 'train'
  if (cls === 2) return 'metro'
  if (cls === 4) return 'lightrail'
  if (cls === 9) return 'ferry'
  if (cls === 5 || cls === 7 || cls === 11) return isReplacementBus(t) ? 'replacement' : 'bus'
}

const strip0 = (s: string) => s.replace(/^0+(?=\d)/, '')

/** Platform, stand or stop name for where a service leaves from; undefined when the planner gives none. */
export function platformInfo(point: StopPoint | undefined, t: Transportation | undefined): PlatformInfo | undefined {
  const kind = kindOf(t)
  if (!point || !kind) return undefined
  const code = point.properties?.platform ?? ''
  const name = point.properties?.platformName ?? point.properties?.plannedPlatformName ?? point.disassembledName ?? point.name ?? ''

  if (kind === 'train' || kind === 'metro') {
    // "Platform 18", or the code "CE18" / "SD07" (station prefix + number).
    const n = name.match(/platform\s*(\w+)/i)?.[1] ?? code.match(/(\d+[A-Za-z]?)$/)?.[1]
    if (!n) return undefined
    const label = strip0(n)
    return { kind, label, long: `Platform ${label}`, key: `${kind}:${label}` }
  }
  if (kind === 'bus' || kind === 'replacement') {
    // "Central Station, Elizabeth St, Stand E" with code "E"; Parramatta's "Stand A2".
    const stand = name.match(/stand\s*(\w+)/i)?.[1] ?? (/^[A-Z]{1,2}\d{0,2}$/.test(code) ? code : undefined)
    const parts = name.split(',').map((s) => s.trim())
    const street = parts.find((p, i) => i > 0 && !/stand|platform/i.test(p) && /\b(st|rd|ave|pde|pl|dr|hwy|way|ln|cct)\b/i.test(p))
    if (!stand) return street ? { kind, label: street, long: street, key: `${kind}:${street}` } : undefined
    return { kind, label: stand, long: `Stand ${stand}`, detail: street, key: `${kind}:${stand}` }
  }
  // Light rail and ferries: a named stop, e.g. "Central Chalmers Street Light Rail" -> "Chalmers Street".
  const station = (point.parent?.disassembledName ?? point.parent?.name ?? '').replace(/ Station.*$/i, '').split(',')[0]
  const cleaned =
    name
      .split(',')
      .map((s) => s.trim())
      .find((p) => /light rail|wharf/i.test(p)) ?? name
  const label =
    cleaned
      .replace(/ light rail$/i, '')
      .replace(new RegExp(`^${station.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'), '')
      .trim() || code
  if (!label) return undefined
  return { kind, label, long: label, key: `${kind}:${label}` }
}

/** Platforms in the order people scan a board: trains, metro, light rail, buses, replacement buses, ferries; numbers numerically. */
export function comparePlatforms(a: PlatformInfo, b: PlatformInfo): number {
  return (
    KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
    a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })
  )
}
