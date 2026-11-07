# AGENTS.md

Guidance for anyone (human or AI agent) changing NextStop. Setup, deploy and layout basics are in [README.md](README.md); this file records the facts and decisions that are not obvious from the code. Most of them were measured against the live Transport for NSW (TfNSW) APIs; re-check before changing the logic that depends on them.

## What the app is

A mobile-first PWA for Sydney public transport, installed on iPhones as a home-screen app. React 19 + Chakra UI v3 (Ark UI / Zag underneath) + TanStack Query, served by a Cloudflare Worker that proxies the TfNSW APIs and keeps the API key server-side.

- `src/` client app. Routes in `src/routes`, shared UI in `src/components`, pure logic in `src/lib` (keep logic here and unit-test it).
- `worker/` Cloudflare Worker: trip planner proxy with edge caching, GTFS-realtime vehicle decoding.
- `shared/` code used by both (vehicle types, brand colours).
- `src/data/stations.json` is generated; never edit it by hand (see Commands).

## Commands

```
npm run dev          # Vite + local worker; needs TFNSW_API_KEY in .dev.vars
npm run dev:host     # same, reachable from the iOS Simulator / phones on the LAN
npm test             # vitest (src and worker tests)
npm run typecheck    # tsc -b across app, worker and node configs
npm run lint         # oxlint
npm run build        # typecheck + production build
npm run stations     # regenerate src/data/stations.json from the TfNSW GTFS timetables
```

Run test, typecheck, lint and build before calling work done. `src/components/LiveMap.tsx` has a pre-existing Prettier warning; leave it unless you are changing that file.

## TfNSW data: facts that drive the code

### Rate limits and refresh cadence

- The API key allows about 5 requests/second, shared by every user (the worker holds one key). All trip planner calls go through one client-side queue (`tripSlot` in `src/api/client.ts`) spaced 250ms apart.
- Measured feed update rates: train delays (trip updates) every 15s, train positions and loads every 10s, metro every 6s. So trips and departures refresh every 15s (`REALTIME_MS`) and vehicles every 10s (`VEHICLES_MS`). Polling faster only re-reads the same data and burns the quota.
- One shared scheduler (`src/api/realtime.ts`) refreshes all on-screen live queries together. It skips refreshes while the page is hidden or a sheet is being dragged.
- Worker edge cache: trips 5s (via-city searches 55s), vehicles 5s. The refresh button sends `fresh=1` to bypass it.
- The key is also capped at 60,000 requests/day. Via-city searches refresh once a minute (`VIA_MS`), not every 15s. Every TfNSW call goes through `upstream()` in the worker, which retries per-second refusals and logs one `{"event":"upstream"}` line per call. Limits, terms (no key rotation; caching allowed under CC BY 4.0), measured usage and the options for later are in [docs/api-usage.md](docs/api-usage.md).

### Trip planner (`/v1/tp/trip`)

- The planner returns only its preferred routes. The app also asks via Central, Town Hall, Redfern and Wynyard to surface other rail/metro/light rail combinations. Direct and via results are separate queries (`'direct'` / `'via'` in the query key): the direct answer renders first (~0.5-1s), via results merge in later (~2-4s).
- Via queries produce many near-duplicates (same trains changed at a different station, detours). `bestOptions` drops any option beaten by another (leaves no earlier, arrives no later, no more changes, no longer final walk); ties keep the roomier change.
- Changes are checked on live times. A change fits when the gap meets the user's minimum (Settings, default 3 min) and at least `MIN_SPARE_SEC` (60s) remains after the walk. The platform walk is in `footPathInfo` (position `AFTER`) on the arriving leg, or in separate walk legs; they never overlap.
- Cancellation: `properties.isCancelled` or a `realtimeStatus` containing "CANCEL".
- Station ids: use the leg's `parent.id` when `parent.type === 'stop'`, not the platform id.
- Planning to a departure's terminus does not reliably return that service: the planner prefers faster lines (a T4 instead of the T8 tapped), even when restricted to the mode. Match services by `RealtimeTripId`.
- Replacement buses during trackwork have product name "Temporary buses" (class 5), e.g. route 61CN from Hornsby, stand X1.
- Asking for a time in the past still returns departed services with live times, so a trip followed after boarding can be tracked from its original search.
- Once a service has left its first stop, the planner drops its load forecast (`origin.properties.occupancy`). Planning from a stop it has yet to reach (one with a time in `stopSequence`; many intermediate stops have none) returns it again with a forecast. Plan to the ride's own end, not the trip's destination: towards the destination the planner leaves out the user's train when another service from that stop arrives as soon (measured 2026-11-07: Strathfield to Wynyard omitted the running T1 `809J`, while Strathfield to Redfern returned it with `MANY_SEATS`). See `src/lib/ride.ts`.
- A train can change `RealtimeTripId` partway through a through-run (`809J` to Redfern, then `809K`).

