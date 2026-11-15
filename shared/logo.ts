// The NextStop mark, drawn once and used by the icon generator (scripts/generate-logo.ts) and the in-app BrandMark.
//
// A location pin with a train front cut into it, circled by a tilted orbit. The orbit passes behind the pin at the top
// and in front of it at the bottom, with a gap cut into the pin where it crosses, and carries a bus and a light rail
// tram riding on it. Everything is cut with masks rather than painted in a background colour, so the mark sits on any
// background. Coordinates are in a 240 x 240 box.

export interface MarkColours {
  /** The pin. */
  pin: string
  /** The orbit and the vehicles riding on it. */
  ring: string
}

export interface MarkOptions extends MarkColours {
  /** Draw the bus and tram on the orbit (the full logo); off for small sizes such as the app icon. */
  vehicles?: boolean
  /** Prefix for mask ids, unique per mark on a page. */
  id?: string
}

const PIN = 'M120 206C120 206 56 142 56 96A64 64 0 0 1 184 96C184 142 120 206 120 206Z'
// The orbit, drawn in a frame turned 18 degrees anticlockwise: the back half over the top, the front half underneath.
const TILT = 'rotate(-18 120 120)'
const BACK = 'M15 120A105 34 0 0 1 225 120'
const FRONT = 'M225 120A105 34 0 0 1 15 120'

// The orbit ellipse in the tilted frame: centre (120, 120), radii 105 and 34. The front half runs t = 0 to pi.
const A = 105
const B = 34
/** Width of the orbit line. */
const LINE = 4.5

type Pt = [number, number]

// Arc length along the orbit, in the direction of travel (decreasing t: right along the bottom, then up the right).
const STEPS = 4000
const T0 = -0.3 * Math.PI
const T1 = 1.3 * Math.PI
const lengthAt: number[] = [0]
for (let i = 1; i <= STEPS; i++) {
  const t = T1 - ((T1 - T0) * (i - 0.5)) / STEPS
  lengthAt.push(lengthAt[i - 1] + Math.hypot(A * Math.sin(t), B * Math.cos(t)) * ((T1 - T0) / STEPS))
}
const tAt = (i: number) => T1 - ((T1 - T0) * i) / STEPS
const sOf = (t: number) => {
  const i = (T1 - t) / ((T1 - T0) / STEPS)
  const k = Math.max(0, Math.min(STEPS - 1, Math.floor(i)))
  return lengthAt[k] + (lengthAt[k + 1] - lengthAt[k]) * (i - k)
}
const tOf = (len: number) => {
  let lo = 0
  let hi = STEPS
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (lengthAt[mid] < len) lo = mid
    else hi = mid
  }
  const f = (len - lengthAt[lo]) / (lengthAt[hi] - lengthAt[lo] || 1)
  return tAt(lo + f)
}

/**
 * Bends a point of a vehicle drawn flat onto the orbit: `u` runs along the line in the direction of travel, `h` is the
 * height above the line's centre. The vehicle's centre sits at angle `t0`, so every part follows the curve.
 */
function bend(t0: number, [u, h]: Pt): Pt {
  const t = tOf(sOf(t0) + u)
  const normal = (tt: number): Pt => {
    const tx = A * Math.sin(tt)
    const ty = -B * Math.cos(tt)
    const n = Math.hypot(tx, ty)
    // The side the vehicle stands on (up, where the orbit runs along the bottom).
    return [ty / n, -tx / n]
  }
  // Half the local normal and half the vehicle's own: the body follows the curve without fanning out where the orbit
  // turns tightly.
  const [ax, ay] = normal(t)
  const [bx, by] = normal(t0)
  const m = Math.hypot(ax + bx, ay + by)
  return [120 + A * Math.cos(t) + (h * (ax + bx)) / m, 120 + B * Math.sin(t) + (h * (ay + by)) / m]
}

/** Points along an arc around (cu, ch), angles in radians with h pointing up. */
const arc = (cu: number, ch: number, r: number, a0: number, a1: number, n = 8): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n
    return [cu + r * Math.cos(a), ch + r * Math.sin(a)] as Pt
  })

/** A rounded rectangle from (u0, h0) to (u1, h1). */
const box = (u0: number, h0: number, u1: number, h1: number, r: number): Pt[] => [
  ...arc(u1 - r, h0 + r, r, -Math.PI / 2, 0, 3),
  ...arc(u1 - r, h1 - r, r, 0, Math.PI / 2, 3),
  ...arc(u0 + r, h1 - r, r, Math.PI / 2, Math.PI, 3),
  ...arc(u0 + r, h0 + r, r, Math.PI, 1.5 * Math.PI, 3),
]

/** A wheel arch cut into the skirt over a wheel at u, its top `r` above the axle at height `axle`. */
const archOver = (u: number, axle: number, r: number, skirt: number): Pt[] => [
  [u - r, skirt],
  ...arc(u, axle, r, Math.PI, 0, 10),
  [u + r, skirt],
]

/** A closed shape bent onto the orbit, as path data. Straight edges are split up so they curve with the line. */
function shape(t0: number, pts: Pt[]): string {
  const fine: Pt[] = []
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]
    const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 1.5))
    for (let k = 0; k < n; k++) fine.push([p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n])
  })
  return `M${fine.map((p) => bend(t0, p).map((v) => v.toFixed(2)).join(' ')).join('L')}Z`
}

/** A wheel with a hub, centred on a bent point. */
function wheel(t0: number, at: Pt, r: number): string {
  const [x, y] = bend(t0, at)
  const circle = (rad: number) => `M${(x - rad).toFixed(2)} ${y.toFixed(2)}a${rad} ${rad} 0 1 0 ${2 * rad} 0a${rad} ${rad} 0 1 0 ${-2 * rad} 0`
  return circle(r) + circle(r * 0.38)
}

