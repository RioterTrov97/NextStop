import type { VehicleInfo, VehicleMode } from '../shared/vehicles'
import { decodeVehiclePositions } from './vehicles'

interface Env {
  TFNSW_API_KEY: string
  ASSETS: Fetcher
}

const API = 'https://api.transport.nsw.gov.au'
const TP_VERSION = '10.2.1.42'

const TP_ENDPOINTS: Record<string, { ttl: number; params: RegExp }> = {
  stop_finder: { ttl: 86400, params: /^(type_sf|name_sf|TfNSWSF|anyObjFilter_sf|anyMaxSizeHitList)$/ },
  trip: {
    ttl: 20,
    params:
      /^(depArrMacro|itdDate|itdTime|type_origin|name_origin|type_destination|name_destination|calcNumberOfTrips|TfNSWTR|excludedMeans|exclMOT_\d+|maxChanges|wheelchair)$/,
  },
  departure_mon: {
    ttl: 20,
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

async function cached(request: Request, ctx: ExecutionContext, ttl: number, produce: () => Promise<Response>) {
  const cache = caches.default
  const key = new Request(request.url, { method: 'GET' })
  const hit = await cache.match(key)
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

function upstreamError(status: number) {
  if (status === 401 || status === 403) return json({ error: 'Upstream rejected the API key' }, 502)
  if (status === 429) return json({ error: 'Rate limited by Transport for NSW, try again shortly' }, 429, { 'retry-after': '10' })
  return json({ error: `Upstream error ${status}` }, 502)
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
  return cached(cacheReq, ctx, cfg.ttl, async () => {
    const res = await fetch(target, { headers: { Authorization: `apikey ${env.TFNSW_API_KEY}`, Accept: 'application/json' } })
    return res.ok ? new Response(res.body, { headers: { 'content-type': 'application/json' } }) : upstreamError(res.status)
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
  const res = await cached(cacheReq, ctx, rail ? 15 : 10, async () => {
    const results = await Promise.all(
      feeds.map(async (path) => {
        const res = await fetch(API + path, {
          headers: { Authorization: `apikey ${env.TFNSW_API_KEY}`, Accept: 'application/x-google-protobuf' },
        })
        if (!res.ok) throw res.status
        return decodeVehiclePositions(new Uint8Array(await res.arrayBuffer()), rail ? undefined : wanted)
      }),
    ).catch((status: unknown) => (typeof status === 'number' ? status : 500))
    if (typeof results === 'number') return upstreamError(results)
    return json({ vehicles: results.flat() })
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
