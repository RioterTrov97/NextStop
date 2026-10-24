import { writeFileSync } from 'node:fs'
import { brand, logoGradient } from '../shared/brand.ts'

const train = (shadow: boolean) => `${shadow ? `  <ellipse cx="256" cy="452" rx="120" ry="12" fill="#000" fill-opacity=".14"/>` : ''}
  <path d="M196 396L156 448M316 396L356 448" stroke="#fff" stroke-opacity=".9" stroke-width="16" stroke-linecap="round"/>
  <path d="M176 426h160" stroke="#fff" stroke-opacity=".5" stroke-width="12" stroke-linecap="round"/>
  <rect x="132" y="72" width="248" height="324" rx="72" fill="#fff"/>
  <rect x="206" y="100" width="100" height="18" rx="9" fill="${brand[200]}"/>
  <rect x="164" y="138" width="184" height="122" rx="34" fill="#1F2937"/>
  <path d="M190 148h56l-44 102h-36a14 14 0 0 1-14-14v-76a12 12 0 0 1 12-12Z" fill="#fff" fill-opacity=".1"/>
  <rect x="164" y="286" width="184" height="10" rx="5" fill="${brand[200]}"/>
  <circle cx="202" cy="338" r="22" fill="${brand[500]}"/>
  <circle cx="310" cy="338" r="22" fill="${brand[500]}"/>
  <circle cx="202" cy="338" r="9" fill="#fff" fill-opacity=".85"/>
  <circle cx="310" cy="338" r="9" fill="#fff" fill-opacity=".85"/>
`

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