### Departure monitor (`/v1/tp/departure_mon`)

- `RealtimeTripId` is in the event's own `properties`, not on `transportation`.
- Platform codes are station-prefixed (`CE18`, `SD07`, `HBY5`); always prefer the platform name ("Platform 4" for `HBY5`). Bus stands are letters (`E`, `A2`, `X1`) with the street in the name; light rail uses `LR1`/`LR2` with names like "Central Chalmers Street Light Rail". Never strip letters to get a number: `LR2` is not platform 2. `src/lib/platforms.ts` handles all of this.
- A trip id can appear twice on one board (a loop bus at two stands), so keys include stop and planned time (`departureKey`).

### Occupancy (vehicle positions, GTFS-realtime with the TfNSW consist extension 1007)

- Carriage `occupancy_status` is optional proto2: missing means not reported, never "empty".
- Only Waratah trains (A and B sets) report carriage loads. Millennium, Tangara, OSCAR and Mariyung sets list carriages with no loads. Those show the planner's forecast (marked "est.") or "No data".
- Metro sends a numbered header entry ("Alstom Metropolis", position 1) followed by six real carriages that all have position 0; order them by feed order (`orderCarriages` in `worker/vehicles.ts`).
- Buses report a whole-vehicle load only. Light rail reports nothing.
- The planner's forecast is in `origin.properties.occupancy` ("MANY_SEATS" etc.). Label it as predicted, not live.

### Service alerts (`/v1/tp/add_info`)

- `properties.announcementType === 'trackwork'` marks planned work. Line-level alerts usually list no stops, so the weekend check plans each saved trip for Saturday/Sunday and looks for replacement-bus legs, then matches alerts by station names in the text and validity window.

## Product decisions (keep these)

