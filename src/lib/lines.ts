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

const WALK: ModeInfo = { key: 'walk', label: 'Walk', color: '#64748b', classes: [99, 100, 107] }

export function modeForClass(cls?: number): ModeInfo {
  return MODES.find((m) => cls !== undefined && m.classes.includes(cls)) ?? WALK
}

const TRAIN_LINES: Record<string, string> = {
  T1: '#F99D1C',
  T2: '#0098CD',
  T3: '#F37021',
  T4: '#005AA3',
  T5: '#C4258F',
  T6: '#456CAC',
  T7: '#6F818E',
  T8: '#00954C',
  T9: '#D11F2F',
}

const LIGHT_RAIL: Record<string, string> = { L1: '#BE1622', L2: '#DD1E25', L3: '#781140', L4: '#E4022D' }

export function lineColor(number: string | undefined, cls?: number): string {
  const key = number?.toUpperCase().match(/^[TLM]\d+/)?.[0]
  if (key && TRAIN_LINES[key]) return TRAIN_LINES[key]
  if (key && LIGHT_RAIL[key]) return LIGHT_RAIL[key]
  return modeForClass(cls).color
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
