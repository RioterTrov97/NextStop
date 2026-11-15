export interface ModeInfo {
  key: 'train' | 'metro' | 'lightrail' | 'bus' | 'ferry' | 'walk'
  label: string
  color: string
  classes: number[]
}

export const MODES: ModeInfo[] = [
  { key: 'train', label: 'Train', color: '#F99D1C', classes: [1] },
  { key: 'metro', label: 'Metro', color: '#168388', classes: [2] },
  { key: 'lightrail', label: 'Light rail', color: '#BE1622', classes: [4] },
  { key: 'bus', label: 'Bus', color: '#00B5EF', classes: [5, 7, 11] },
  { key: 'ferry', label: 'Ferry', color: '#5AB031', classes: [9] },
]

const WALK: ModeInfo = { key: 'walk', label: 'Walk', color: '#242b34', classes: [99, 100, 107] }

export function modeForClass(cls?: number): ModeInfo {
  return MODES.find((m) => cls !== undefined && m.classes.includes(cls)) ?? WALK
}

/**
 * Line colours from the TfNSW Transport Network Colour Chart
 * (https://opendata.transport.nsw.gov.au/developers/resources#TNCC, checked 2026-11-07). Brand rules: use these
 * exact values, unmodified. Lines not listed (buses, private ferries, regional services) use their mode colour.
 */
export const LINE_COLOURS: Record<string, string> = {
  M1: '#168388',
  T1: '#F99D1C',
  T2: '#0098CD',
  T3: '#F37021',
  T4: '#005AA3',
  T5: '#C4258F',
  T6: '#7C3E21',
  T7: '#6F818E',
  T8: '#00954C',
  T9: '#D11F2F',
  // Intercity
  BMT: '#F99D1C',
  CCN: '#D11F2F',
  HUN: '#833134',
  SCO: '#005AA3',
  SHL: '#00954C',
  // Sydney Ferries (the chart notes F10 may change) and Newcastle's Stockton ferry
  F1: '#00774B',
  F2: '#144734',
  F3: '#648C3C',
  F4: '#BFD730',
  F5: '#286142',
  F6: '#00AB51',
  F7: '#00B189',
  F8: '#55622B',
  F9: '#65B32E',
  F10: '#5AB031',
  STKN: '#5AB031',
  // Light rail
  L1: '#BE1622',
  L2: '#DD1E25',
  L3: '#781140',
  L4: '#BB2043',
  NLR: '#EE343F',
}

// The planner names intercity lines in full ("Blue Mountains Line"), with the code only in `disassembledName`.
const INTERCITY_NAMES: [RegExp, string][] = [
  [/^blue mountains\b/i, 'BMT'],
  [/^central coast\b/i, 'CCN'],
  [/^hunter\b/i, 'HUN'],
  [/^south coast\b/i, 'SCO'],
  [/^southern highlands\b/i, 'SHL'],
]

/** The official code of a line with a colour in the chart ("T2 Inner West & Leppington Line" -> "T2"), if any. */
export function lineCode(number?: string): string | undefined {
  const raw = number?.trim()
  if (!raw) return undefined
  const named = INTERCITY_NAMES.find(([re]) => re.test(raw))?.[1]
  if (named) return named
  const code = raw.match(/^([A-Z]{1,4}\d{0,2})\b/i)?.[1].toUpperCase()
  return code && LINE_COLOURS[code] ? code : undefined
}

/** Compact line label for tiles: "T2 Inner West & Leppington Line" -> "T2", "Blue Mountains Line" -> "BMT". */
export function shortLineName(number?: string): string {
  const raw = number?.trim()
  if (!raw) return '·'
  const official = lineCode(raw)
  if (official) return official
  const code = raw.match(/^[A-Z]{1,3}\d{1,2}\b/i)?.[0]
  if (code) return code.toUpperCase()
  const words = raw.split(/\s+/).filter((w) => w.toLowerCase() !== 'line')
  if (words[0].length <= 4) return words[0]
  return words
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export function lineColor(number: string | undefined, cls?: number): string {
  const code = lineCode(number)
  return (code && LINE_COLOURS[code]) || modeForClass(cls).color
}

/** Mode filter keys -> trip planner "excluded means" params. */
export function exclusionParams(selected: string[]): Record<string, string> {
  if (!selected.length) return {}
  const out: Record<string, string> = {}
  for (const m of MODES) {
    if (selected.includes(m.key)) continue
    out.excludedMeans = 'checkbox'
    for (const c of m.classes) out[`exclMOT_${c}`] = String(c)
  }
  return out
}
