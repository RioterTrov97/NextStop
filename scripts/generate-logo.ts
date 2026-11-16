import { writeFileSync } from 'node:fs'
import { brand, logoGradient } from '../shared/brand.ts'
import { markBody, markSvg } from '../shared/logo.ts'

const out = (name: string, svg: string) => writeFileSync(new URL(`../public/${name}`, import.meta.url), svg)

// The app icon: the mark without the vehicles (they would be specks on a home screen), white pin and pale orbit
// on a square in the app colour. pwa-assets-generator turns this into the PNG icons and favicon.
out(
  'logo.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="NextStop">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${logoGradient[0]}"/>
      <stop offset="1" stop-color="${logoGradient[1]}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <g transform="translate(52 44) scale(1.7)">
  ${markBody({ pin: '#fff', ring: brand[200], vehicles: false, id: 'icon' })}
  </g>
</svg>
`,
)

// The full logo with the bus and tram, for dark backgrounds and for light ones.
// One look on light and dark pages: the mark in the app colour with a white train.
out('logo-mark.svg', markSvg({ pin: brand[600], ring: brand[600], train: '#fff', id: 'dark' }))
out('logo-mark-light.svg', markSvg({ pin: brand[600], ring: brand[600], train: '#fff', id: 'light' }))
