import type { VehicleInfo, VehicleMode } from '../shared/vehicles'
import { decodeVehiclePositions } from './vehicles'

export interface Env {
  TFNSW_API_KEY: string
  ASSETS: Fetcher
}

const API = 'https://api.transport.nsw.gov.au'
const TP_VERSION = '10.2.1.42'

const TP_ENDPOINTS: Record<string, { ttl: number; params: RegExp }> = {
  stop_finder: { ttl: 86400, params: /^(type_sf|name_sf|TfNSWSF|anyObjFilter_sf|anyMaxSizeHitList)$/ },
  trip: {
    // Short enough that the 15s client refresh never reads a copy older than the 15s delay feed behind it.
    ttl: 5,
    params:
      /^(depArrMacro|itdDate|itdTime|type_origin|name_origin|type_destination|name_destination|calcNumberOfTrips|TfNSWTR|excludedMeans|exclMOT_\d+|maxChanges|routeType|type_via|name_via|wheelchair|changeSpeed)$/,
  },
  departure_mon: {
    ttl: 10,
    params: /^(mode|type_dm|name_dm|itdDate|itdTime|departureMonitorMacro|TfNSWDM|excludedMeans|exclMOT_\d+)$/,
  },
  add_info: { ttl: 60, params: /^(filterDateValid|filterPublicationStatus|filterMOTType|filterPNLineSub|itdDateDayMonthYear)$/ },
}

const VEHICLE_FEEDS: Record<VehicleMode, string[]> = {
  train: ['/v2/gtfs/vehiclepos/sydneytrains'],
  metro: ['/v2/gtfs/vehiclepos/metro'],
  lightrail: ['/v2/gtfs/vehiclepos/lightrail/innerwest', '/v1/gtfs/vehiclepos/lightrail/cbdandsoutheast'],
  ferry: ['/v1/gtfs/vehiclepos/ferries/sydneyferries'],
  bus: ['/v1/gtfs/vehiclepos/buses'],
}

const json = (body: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  })

async function cached(request: Request, ctx: ExecutionContext, ttl: number, bypass: boolean, produce: () => Promise<Response>) {
  const cache = caches.default
  const key = new Request(request.url, { method: 'GET' })
  const hit = bypass ? undefined : await cache.match(key)
  if (hit) return hit
  const res = await produce()
  if (res.ok) {
    const copy = new Response(res.body, res)
    copy.headers.set('cache-control', `public, max-age=${ttl}`)
    ctx.waitUntil(cache.put(key, copy.clone()))
    return copy
  }
  return res
}

/** Why TfNSW refused a call: its gateway names the limit in `X-Error-Detail` ("Account Over Rate Limit" / "... Quota Limit"). */
export type Refusal = 'rate' | 'quota' | 'key' | undefined

export function refusalOf(status: number, detail: string | null): Refusal {
  if (status !== 403 && status !== 429 && status !== 401) return undefined
  if (/quota/i.test(detail ?? '')) return 'quota'
  if (/rate/i.test(detail ?? '') || status === 429) return 'rate'
  return 'key'
}

class UpstreamError extends Error {
  constructor(
    readonly status: number,
    readonly refusal: Refusal,
  ) {
    super(`Upstream ${status}`)
  }
}

/** Waits before each retry of a call refused for the 5 requests/second limit; the limit counts per second. */
const RATE_RETRY_MS = [400, 1100]

/**
 * Every call to TfNSW goes through here. The API key allows 5 requests/second across all users, and each phone only
 * spaces its own requests, so two people opening the app together can go over it: such calls wait and retry. One log
 * line per call (event "upstream") lets Workers Logs count daily usage against the 60,000/day quota.
 */
export async function upstream(path: string, env: Env, accept: string, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))) {
  for (let attempt = 0; ; attempt++) {
    const started = Date.now()
    const res = await fetch(API + path, { headers: { Authorization: `apikey ${env.TFNSW_API_KEY}`, Accept: accept } })
    const refusal = res.ok ? undefined : refusalOf(res.status, res.headers.get('x-error-detail'))
    // eslint-disable-next-line no-console -- the usage log Workers Logs counts
    console.log(
      JSON.stringify({ event: 'upstream', api: path.split('?')[0], status: res.status, refusal, attempt, ms: Date.now() - started }),
    )
    if (res.ok) return res
    if (refusal === 'rate' && attempt < RATE_RETRY_MS.length) {
      await res.body?.cancel()
      await sleep(RATE_RETRY_MS[attempt])
      continue
    }
    throw new UpstreamError(res.status, refusal)
  }
}

