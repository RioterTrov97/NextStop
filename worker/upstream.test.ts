import { afterEach, describe, expect, it, vi } from 'vitest'
import { refusalOf, upstream, type Env } from './index'

const env = { TFNSW_API_KEY: 'test' } as Env
const noWait = () => Promise.resolve()

// TfNSW's gateway refuses over-limit calls with a 403 and names the limit in X-Error-Detail.
const refused = (detail: string) => new Response('', { status: 403, headers: { 'x-error-detail': detail } })

afterEach(() => vi.unstubAllGlobals())

describe('refusalOf', () => {
  it('tells the per-second limit, the daily quota and a bad key apart', () => {
    expect(refusalOf(403, 'Account Over Rate Limit')).toBe('rate')
    expect(refusalOf(403, 'Account Over Quota Limit')).toBe('quota')
    expect(refusalOf(429, null)).toBe('rate')
    expect(refusalOf(401, null)).toBe('key')
    expect(refusalOf(500, null)).toBeUndefined()
  })
})

describe('upstream', () => {
  it('retries a call refused for the per-second limit', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(refused('Account Over Rate Limit')).mockResolvedValueOnce(new Response('ok'))
    vi.stubGlobal('fetch', fetch)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const res = await upstream('/v1/tp/trip?x=1', env, 'application/json', noWait)
    expect(await res.text()).toBe('ok')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('gives up after two retries, and never retries the daily quota', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const busy = vi.fn().mockImplementation(async () => refused('Account Over Rate Limit'))
    vi.stubGlobal('fetch', busy)
    await expect(upstream('/v1/tp/trip', env, 'application/json', noWait)).rejects.toMatchObject({ refusal: 'rate' })
    expect(busy).toHaveBeenCalledTimes(3)

    const quota = vi.fn().mockImplementation(async () => refused('Account Over Quota Limit'))
    vi.stubGlobal('fetch', quota)
    await expect(upstream('/v1/tp/trip', env, 'application/json', noWait)).rejects.toMatchObject({ refusal: 'quota' })
    expect(quota).toHaveBeenCalledTimes(1)
  })

  it('logs one line per call without the query string', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok')))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await upstream('/v1/tp/trip?name_origin=214110', env, 'application/json', noWait)
    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({ event: 'upstream', api: '/v1/tp/trip', status: 200, attempt: 0 })
  })
})
