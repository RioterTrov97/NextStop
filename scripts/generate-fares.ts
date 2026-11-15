// Rebuilds src/data/fares.json from the TfNSW "Opal Fares" open dataset: the fare band (1-5) between every pair of
// train and metro stations, from the official over-the-track distances, and which stations use Intercity peak times.
// Fare values themselves live in src/lib/fares.ts; update both when fares change (usually each July).
// Usage: node scripts/generate-fares.ts   (no API key needed; needs `unzip` on PATH)
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DATASET = 'https://opendata.transport.nsw.gov.au/data/api/3/action/package_show?id=opal-fares'

interface Resource {
  name: string
  url: string
  format?: string
}

const pkg = (await (await fetch(DATASET)).json()) as { result: { resources: Resource[] } }
const res = pkg.result.resources.find((r) => /distance tables/i.test(r.name) && /xlsx/i.test(r.format ?? r.url))
if (!res) throw new Error('No Opal distance tables spreadsheet in the dataset')

const dir = mkdtempSync(join(tmpdir(), 'nextstop-opal-'))
try {
  const xlsx = join(dir, 'opal.xlsx')
  const file = await fetch(res.url)
  if (!file.ok) throw new Error(`${res.url}: HTTP ${file.status}`)
  writeFileSync(xlsx, Buffer.from(await file.arrayBuffer()))
  const read = (path: string) => execFileSync('unzip', ['-p', xlsx, path], { maxBuffer: 1 << 28 }).toString('utf8')

  const decode = (s: string) =>
    s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
  const strings = [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')),
  )
  const rels = new Map(
    [...read('xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g)].map((m) => [m[1], m[2]]),
  )
  const sheets = new Map(
    [...read('xl/workbook.xml').matchAll(/<sheet [^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"/g)].map((m) => [
      decode(m[1]),
      rels.get(m[2])!.replace(/^\/?(xl\/)?/, 'xl/'),
    ]),
  )

  /** A sheet as rows of cells, indexed by column number (A is 0). */
  const sheet = (name: string): (string | number | undefined)[][] => {
    const rows: (string | number | undefined)[][] = []
    for (const row of read(sheets.get(name)!).matchAll(/<row [^>]*?r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: (string | number | undefined)[] = []
      for (const c of row[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const col = [...c[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
        const v = c[3]?.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        const inline = c[3]?.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1]
        if (/t="s"/.test(c[2]) && v !== undefined) cells[col] = strings[Number(v)]
        else if (/t="(str|inlineStr)"/.test(c[2])) cells[col] = decode(v ?? inline ?? '')
        else if (v !== undefined) cells[col] = Number(v)
      }
      rows[Number(row[1]) - 1] = cells
    }
    return rows
  }

  // The newest over-the-track table: "2026 New Rail Track Distance" replaced "Rail" when city distances changed.
  const railName =
    [...sheets.keys()]
      .filter((n) => /rail track distance/i.test(n))
      .sort()
      .pop() ?? [...sheets.keys()].find((n) => n.trim() === 'Rail')
  if (!railName) throw new Error('No rail distance sheet')
  // Columns: station number, TSN (the stop id the trip planner uses), name, then one column per station (lower triangle).
  const rail = sheet(railName).filter((r) => r && typeof r[1] === 'number')
  const ids = rail.map((r) => String(r[1]))
  const band = (km: number) => (km <= 10 ? 1 : km <= 20 ? 2 : km <= 35 ? 3 : km <= 65 ? 4 : 5)
  let bands = ''
  for (let i = 1; i < rail.length; i++) {
    for (let j = 0; j < i; j++) {
      const km = rail[i][3 + j]
      if (typeof km !== 'number') throw new Error(`No distance between ${rail[i][2]} and ${rail[j][2]}`)
      bands += band(km)
    }
  }

  // Intercity stations (NSW TrainLink areas) have their own, earlier morning peak.
  // The list names some stations differently ("Bomaderry (Nowra)", "Bathurst Station").
  const norm = (s: unknown) =>
    String(s ?? '')
      .replace(/\s*\(.*\)|\s+Station$/gi, '')
      .trim()
      .toLowerCase()
  const area = new Map(
    sheet('List of Trains')
      .filter(Boolean)
      .map((r) => [norm(r[1]), String(r[2] ?? '')]),
  )
  const intercity = rail.filter((r) => /trainlink/i.test(area.get(norm(r[2])) ?? '')).map((r) => String(r[1]))

  writeFileSync('src/data/fares.json', JSON.stringify({ source: railName, stations: ids, bands, intercity }) + '\n')
  process.stdout.write(`Wrote ${ids.length} stations (${intercity.length} Intercity) from "${railName}" to src/data/fares.json\n`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