function upstreamError(e: unknown) {
  if (!(e instanceof UpstreamError)) return json({ error: 'Proxy failure' }, 502)
  if (e.refusal === 'rate') return json({ error: 'Transport for NSW is busy, trying again shortly' }, 429, { 'retry-after': '5' })
  if (e.refusal === 'quota') return json({ error: "Today's Transport for NSW data limit is used up" }, 429, { 'retry-after': '600' })
  if (e.refusal === 'key') return json({ error: 'Upstream rejected the API key' }, 502)
  return json({ error: `Upstream error ${e.status}` }, 502)
}

function handleTp(endpoint: string, url: URL, request: Request, env: Env, ctx: ExecutionContext) {
  const cfg = TP_ENDPOINTS[endpoint]
  if (!cfg) return json({ error: 'Not found' }, 404)

  const target = new URL(`${API}/v1/tp/${endpoint}`)
  const sorted = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))
  for (const [k, v] of sorted) {
    if (cfg.params.test(k) && v.length <= 200) target.searchParams.append(k, v)
  }
  target.searchParams.set('outputFormat', 'rapidJSON')
  target.searchParams.set('coordOutputFormat', 'EPSG:4326')
  target.searchParams.set('version', TP_VERSION)

  const cacheReq = new Request(target.toString().replace(API, url.origin), request)
  // Via-city searches refresh once a minute (VIA_MS in the app), so other users can share them for as long.
  const ttl = endpoint === 'trip' && url.searchParams.has('name_via') ? 55 : cfg.ttl
  return cached(cacheReq, ctx, ttl, url.searchParams.has('fresh'), async () => {
    try {
      const res = await upstream(target.toString().slice(API.length), env, 'application/json')
      return new Response(res.body, { headers: { 'content-type': 'application/json' } })
    } catch (e) {
      return upstreamError(e)
    }
  })
}

async function handleVehicles(url: URL, request: Request, env: Env, ctx: ExecutionContext) {
  const mode = url.searchParams.get('mode') as VehicleMode | null
  const feeds = mode && VEHICLE_FEEDS[mode]
  if (!feeds) return json({ error: 'Unknown mode' }, 400)
  const trips = (url.searchParams.get('trips') ?? '').split(',').filter(Boolean).slice(0, 50)
  const wanted = trips.length ? new Set(trips) : undefined
  // Rail feeds are small enough to cache whole, so every trip combination shares one upstream fetch.
  const rail = mode === 'train' || mode === 'metro'

  const cacheReq = new Request(`${url.origin}/api/vehicles?mode=${mode}&trips=${rail ? '' : [...trips].sort().join(',')}`, request)
  const res = await cached(cacheReq, ctx, 5, url.searchParams.has('fresh'), async () => {
    try {
      const results = await Promise.all(
        feeds.map(async (path) => {
          const res = await upstream(path, env, 'application/x-google-protobuf')
          return decodeVehiclePositions(new Uint8Array(await res.arrayBuffer()), rail ? undefined : wanted)
        }),
      )
      return json({ vehicles: results.flat() })
    } catch (e) {
      return upstreamError(e)
    }
  })
  if (!rail || !wanted || !res.ok) return res
  const { vehicles } = (await res.json()) as { vehicles: VehicleInfo[] }
  return json({ vehicles: vehicles.filter((v) => wanted.has(v.tripId)) })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
    if (!env.TFNSW_API_KEY) return json({ error: 'Server is missing TFNSW_API_KEY' }, 500)

    try {
      if (url.pathname === '/api/vehicles') return await handleVehicles(url, request, env, ctx)
      const m = url.pathname.match(/^\/api\/tp\/([a-z_]+)$/)
      if (m) return await handleTp(m[1], url, request, env, ctx)
      return json({ error: 'Not found' }, 404)
    } catch {
      return json({ error: 'Proxy failure' }, 502)
    }
  },
} satisfies ExportedHandler<Env>