// Vehicles are drawn flat, facing the direction of travel (+u), then bent onto the orbit. Wheels clear the line by a
// hair. Windows are cut out with the even-odd rule, so the mark works on any background.

/** A low-floor city bus: sloped windscreen, three side windows and a front door, wheels in arches. */
function bus(t0: number, fill: string): string {
  const axle = LINE / 2 + 0.2 + 3.2
  const skirt = 4.6
  const body: Pt[] = [
    [-20, skirt],
    ...archOver(-11, axle, 4.2, skirt),
    ...archOver(11, axle, 4.2, skirt),
    [19.6, skirt],
    ...arc(19.6, skirt + 1, 1, -Math.PI / 2, 0, 3),
    [20.8, 12.5],
    ...arc(17, 16, 3.8, 0.1, Math.PI / 2, 8),
    ...arc(-17.6, 17.4, 2.4, Math.PI / 2, Math.PI, 4),
    [-20, skirt + 0.6],
  ]
  const holes = [
    box(-17.6, 11.2, -11.2, 17, 1),
    box(-9.8, 11.2, -3.4, 17, 1),
    box(-2, 11.2, 4.6, 17, 1),
    box(6.6, 6.6, 11, 17, 0.8),
    [[12.6, 11.2], [19.2, 11.2], [18.8, 14.8], [17, 17.3], [12.6, 17.3]] as Pt[],
  ]
  return `<path fill="${fill}" fill-rule="evenodd" d="${[body, ...holes].map((p) => shape(t0, p)).join('')}"/>
    <path fill="${fill}" fill-rule="evenodd" d="${wheel(t0, [-11, axle], 3.2)}${wheel(t0, [11, axle], 3.2)}"/>`
}

/** A light rail tram: long low body with sloped noses, an articulation joint, a window band and a pantograph. */
function tram(t0: number, fill: string): string {
  const axle = LINE / 2 + 0.2 + 2.4
  const skirt = 3.8
  const body: Pt[] = [
    [-22.6, skirt],
    ...archOver(-15, axle, 3.3, skirt),
    ...archOver(15, axle, 3.3, skirt),
    [22.6, skirt],
    [24, 6.5],
    [24.2, 9],
    [22.6, 14],
    [20.4, 17.6],
    [19, 18.2],
    [-19, 18.2],
    [-20.4, 17.6],
    [-22.6, 14],
    [-24.2, 9],
    [-24, 6.5],
  ]
  const holes: Pt[][] = [
    [[19.4, 10.2], [23.2, 10.2], [22, 13.6], [20.4, 16.2], [19.4, 16.2]],
    box(-17.6, 10.2, -10, 16, 1),
    box(-6.6, 10.2, -0.9, 16, 1),
    box(0.9, 10.2, 6.6, 16, 1),
    box(10, 10.2, 17.6, 16, 1),
    // The joints between the modules.
    box(-8.7, 5, -7.9, 17.2, 0.3),
    box(7.9, 5, 8.7, 17.2, 0.3),
  ]
  const pantograph: Pt[][] = [
    box(-4, 17.4, 3, 19.8, 0.8),
    [[-2.4, 19.4], [-0.6, 19.4], [3.6, 24], [1.8, 24]],
    box(-0.4, 23.2, 6.4, 24.8, 0.8),
  ]
  // Drawn at full length, then shortened to fit the tighter curve on the right of the orbit.
  const k = 0.8
  const fit = (p: Pt[]) => shape(t0, p.map(([u, h]) => [u * k, h] as Pt))
  return `<path fill="${fill}" fill-rule="evenodd" d="${[body, ...holes].map(fit).join('')}"/>
    <path fill="${fill}" d="${pantograph.map(fit).join('')}"/>
    <path fill="${fill}" fill-rule="evenodd" d="${wheel(t0, [-15 * k, axle], 2.4)}${wheel(t0, [15 * k, axle], 2.4)}"/>`
}

/** The mark's SVG elements (no <svg> wrapper), for embedding. */
export function markBody({ pin, ring, vehicles = true, id = 'ns' }: MarkOptions): string {
  const ride = vehicles ? `${bus(0.75 * Math.PI, ring)}${tram(0.2 * Math.PI, ring)}` : ''
  return `<defs>
    <mask id="${id}-pin" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240">
      <path d="${PIN}" fill="#fff"/>
      <rect x="92" y="58" width="56" height="62" rx="16" fill="#000"/>
      <rect x="100" y="67" width="40" height="22" rx="6" fill="#fff"/>
      <circle cx="106" cy="105" r="5" fill="#fff"/>
      <circle cx="134" cy="105" r="5" fill="#fff"/>
      <path d="M104 124L98 134M136 124L142 134" stroke="#000" stroke-width="5" stroke-linecap="round"/>
      <path d="${FRONT}" transform="${TILT}" fill="none" stroke="#000" stroke-width="${LINE + 8}"/>
    </mask>
    <mask id="${id}-back" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240">
      <rect width="240" height="240" fill="#fff"/>
      <path d="${PIN}" fill="#000"/>
    </mask>
  </defs>
  <path d="${BACK}" transform="${TILT}" fill="none" stroke="${ring}" stroke-width="${LINE}" stroke-linecap="round" mask="url(#${id}-back)"/>
  <path d="${PIN}" fill="${pin}" mask="url(#${id}-pin)"/>
  <g transform="${TILT}">
    <path d="${FRONT}" fill="none" stroke="${ring}" stroke-width="${LINE}" stroke-linecap="round"/>
    ${ride}
  </g>`
}

/** A standalone SVG of the mark. */
export function markSvg(options: MarkOptions & { label?: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="${options.label ?? 'NextStop'}">
  ${markBody(options)}
</svg>
`
}
