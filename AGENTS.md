# AGENTS.md

Guidance for anyone (human or AI agent) changing NextStop. Setup, deploy and layout basics are in [README.md](README.md); this file records the facts and decisions that are not obvious from the code. Most of them were measured against the live Transport for NSW (TfNSW) APIs; re-check before changing the logic that depends on them.

## What the app is

A mobile-first PWA for Sydney public transport, installed on iPhones as a home-screen app. React 19 + Chakra UI v3 (Ark UI / Zag underneath) + TanStack Query, served by a Cloudflare Worker that proxies the TfNSW APIs and keeps the API key server-side.

- `src/` client app. Routes in `src/routes`, shared UI in `src/components`, pure logic in `src/lib` (keep logic here and unit-test it).
- `worker/` Cloudflare Worker: trip planner proxy with edge caching, GTFS-realtime vehicle decoding.
- `shared/` code used by both (vehicle types, brand colours).
- `src/data/stations.json`, `src/data/network.json` and `src/data/fares.json` are generated; never edit them by hand (see Commands). Regenerate after timetable or fare changes.

## Commands

```
npm run dev          # Vite + local worker; needs TFNSW_API_KEY in .dev.vars
npm run dev:host     # same, reachable from the iOS Simulator / phones on the LAN
npm test             # vitest (src and worker tests)
npm run typecheck    # tsc -b across app, worker and node configs
npm run lint         # oxlint
npm run build        # typecheck + production build
npm run stations     # regenerate src/data/stations.json and network.json from the TfNSW GTFS timetables
npm run fares        # regenerate src/data/fares.json (train fare bands) from the TfNSW Opal Fares open dataset
npm run icons        # regenerate the logo SVGs (scripts/generate-logo.ts, shared/logo.ts) and the PWA icons
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

- The planner returns only its preferred routes and never splits a journey it can make on one train: Lidcombe to Wynyard is always a direct T1/T2/T3, never "T2 to Strathfield, change to an express or T9", even at peak when that arrives sooner. A via stop doesn't force a change (a train passing through counts), and no parameter forces one (`dwellTimeMinutes` and similar were tried).
- So extra searches are chosen on the device, at no API cost, from a model of the timetable (`src/lib/network.ts`, data in `src/data/network.json`): every stopping pattern with its running times and trips per hour in each time band (`src/lib/bands.ts`). It computes the frequency-based optimal strategy (Spiess and Florian) to the destination and keeps interchanges that come within 20% of the best expected time, aren't within 4 minutes of either end, and bring in trains the direct trip doesn't use. Hubs offering the same trains a few minutes apart (Redfern, Central, Town Hall) count once, as the busiest. At most 2.
  - Each chosen hub is searched as two trips (to the hub, and on from its earliest arrival) stitched by `stitchAtHub` with the user's minimum change time; the side with fewer trains asks for fewer, so both cover the same stretch of time.
  - Typical cost: Lidcombe to Wynyard 3 requests (Strathfield), Parramatta to Penrith 1 (nothing helps). Planner via searches at the city hubs are now only the fallback when an end is a bus stop.
  - From or to an address, the extra searches wait for the direct answer: `railEnds` takes the station its trips usually board and leave at, the model plans between those, and the split searches still start and end at the address. If the model can't place the trip (a bus from the address), nothing extra is searched.
- The GTFS timetable splits trains running through the city into separate trips at Central (a Western Line T1 ends there, a new trip carries on to the North Shore), linked by `block_id`; the generator joins them, or no through train would exist in the model. It uses arrival times, so terminus layovers don't count as riding.
- Direct and extra results are separate queries (`'direct'` / `'via'` in the query key; `'via'` also carries the minimum change time): the direct answer renders first (~0.5-1s), the rest merges in later (~2-4s).
- Via and split queries produce many near-duplicates (same trains changed at a different station, detours). `bestOptions` drops any option beaten by another (leaves no earlier, arrives no later, no more changes, no longer final walk); ties keep the roomier change.
- Changes are checked on live times. A change fits when the gap meets the user's minimum (Settings, default 3 min) and at least `MIN_SPARE_SEC` (60s) remains after the walk. The platform walk is in `footPathInfo` (position `AFTER`) on the arriving leg, or in separate walk legs; they never overlap.
- Cancellation: `properties.isCancelled` or a `realtimeStatus` containing "CANCEL".
- Station ids: use the leg's `parent.id` when `parent.type === 'stop'`, not the platform id.
- Planning to a departure's terminus does not reliably return that service: the planner prefers faster lines (a T4 instead of the T8 tapped), even when restricted to the mode. Match services by `RealtimeTripId`.
- Replacement buses during trackwork have product name "Temporary buses" (class 5), e.g. route 61CN from Hornsby, stand X1.
- Asking for a time in the past still returns departed services with live times, so a trip followed after boarding can be tracked from its original search.
- Once a service has left its first stop, the planner drops its load forecast (`origin.properties.occupancy`). Planning from a stop it has yet to reach (one with a time in `stopSequence`; many intermediate stops have none) returns it again with a forecast. Plan to the ride's own end, not the trip's destination: towards the destination the planner leaves out the user's train when another service from that stop arrives as soon (measured 2026-11-07: Strathfield to Wynyard omitted the running T1 `809J`, while Strathfield to Redfern returned it with `MANY_SEATS`). See `src/lib/ride.ts`.
- A train can change `RealtimeTripId` partway through a through-run (`809J` to Redfern, then `809K`).

### Addresses and places (`/v1/tp/stop_finder`)

- The stop finder ignores `anyObjFilter_sf` and always returns about 50 mixed results: stops, platforms, `poi`, `singlehouse` (street addresses), `street`, `suburb`. `rankPlaces` filters and orders them in code; suburbs are too vague to plan to.
- The trip planner takes any of their ids at either end with `type_origin=any` (`streetID:…`, `poiID:…`, `coord:…`). Stop ids never contain a colon; `isAddressId` relies on that.
- Reverse lookup for "Current location": `type_sf=coord` with `name_sf=lon:lat:EPSG:4326` returns a `type: 'address'` entry whose `coord:` id the planner accepts.
- On-demand vans (class 10) are excluded on every trip search (`exclMOT_10`); the planner otherwise offers them from addresses.
- Home and Work are stored on the device (`src/store/places.ts`) and referenced by trips as the ids `home` and `work`, resolved to the address on each request; query keys carry the resolved id so changing Home refetches.
- Trips from an address start with a walk: cards show the leave time and count down to it (`setOff`), then to the train. Settings "Walking to the first stop" (`maxStartWalk`) hides longer ones.

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

### Opal fares (estimated on the device, `src/lib/fares.ts`)

- The trip planner stopped returning fares in October 2023 (`fare.tickets` is always empty), so fares are worked out from TfNSW's "Opal Fares" open dataset: the business rules PDF and the "Opal Distance Tables and Opal Fare Values" spreadsheet. Checked to the cent against transportnsw.info's trip planner (which still shows fares, and takes `from`, `to` and `departureDateTime=YYYYMMDDHHmm` in its URL) for trains, metro, the airport, buses, light rail, Sydney Ferries and mixed trips.
- Train and metro: band from the official over-the-track distance between first and last station (`fares.json`, about 5KB gzipped, loaded lazily). Changing trains, or train and metro, is one trip. Trackwork replacement buses are charged as the train trip. Bus, light rail and ferry: straight-line distance; same-mode rides within 60 minutes cost the band of the furthest point from the first stop.
- Off-peak (30%) all day Friday to Sunday and public holidays, and Monday to Thursday outside 6:30-10am and 3-7pm (Intercity stations from 6am). Ferries have no off-peak. $2 off ($1 reduced fares) per change of mode within 60 minutes. Airport station access fee on top; the daily cap limits a journey.
- Private ferries (product "Private ferry and fast ferry services", e.g. Manly Fast Ferry) use OpalPay with their own fares, so they show no estimate, although transportnsw.info shows the Opal fare for them. The Stockton ferry (product "Newcastle Ferries") uses bus fares. Coaches and regional trains are not Opal.
- Fares change most Julys: update `FARES_FROM`, the fare tables and the public holiday list in `fares.ts` from the newest "Opal Fare Values" sheet, and run `npm run fares`.

### Service alerts (`/v1/tp/add_info`)

- `properties.announcementType === 'trackwork'` marks planned work. Line-level alerts usually list no stops, so the weekend check plans each saved trip for Saturday/Sunday and looks for replacement-bus legs, then matches alerts by station names in the text and validity window.

## Product decisions (keep these)

- **One card everywhere.** Search results, Home, and station departures use `JourneyRow`: three rows (station + platform | duration · fare; times | countdown; line badges, delay, alert | occupancy). Departures pass `title="to …"` and omit arrival/duration. Don't add rows to the card.
- **Occupancy icon.** One indicator per card, right of the badge row, with a tiny caption: the status ("Plenty"), "· est." for forecasts, "· overall" for whole-train readings, "No data" when unknown (grey shape). Compact sizes are deliberate: train strip 82px, metro strip 67px, train body 74px, other bodies 58px, bus 48px, all 14px tall.
- **Home upcoming rows** keep their layout, in fixed-width columns with 12px gaps so everything lines up across rows and cards: time (84px) with "arrives …" under it; all line badges with the boarding platform and estimated fare ("Platform 3 · $5.38", "Stand A2 · $3.14") as small grey text under them; the occupancy shape with caption (82px); the countdown with the status ("on time" green, "+2 min" red, small thin text, no background) directly under it (56px). Rows are separated by a thin inset divider. Don't drop elements to make it one line.
- **Followed trip details**: rides still ahead come first (the next one at the top); finished rides fold into a collapsed "Previous stops" section, dimmed, with no occupancy or map. Other trips keep the planned order.
- **Line colours** come from the TfNSW Transport Network Colour Chart (`LINE_COLOURS` in `src/lib/lines.ts`; source and brand rules in [docs/api-usage.md](docs/api-usage.md)). The planner names intercity lines in full ("Blue Mountains Line"), so `lineCode` maps those to their codes (BMT, CCN, HUN, SCO, SHL).
- **Official colours, white text.** Badges, pills and the map marker use the chart colours unmodified, with white text. White on the light ones (T1 orange about 2:1, buses, some ferries) is below WCAG AA; this was chosen deliberately after darkened versions looked muddy (brown T1) and dark text was rejected. Don't darken them again without asking.
- **Platform pills** take the colour of their ride's line badge (`lineColor`), so a T8 leg has T8-green pills and an M1 leg Metro-teal ones; a single app colour for all pills was tried and looked wrong. Without a known ride (e.g. a replacement stand in the weekend notice) a pill uses its kind's colour: train, metro, light rail, bus, or replacement-bus `#0072A3`. Station boards filter with `PlatformFilter`: a scrollable row of transport tabs (mode colour dot, name, departure count; the selected one fills with its mode colour), then, for the chosen transport, a row of evenly sized platform/stand chips (the selected one in that mode's colour). Rows scroll sideways rather than wrap.
- **Saving** is a small labelled pill ("☆ Save" / "✓ Saved", `SaveTripChip`): in the results header (removable after confirmation), History and Home's previous trips. No banners asking to save. The Home button is "Plan" (it searches; it does not add).
- **Look (UI redesign, November 2026; plan and feature checklist in [docs/redesign.md](docs/redesign.md)).** The default app colour is **Original**, the app's first orange (chosen again on 16 November 2026 after trying eucalyptus and harbour blue). Every other app colour derives from one seed through `makePalette` in `shared/brand.ts`: the `brand` scale (`colorPalette="brand"`; there is no `teal` palette), greys leaning to its hue, `page`, `panel`, `ink`, dark surfaces, glass colours and the backdrop. To change the default, put another accent first in `ACCENTS`, point `palette` at its palette and run `npm run icons`; `palette.test.ts` checks contrast for many seeds, including every accent. Never write app colours as hex in components: `index.html`, the manifest and the icons read them at build time. Inter stays the font.
- **Backdrop**: soft accent-coloured light fixed behind the page (`body::before` in `src/theme.ts`), low down where the tab bar floats and clear of the solid header, so glass has colour to blur.
- **Glass on floating things only**: the tab bar, the followed-trip card, the trip sheet, dialogs, menus and map buttons (`.ns-glass` in `src/styles/glass.css`; `ns-glass-surface` makes Chakra's panel colours inside translucent). Lists, cards and the header stay solid. Settings "Glass: Solid" (`reduceTransparency`, `html[data-solid]`), `prefers-reduced-transparency`, `prefers-contrast: more` and browsers without `backdrop-filter` all get solid fallbacks.
- **Line tints** (`src/lib/tint.ts`, `src/lib/useTint.ts`): screens about a trip take its line colour, like Sangeet's per-song accents. Cards get a faint wash from the left and the countdown in the line's accent; the trip sheet, current trip card and followed-trip card are tinted glass; Home glows in the followed trip's colour; a station board filtered to one transport tints its header (and so the status bar, via `useHeaderTint`). Tints are derived for surfaces only, with contrast checked in `tint.test.ts` (accent 4.5:1 on panels, button text 4.5:1, both modes); badges keep the official colours. Grey lines (T7) fall back to the app colour. Settings "Line colours: Plain" (`tintByLine`) turns tints off.
- **App colour choice.** Settings "App colour" offers the accents in `ACCENTS` (`shared/brand.ts`, shown in that order). The first, "Original", is the default and the only one the icons and manifest use: the app's first theme, orange on plain greys, kept exactly as a fixed palette (`ORIGINAL`, `FIXED_PALETTES`) rather than derived, so its buttons are about 3.2:1 like the light line colours; don't regenerate it. Accents look the same in both modes: buttons and selected chips are `brand.600` with white text in light and dark (a pale dark-mode version looked washed out); only accent text and icons on dark panels switch to `brand.400`. Tinted surfaces in dark mode (unselected chips, outlines, banners, the selected tab) are washes of `brand.400` over what's behind (`wash()` in `src/theme.ts`, `DARK_WASH` percent for `brand.subtle`), not dark navy shades that sink into the page; `makePalette` brightens 400 until it reads at 4.5:1 on that wash. `src/lib/accent.ts` builds the others with `makePalette` and sets Chakra's brand, grey and surface variables plus the glass and backdrop variables inline on `<html>` for the current mode (inline beats the stylesheet). It caches both modes' variables in localStorage (`nextstop.accent.v1`), and the early script in `index.html` applies them before the first paint, so there is no flash of the default colour. It never sets `--ns-header-fg` or `--ns-header-bg` (tints own those). Line tints fall back to the chosen accent for grey lines. Installed icons can't follow the choice: iOS keeps the icon captured at install.
- **Solid for primary and selected.** Main actions (Plan, Plan a trip, See live times) and the selected option anywhere (tab bar, chips, pick-one rows) are `variant="solid"` with `colorPalette="brand"`: the full app colour with white text. The tinted `subtle` style is only for unselected chips, banners and decoration, never for a primary action or the current tab; secondary actions are grey.
- **Settings is sectioned**: Appearance, Trip planning, Places, Home screen, History and data, About, each a heading over one panel of items. A sticky row of section buttons in the header jumps to a section and highlights the one in view. Add new settings to the fitting section rather than a new card.
- **Header colour** is the CSS variable `--ns-header-bg` (page colour by default). Anything that recolours the header must set that variable, never the header's own background, so the status strip, `theme-color` and the backdrop dimming follow.
- **App frame.** The tab bar is a floating glass capsule (same four labelled tabs) in a sticky bottom stack; above it, on every tab but Home, `FollowedTripBar` shows the followed trip (line badge, from and to, next departure or "Riding to …", countdown) and opens it on Home (`openCurrent` in location state).
- **Logo**: a pin with a train front inside, circled by a tilted ring that passes behind the pin, with a bus and a tram riding on the ring as solid silhouettes (no outlines), bent to follow its curve. Geometry in `shared/logo.ts`; `BrandMark` draws it inline in the theme's colours. The app icon leaves out the vehicles. Don't use TfNSW logos or mode symbols.
- **Labels over icons.** General users must understand every action without guessing. Icon-only controls need an obvious meaning or a label.
- **Following a trip** keeps it live: leg-level merging (`withLiveLegs`) from planner lookups per segment, plus the station's departure board for trips followed from a board (`boardId`). A replan banner offers a faster route from the next decision point, or the best option when a ride is cancelled or a change is missed; board-followed trips only get the broken-plan prompts. While riding, the decision point is the train's next timed stop: stay on, or get off there and change (with the minimum change time). Before boarding it is the origin, otherwise the last interchange. The stored trip keeps ride stops so the next stop can be found.
- **Earlier trips** in search results load on a pull-down (a button without touch). When they land, the view keeps the trip that was at the top in place with just one earlier trip showing above it (scrolled under the header); the rest are a scroll up. They make no forecast lookups until opened or followed; ended trips show no load and say "Ended".
- **Weekend notice.** Thursday to Sunday, Home warns once per weekend about replacement buses on saved trips (first 6 trips, planned at the trip's usual time of day). Dismissal is per weekend.
- **Station search** answers the first 3 matches from the bundled station list instantly, then merges stop finder results below a loader, grouped as Stations, Stops, and Addresses and places. The stop finder alone ranks badly for partial words ("chats" finds no station). Empty, it offers Current location, Home and Work, then recent stations. The departure board's search (`stopsOnly`) leaves out addresses.
- **Trip details sheet** (`JourneySheet`) uses the Ark UI drawer: drag from anywhere (maps are `data-no-drag`), closes at a quarter of its height or a flick, stops a little below the page header so the header and its countdown stay visible. The sheet shows its own countdown only when the page header behind it has none.
- **Opal fare** is an estimate for the fare type set in Settings: on the card after the duration in the top row ("37 min · $8.38"; nothing when unknown, and none on departure boards), on Home's upcoming rows after the platform, and in trip details above the rides (`FareRow`), broken down: one line per charged part (line badges, mode, from and to, distance band, peak or off-peak, the amount), the transfer discount on its own line before the part it applies to, then the airport fee, the daily cap, and the total. Changes within one mode are one part ("charged as one trip"); the parts always add up to the total. `useFare` shares one loaded copy of the fare bands and memoises per journey.
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