- **One card everywhere.** Search results, Home, and station departures use `JourneyRow`: three rows (station + platform | duration; times | countdown; line badges, delay, alert | occupancy). Departures pass `title="to …"` and omit arrival/duration. Don't add rows to the card.
- **Occupancy icon.** One indicator per card, right of the badge row, with a tiny caption: the status ("Plenty"), "· est." for forecasts, "· overall" for whole-train readings, "No data" when unknown (grey shape). Compact sizes are deliberate: train strip 82px, metro strip 67px, train body 74px, other bodies 58px, bus 48px, all 14px tall.
- **Home upcoming rows** keep their layout, in fixed-width columns with 12px gaps so everything lines up across rows and cards: time (84px) with "arrives …" under it; all line badges with the boarding platform ("Platform 3", "Stand A2") as small grey text under them; the occupancy shape with caption (82px); the countdown with the status ("on time" green, "+2 min" red, small thin text, no background) directly under it (56px). Rows are separated by a thin inset divider. Don't drop elements to make it one line.
- **Followed trip details**: rides still ahead come first (the next one at the top); finished rides fold into a collapsed "Previous stops" section, dimmed, with no occupancy or map. Other trips keep the planned order.
- **Line colours** come from the TfNSW Transport Network Colour Chart (`LINE_COLOURS` in `src/lib/lines.ts`; source and brand rules in [docs/api-usage.md](docs/api-usage.md)). The planner names intercity lines in full ("Blue Mountains Line"), so `lineCode` maps those to their codes (BMT, CCN, HUN, SCO, SHL).
- **Official colours, white text.** Badges, pills and the map marker use the chart colours unmodified, with white text. White on the light ones (T1 orange about 2:1, buses, some ferries) is below WCAG AA; this was chosen deliberately after darkened versions looked muddy (brown T1) and dark text was rejected. Don't darken them again without asking.
- **Platform pills** take the colour of their ride's line badge (`lineColor`), so a T8 leg has T8-green pills and an M1 leg Metro-teal ones; a single app colour for all pills was tried and looked wrong. Without a known ride (e.g. a replacement stand in the weekend notice) a pill uses its kind's colour: train, metro, light rail, bus, or replacement-bus `#0072A3`. Station boards filter with `PlatformFilter`: a scrollable row of transport tabs (mode colour dot, name, departure count; the selected one fills with its mode colour), then, for the chosen transport, a row of evenly sized platform/stand chips (the selected one in that mode's colour). Rows scroll sideways rather than wrap.
- **Saving** is a small labelled pill ("☆ Save" / "✓ Saved", `SaveTripChip`): in the results header (removable after confirmation), History and Home's previous trips. No banners asking to save. The Home button is "Plan" (it searches; it does not add).
- **Labels over icons.** General users must understand every action without guessing. Icon-only controls need an obvious meaning or a label.
- **Following a trip** keeps it live: leg-level merging (`withLiveLegs`) from planner lookups per segment, plus the station's departure board for trips followed from a board (`boardId`). A replan banner offers a faster route from the next decision point, or the best option when a ride is cancelled or a change is missed; board-followed trips only get the broken-plan prompts. While riding, the decision point is the train's next timed stop: stay on, or get off there and change (with the minimum change time). Before boarding it is the origin, otherwise the last interchange. The stored trip keeps ride stops so the next stop can be found.
- **Earlier trips** in search results load on a pull-down (a button without touch). They make no forecast lookups until opened or followed; ended trips show no load and say "Ended".
- **Weekend notice.** Thursday to Sunday, Home warns once per weekend about replacement buses on saved trips (first 6 trips, planned at the trip's usual time of day). Dismissal is per weekend.
- **Station search** answers the first 3 matches from the bundled station list instantly, then merges stop finder results below a loader. The stop finder alone ranks badly for partial words ("chats" finds no station).
- **Trip details sheet** (`JourneySheet`) uses the Ark UI drawer: drag from anywhere (maps are `data-no-drag`), closes at a quarter of its height or a flick, stops a little below the page header so the header and its countdown stay visible. The sheet shows its own countdown only when the page header behind it has none.
- **Refresh button**: draining ring with seconds, spinning arc with three soft dots while refreshing, a brief tick when fresh data lands. Under reduced motion the decorative motion stops, but the spinner keeps turning (slower, fixed arc) and the dots fade instead of bouncing: a frozen spinner looked like a hung app (Windows "Animation effects" off sets reduced motion, as does iOS Reduce Motion; headless browsers report it too).

## iPhone PWA specifics

- Test in Safari: the iOS Simulator (Xcode) runs real iOS Safari. Chrome results do not carry over for touch, status bar or rendering behaviour. `npm run dev:host`, then `xcrun simctl openurl booted http://localhost:5173/...` and `xcrun simctl io booted screenshot out.png`. Driving Safari with `safaridriver` needs a one-time `safaridriver --enable` (admin password) and Remote Automation enabled in the simulator's Safari settings.
- The status bar is painted by iOS from the opaque sticky bar at the top of the page (iOS 26+), not from translucent overlays. While any backdrop is open, `useStatusBarFollowsBackdrops` sets `html[data-overlay]` and `--ns-header-dim`; `PageHeader` then paints the dimmed colour above the backdrop (z-index 1550, pointer-events none) so the status bar dims too. `theme-color` is updated as well for other browsers.
- **iOS 27 status bar blur (installed app).** iOS draws a progressive blur and dark gradient under the status bar unless something opaque is painted there. The fix, from developer reports: keep `apple-mobile-web-app-status-bar-style` at `default` (not `black-translucent`); keep the sticky `PageHeader` solid with `padding-top: calc(8px + env(safe-area-inset-top))`, never capped (Dynamic Island phones report about 59px, and anything inside that zone gets blurred); keep the manifest `theme_color` equal to the header colour; keep drawers and dialogs from covering the top; and keep the opaque status bar strip in `index.html` (`#ns-status-strip`, standalone only, painted from the first frame, since a React-rendered header arrives after iOS has already decided to blur) plus `repaintStatusBarArea()`, which briefly shows an invisible layer after launch and on resume so iOS re-checks the top. iOS reads the status bar style at install time, so test changes by removing and re-adding the app to the Home Screen.
- Size full-screen layout with `dvh`, never `vh`: in the installed app `100vh` is the whole screen (932px on a 15 Pro Max) but the visible area is 59px shorter (873px), so `vh` made even an empty page scroll.
- Don't use Chakra's `md`/`lg` shadow on the header: in dark mode it adds a 1px inset outline that shows as a line under the status bar.
- Chakra's `Button` forces any `svg` inside it to icon size; give custom SVGs explicit width/height styles.

## Performance rules

- The query cache is persisted to IndexedDB by `src/lib/cachePersister.ts`: writes are batched (every 3s, and when the app is backgrounded), only trips (direct part), stop searches and the weekend check are kept, and map geometry is stripped. Never persist live positions, alerts or via results; the unbatched default wrote 7.6MB on every cache event and stalled the UI.
- Keep values passed to the sheet stable: `useJourneyVehicles` memoises its map; sheet legs are `memo`ed. Pages re-render every second for countdowns, so anything expensive below them must not re-render with them.
- Route chunks preload on idle (`preloadRoutes`), so tab switches don't wait on the network.
- Measure with a production build (`npm run build && npx vite preview`) and CPU throttling (4x) before and after performance changes. Development builds are several times slower and mislead.

## Testing conventions

- Unit-test pure logic in `src/lib` with fixtures shaped like real API responses (see `replan.test.ts`, `platforms.test.ts`, `weekend.test.ts`).
- jsdom can't run drawer gestures or layout; verify those in a real browser.
- When changing logic that depends on live data (occupancy, platforms, transfers, replacement buses), check it against the live API with the key in `.dev.vars` (read it, never commit or print it).
