import { writeFileSync } from 'node:fs'
import { brand, logoGradient } from '../shared/brand.ts'

const WINDSCREEN = '<rect x="164" y="138" width="184" height="122" rx="34" fill="#000"/>'

// The windscreen is cut out of the body with a mask, so it shows whatever is behind the logo.
// "light" is for light backgrounds: orange body with white details.
const train = (shadow: boolean, variant: 'dark' | 'light' = 'dark') => {
  const light = variant === 'light'
  const body = light ? brand[600] : '#fff'
  const accent = light ? '#fff' : brand[200]
  const wheel = light ? '#fff' : brand[500]
  const hub = light ? brand[600] : '#fff'
  const leg = light ? brand[600] : '#fff'
  const id = `body-${variant}`
  return `${shadow ? `  <ellipse cx="256" cy="452" rx="120" ry="12" fill="#000" fill-opacity=".14"/>\n` : ''}  <mask id="${id}">
    <rect x="100" y="40" width="312" height="380" fill="#fff"/>
    ${WINDSCREEN}
  </mask>
  <path d="M196 396L156 448M316 396L356 448" stroke="${leg}" stroke-opacity=".9" stroke-width="16" stroke-linecap="round"/>
  <path d="M176 426h160" stroke="${leg}" stroke-opacity=".5" stroke-width="12" stroke-linecap="round"/>
  <rect x="132" y="72" width="248" height="324" rx="72" fill="${body}" mask="url(#${id})"/>
  <rect x="206" y="100" width="100" height="18" rx="9" fill="${accent}"/>
  <rect x="164" y="286" width="184" height="10" rx="5" fill="${accent}"/>
  <circle cx="202" cy="338" r="22" fill="${wheel}"/>
  <circle cx="310" cy="338" r="22" fill="${wheel}"/>
  <circle cx="202" cy="338" r="9" fill="${hub}" fill-opacity="${light ? 1 : 0.85}"/>
  <circle cx="310" cy="338" r="9" fill="${hub}" fill-opacity="${light ? 1 : 0.85}"/>
`
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="NextStop">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${logoGradient[0]}"/>
      <stop offset="1" stop-color="${logoGradient[1]}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
${train(true)}
</svg>
`
writeFileSync(new URL('../public/logo.svg', import.meta.url), svg)
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="120 60 272 400" role="img" aria-label="NextStop">
${train(false)}
</svg>
`
writeFileSync(new URL('../public/logo-mark.svg', import.meta.url), mark)
const markLight = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="120 60 272 400" role="img" aria-label="NextStop">
${train(false, 'light')}
</svg>
`
writeFileSync(new URL('../public/logo-mark-light.svg', import.meta.url), markLight)
