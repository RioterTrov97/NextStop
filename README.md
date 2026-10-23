# NextStop

Mobile-first progressive web app for live Sydney public transport: save trips (for example Lidcombe to Wynyard), see delays, alerts, carriage loads on trains and metro, station departure boards and a live map.

Stack: React 19, TypeScript, Chakra UI v3, TanStack Query, React Router, Vite, vite-plugin-pwa, and a Cloudflare Worker API proxy.

## Why a proxy

The Transport for NSW (TfNSW) API does not allow browser requests (no CORS) and the API key must stay secret. The Worker in `worker/` adds the key, caches responses and decodes the GTFS-realtime vehicle feeds into JSON. The browser only calls `/api/*` on its own origin.

## Setup

1. Install Node.js 20 or later.
2. Install dependencies: `npm install`
3. Create an API key at the [TfNSW Open Data Hub](https://opendata.transport.nsw.gov.au/) (profile, API Tokens). The application needs access to the **Trip Planner APIs** and the **Public Transport - Realtime Vehicle Positions** datasets.
4. Create `.dev.vars` from the example and add your key:

   ```sh
   cp .dev.vars.example .dev.vars
   ```

## Development

```sh
npm run dev
```

This starts Vite and runs the Worker proxy locally in the same process via `@cloudflare/vite-plugin`, so `/api/*` works with no separate proxy server. The key is read from `.dev.vars`; restart the dev server after changing it. Open the printed URL, ideally in a phone-sized viewport.

If you see "Server is missing TFNSW_API_KEY", `.dev.vars` is missing. If you see "Upstream rejected the API key", the key is wrong or lacks access to the datasets above.

| Command             | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | App and proxy with hot reload                      |
| `npm test`          | Unit tests (Vitest)                                |
| `npm run typecheck` | Type-check app, worker and config                  |
| `npm run build`     | Production build (app, Worker, service worker)     |
| `npm run preview`   | Serve the production build locally with the Worker |
| `npm run icons`     | Regenerate PWA icons from `public/logo.svg`        |
| `npm run deploy`    | Build and deploy to Cloudflare                     |

## Deploy

```sh
npx wrangler login
npx wrangler secret put TFNSW_API_KEY
npm run deploy
```

Open the deployed URL on a phone and use Add to Home Screen (iOS Safari) or Install (Chrome on Android).

## Project layout

- `worker/` proxy: allow-listed Trip Planner endpoints, edge caching, protobuf vehicle decoding
- `shared/` types shared by the Worker and the app
- `src/api/` API client and TanStack Query hooks
- `src/lib/` time (Sydney timezone), line colours, occupancy, journey helpers
- `src/store/` saved trips, stored in `localStorage`
- `src/components/`, `src/routes/` UI

## Notes

- API times are UTC; request dates and times are sent as Sydney local time.
- Carriage loads exist only for Sydney Trains and Metro services that are running. The field numbers for the TfNSW carriage extension are in `worker/vehicles.ts` and should be checked against a live service.
- Data: Transport for NSW Open Data, CC BY. Map tiles: MapTiler and OpenStreetMap contributors.
