# TfNSW API usage: limits, what we do now, what we can do later

Researched and measured on 2026-11-07. Re-check the numbers before acting on them.

## The limits

- One API key (held by the worker) is on TfNSW's default "Bronze" plan: **5 requests/second** and **60,000 requests/day**. All endpoints share both limits.
- Over a limit, TfNSW answers `403` with `X-Error-Detail: Account Over Rate Limit` or `Account Over Quota Limit`. The worker maps these to "busy" (retried) and "daily limit used up" (`refusalOf` in `worker/index.ts`).
- Higher limits are granted on request: email OpenDataHelp@transport.nsw.gov.au with what the app does and its measured usage ([API basics](https://opendata.transport.nsw.gov.au/developers/api-basics)).

### Don't rotate keys across extra accounts

It would multiply the limits, but the [Acceptable Use Policy](https://opendata.transport.nsw.gov.au/sites/default/files/2024-09/TfNSW-Acceptable-Use-Policy.pdf) lists "excessive" use and "circumvention of any security features" as violations. The [Hub Terms](https://opendata.transport.nsw.gov.au/sites/default/files/2024-09/TfNSW-Open-Data-Portal-Terms.pdf) (9b) then forbid re-registering after a suspension, so the app could lose access for good. Ask for an upgrade instead.

### Caching is allowed

Datasets are licensed CC BY 4.0: we may store and serve them from our own servers. We must credit TfNSW (or the relevant agency) as the source and must not imply endorsement or use their logos.

## Where requests go

| Screen (one person, on screen) | Planner calls before 2026-11-07            | Now                              |
| ------------------------------ | ------------------------------------------ | -------------------------------- |
| Search results                 | 5 every 15s (direct + 4 via-city) = 20/min | 4/min direct + 4/min via ≈ 8/min |
| Home, 3 saved trips            | 15 every 15s = 60/min                      | ≈ 24/min                         |
| Followed trip                  | ≈ 45/min                                   | ≈ 20/min                         |

Vehicle feeds are fetched whole and cached at the edge for 5s, so they cost at most ~12 calls/min per mode per Cloudflare location, however many people are watching. Alerts refresh every 2 min.

**At up to ~10 users** (≈15 min of use each per day) this is a few thousand calls a day, well under the quota. The realistic risk is bursts: each phone spaces only its own requests (250ms apart), so two or three people opening the app together can exceed 5/second.

## What is in place

1. **Retries in the worker.** Every TfNSW call goes through `upstream()` in `worker/index.ts`. A call refused for the per-second limit waits (400ms, then 1.1s) and retries, up to twice; the daily quota is never retried. Users see "Transport for NSW is busy" only if all three attempts fail.
2. **Via-city searches refresh once a minute** (`VIA_MS` in `src/api/hooks.ts`), not every 15s. The shared timer skips via queries under a minute old (`refreshRealtime(qc, { scheduled: true })`); the refresh button and route changes still refresh everything. The worker caches via results for 55s so users share them.
3. **Usage logging.** One log line per TfNSW call: `{"event":"upstream","api":"/v1/tp/trip","status":200,"refusal":null,"attempt":0,"ms":180}` (no query strings or keys). Workers Logs is enabled in `wrangler.jsonc`. To count a day's calls: Cloudflare dashboard → Workers → nextstop → Logs, filter `event = upstream`, group by `api`. Live: `npx wrangler tail --format json`.

## What we can do later, and when

Start with the step that matches the problem you see in the logs.

### A. Live times from the network-wide feeds (if daily calls approach ~30,000, or many 429s)

The biggest saving (~90% of planner calls). Measured:

- GTFS-realtime **trip updates** use the planner's exact `RealtimeTripId` and platform stop ids (all four planner trains from Lidcombe were in `v2/gtfs/realtime/sydneytrains` with their stop ids, e.g. `2141311`).
- The feed lists only some stops per trip; per GTFS-realtime, a stop's delay applies to the following stops until the next update. The planner's `stopSequence` gives the stop order, so planned time + carried-forward delay = live time, no static timetable needed.
- Trip-level `schedule_relationship` 3 = cancelled (12 of 409 trains at the time).
- Sizes: trains 175KB, metro 41KB, buses **4.2MB** (decode and filter on the server; never send to phones), alerts 144KB, train positions 41KB.

Design: a Cloudflare Durable Object polls the trip updates, vehicle positions and alerts feeds every 10–15s (the rates the feeds actually update, see AGENTS.md), only while some client asked in the last ~30s. It keeps the latest decoded copy in memory and answers "live times for these trip ids". The app then overlays live times on journeys it already has and asks the planner only on search, "later trips", every 2–3 min for new options, and about once a minute for replans. Cost is fixed per feed (≈5,760 calls/day each at 15s, only for the hours someone uses the app) instead of growing with users.

### B. One rate limiter for everyone (if bursts still fail after the retries)

Move request spacing from each phone to the server: a single Durable Object hands out at most 5 slots/second for all users and queues the rest. It pairs naturally with A (same object). A database is not needed for this.

### C. Departure boards on the shared feeds

Refresh the planner's `departure_mon` once a minute and overlay live times from A between refreshes, instead of every 15s.

### D. Ask TfNSW for an upgrade

Once A–C are in, send OpenDataHelp the app's purpose and real usage from the logs.

### E. Own routing from the static timetable (only if the planner still limits us)

Static GTFS (`v1/gtfs/schedule/sydneytrains`, `v2/gtfs/schedule/metro`, or the complete bundle) downloaded once a day, with a router (e.g. RAPTOR) for train, metro and light rail; the planner kept for buses and walking. A large job. Here a database helps: stop times are too big for memory. Cloudflare D1 keeps everything on one platform; MongoDB is an option if a cluster is already running. Neither is needed for A–D.

## References

- [Developer documentation](https://opendata.transport.nsw.gov.au/developers/documentation) (feeds, trip planner manual v3.3, GTFS/GTFS-R implementation specification)
- [Forum thread on over-limit errors](https://opendataforum.transport.nsw.gov.au/t/intermittent-http-503-response-your-api-quota-or-rate-limit-has-been-exceeded/1006)
- [GTFS-realtime reference](https://gtfs.org/realtime/reference/)

## Developer resources: what we use

From [developers/resources](https://opendata.transport.nsw.gov.au/developers/resources), checked 2026-11-07.

- **Transport Network Colour Chart**: the source of `LINE_COLOURS` in `src/lib/lines.ts` (metro, Sydney Trains, intercity, Sydney and Newcastle ferries, Sydney and Newcastle light rail). Rules: use the values unmodified. Colours are applied exactly, with white text (low contrast on the lightest, by choice). The chart has no bus colour; buses use `#00B5EF`. Regional trains (`#F6891F`) and coaches (`#732A82`) are listed too but not applied: the planner gives them a bare number ("31") and only the network name ("Regional Trains and Coaches Network") identifies them. Pass `product.name` to `lineColor` if they matter.
- **Attribution**: required by CC BY 4.0. The About section in Settings credits "Transport for NSW Open Data, licensed CC BY 4.0" and says the app is independent and not endorsed. Don't present the app as Transport-owned or sponsored. The Transport logo may only be used to attribute data, unmodified (questions: OpenDataProgram@transport.nsw.gov.au).
- **Mode symbols and pictograms**: official versions are in the "Transport Mode Symbols and Pictograms" dataset. Mode symbols may only identify Transport stops, stations and wharves (e.g. a station row), not services or the app; pictograms only at a small, secondary scale. We currently use our own icons; switching is optional.
- **TfNSW GTFS-realtime proto** (`tfnsw-gtfs-realtime.proto`): the vehicle descriptor extension also carries air conditioning and wheelchair accessibility, which we don't decode yet. Carriage loads come from the consist extension 1007 (see AGENTS.md).
- **Network maps** (PDF dataset) and the **intercity fleet page** on transportnsw.info: reference only.
