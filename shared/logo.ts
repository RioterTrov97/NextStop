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

/** A rounded rectangle as a path, so windows can be cut out of a vehicle with the even-odd rule. */
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`

// Side views facing right (direction of travel), wheels resting on the orbit line at y = 0.
const BUS = [rr(-18, -20, 36, 14, 3.5), rr(-15, -17, 7, 5, 1), rr(-6, -17, 7, 5, 1), rr(3, -17, 7, 5, 1), rr(12, -17, 4, 7, 1)].join('')
const BUS_WHEELS = '<circle cx="-10" cy="-5.5" r="3.4"/><circle cx="10" cy="-5.5" r="3.4"/>'
const TRAM =
  'M-21 -19H15Q21 -19 22 -12V-8H-21Z' +
  [rr(-18, -16, 8, 4.5, 1), rr(-8, -16, 8, 4.5, 1), rr(2, -16, 8, 4.5, 1), rr(13, -16, 6, 4.5, 1)].join('')
const TRAM_EXTRAS = '<rect x="-16" y="-8" width="8" height="3.5"/><rect x="8" y="-8" width="8" height="3.5"/>'

/** Places a vehicle on the orbit at angle t (radians), turned along the line. */
function onOrbit(t: number, body: string) {
  const x = 120 + 105 * Math.cos(t)
  const y = 120 + 34 * Math.sin(t)
  // Travelling with the orbit: right along the bottom, then up the right-hand side.
  const angle = (Math.atan2(-34 * Math.cos(t), 105 * Math.sin(t)) * 180) / Math.PI
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)}) translate(0 -3)">${body}</g>`
}

/** The mark's SVG elements (no <svg> wrapper), for embedding. */
export function markBody({ pin, ring, vehicles = true, id = 'ns' }: MarkOptions): string {
  const ride = vehicles
    ? `<g fill="${ring}" fill-rule="evenodd">${onOrbit(0.82 * Math.PI, `<path d="${BUS}"/>${BUS_WHEELS}`)}${onOrbit(
        0.2 * Math.PI,
        `<path d="M-3 -19L1 -25L5 -19" fill="none" stroke="${ring}" stroke-width="1.8" stroke-linejoin="round"/><path d="${TRAM}"/>${TRAM_EXTRAS}`,
      )}</g>`
    : ''
  return `<defs>
    <mask id="${id}-pin" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240">
      <path d="${PIN}" fill="#fff"/>
      <rect x="92" y="58" width="56" height="62" rx="16" fill="#000"/>
      <rect x="100" y="67" width="40" height="22" rx="6" fill="#fff"/>
      <circle cx="106" cy="105" r="5" fill="#fff"/>
      <circle cx="134" cy="105" r="5" fill="#fff"/>
      <path d="M104 124L98 134M136 124L142 134" stroke="#000" stroke-width="5" stroke-linecap="round"/>
      <path d="${FRONT}" transform="${TILT}" fill="none" stroke="#000" stroke-width="17"/>
    </mask>
    <mask id="${id}-back" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240">
      <rect width="240" height="240" fill="#fff"/>
      <path d="${PIN}" fill="#000"/>
    </mask>
  </defs>
  <path d="${BACK}" transform="${TILT}" fill="none" stroke="${ring}" stroke-width="7" stroke-linecap="round" mask="url(#${id}-back)"/>
  <path d="${PIN}" fill="${pin}" mask="url(#${id}-pin)"/>
  <g transform="${TILT}">
    <path d="${FRONT}" fill="none" stroke="${ring}" stroke-width="7" stroke-linecap="round"/>
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
