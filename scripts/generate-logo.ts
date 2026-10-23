import { writeFileSync } from 'node:fs'
import { brand, logoGradient } from '../shared/brand.ts'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="NextStop">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${logoGradient[0]}"/>
      <stop offset="1" stop-color="${logoGradient[1]}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <path d="M96 424c60-36 96-20 160-20s100-16 160-52" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="14" stroke-linecap="round" stroke-dasharray="2 30"/>
  <rect x="156" y="96" width="200" height="236" rx="52" fill="#fff"/>
  <rect x="184" y="126" width="144" height="84" rx="22" fill="#111827"/>
  <path d="M256 126v84" stroke="#fff" stroke-width="8"/>
  <circle cx="198" cy="268" r="19" fill="${brand[500]}"/>
  <circle cx="314" cy="268" r="19" fill="${brand[500]}"/>
  <path d="M190 332l-26 44M322 332l26 44" stroke="#fff" stroke-width="16" stroke-linecap="round"/>
</svg>
`
writeFileSync(new URL('../public/logo.svg', import.meta.url), svg)
