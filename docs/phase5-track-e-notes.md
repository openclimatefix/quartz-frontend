# Phase 5 — Track E notes (peripherals: sites, satellite, status banner)

Verified at hand-off: `npx tsc --noEmit` — 13 pre-existing errors remain, all in
`components/helpers/data.reconciliation.test.ts`, `components/map/use-map-region-values.test.tsx`
and `hooks/data/use-aggregation-levels.test.tsx` (Seam 1/2 tracks' in-flight files, none of them
mine, none touched by me). `npx jest` — 31/34 suites, 891/892 tests green; the 3 failing suites are
exactly those same three files. Nothing I own is red.

---

## 1. What landed

| File | What |
|---|---|
| `scripts/build-geo-assets.mjs` | Sites view reuses `gsp.json`/`dno.json` — no separate step, no separate asset (see §3; updated after Brad's mid-track decision) |
| `components/map/sitesMap.tsx` | Drops the two `data/*.json` imports; fetches `/geo/gb/gsp.json` (canonical) and `/geo/gb/dno.json` via `lib/geo/assets.ts#loadGeoAsset`, guards source creation until data arrives, re-flags `newDataForMap` on arrival |
| `components/hooks/useLoadDataFromApi.tsx` | Accepts an optional `scope: Scope` in its config, stripped before reaching `useSWR` (not forwarded, not consumed — a documented seam for the future v1 swap). Doc comment records that auth already goes through the shared token cache. |
| `components/hooks/useSitesViewData.ts` | Builds one `Scope` (`{ country, source: "solar", regionType: "site" }`) via `useCurrentCountry()`, passes it to all three fetches |
| `components/hooks/useStatus.ts` | New — isolates the status banner's two v0 endpoints and their open questions behind one module, per the contract |
| `components/layout/layout.tsx` | Switched from raw `useLoadDataFromApi` calls to `useSolarStatus`/`useSitesStatus`, each given a `Scope` |
| `components/helpers/satelliteLayer.ts` | `fetchSatelliteTif`/`requestSatelliteTif`/`fetchAndDecodeSatelliteTif` take an optional `scope` param defaulting to `DEFAULT_SATELLITE_SCOPE`, so `map.tsx`'s existing call sites need no changes |
| `components/map/map.tsx` | One line: `mapboxgl.accessToken` now reads `process.env.NEXT_PUBLIC_MAPBOX_TOKEN` |
| `.env.local`, `.env.example` | Real token moved into `.env.local` (gitignored, untracked); placeholder + comment added to `.env.example` |
| `components/hooks/useStatus.test.ts`, `useLoadDataFromApi.test.tsx` | New tests |

## 2. Assets — dno.json reuse confirmed, not assumed

Verified byte-for-byte: `public/geo/gb/dno.json` (Track A's output, from
`data/dno_regions_lat_long_converted.json` with `crs` stripped) is identical to what sitesMap
needs after the same strip. No second copy emitted; `sitesMap.tsx` fetches `/geo/gb/dno.json`
directly.

## 3. The 2022 vs 2026 GSP file — repointed, per Brad's decision mid-track

Originally landed with sites kept on its own `sites-gsp.json` (the 2022 file) and the canonical
swap flagged as a product decision. Brad made that call: **sites now draws the same canonical GSP
file as the region view.**

- `sitesMap.tsx` fetches `/geo/gb/gsp.json` (362 features, `GSP_regions_4326_20260209.json`)
  instead of the 2022 file.
- `public/geo/gb/sites-gsp.json` is deleted, and the build-script step that emitted it is gone —
  `scripts/build-geo-assets.mjs` no longer reads `data/gsp_regions_20220314.json` at all. There is
  now exactly one GSP boundary asset in the repo, and 14 MB less of it.
- **No join-key adaptation was needed.** I checked what `sitesMap.tsx` actually does with
  `gspShapeData`'s features before assuming the two files were interchangeable: neither the live
  code nor the dead code (`generateGeoJsonForecastData`, whose only call site is commented out)
  keys, joins, or reads any property off the GSP features. Both the old and new files are handed
  to Mapbox verbatim as a `gspBoundaries` line-layer source, drawn as an undifferentiated outline
  overlay with no per-feature binding to site or GSP data. Same story for `dnoShapeData` — it was
  already `dno.json`, unchanged by this swap.
- **Consequence for "how many resolve":** the resolution question the coordinator asked about
  (does swapping the file drop regions that used to draw) doesn't apply here in the way it does
  for the region view's `buildMapGeometry` join — there is no join, so there is nothing to fail to
  resolve. What changes is strictly which boundary shapes are drawn (362 2026-vintage polygons
  instead of 317 2022-vintage ones); no site, GSP or DNO group render, colour, or click behaviour
  depends on which set is loaded. Grepped for `gsp_id`/`GSPs`/`properties` reads against
  `gspShapeData` to confirm this before writing it down, not inferred from the diff being small.
- If a future change makes `sitesMap.tsx` join GSP boundaries against live GSP data (e.g. to
  colour by capacity), that join will need `properties.GSPs` (lowercased) against the canonical
  file, per Track A's notes — worth remembering since it doesn't apply today.

## 4. Mapbox token — a live credential was in source

`components/map/map.tsx` had `mapboxgl.accessToken` hardcoded as a literal string, committed to
git history on this and (presumably) prior branches. Moved to `NEXT_PUBLIC_MAPBOX_TOKEN`:

- The real value now lives only in `.env.local`, which is gitignored and was never tracked.
- `.env.example` documents the variable with a placeholder, following the existing
  `NEXT_PUBLIC_*` convention (`constant.ts`, `presenceProvider.tsx`, etc.).
- **This value has been in the repo's history already and should be treated as compromised.**
  Recommend rotating it in the Mapbox account (it's a `pk.` public token, so the blast radius is
  usage/billing on the account, not data access — but rotation is still the correct move, and
  every deployment environment (Vercel or otherwise) needs `NEXT_PUBLIC_MAPBOX_TOKEN` set before
  this ships, or the map renders with no token at all).

## 5. Auth path — already retired, nothing to do

The contract's phrasing ("retire `useLoadDataFromApi`'s ad-hoc auth path") describes a state that
no longer exists by the time I got here: `axiosFetcherAuth` (`components/helpers/utils.ts`,
line ~349, not owned by this track) already calls `getAccessToken()` from `lib/api/auth/token.ts`
— the same shared cache satellite uses. I verified this rather than assuming it from the contract's
prose (see the user's "verify inherited claims" instruction) — grepped the import, confirmed no
second token-fetching path exists in `useLoadDataFromApi.tsx` or its fetcher. No code change was
needed there; I only added the `scope` pass-through described below.

## 6. Scope — where it's real, where it's a documented placeholder

- **sites** (`useSitesViewData.ts`): builds a real `Scope` from `useCurrentCountry()`, threads it
  into all three v0 fetches via the new `useLoadDataFromApi` `scope` config field. The field is
  accepted and stripped before reaching `useSWR` — never forwarded into the fetch key or the
  fetcher, so caching/dedup behaviour is provably unchanged (see the new
  `useLoadDataFromApi.test.tsx`).
- **status** (`useStatus.ts` / `layout.tsx`): same pattern, `Scope` built from `useCurrentCountry()`
  at the `Layout` call site.
- **satellite** (`satelliteLayer.ts`): `fetchSatelliteTif` and friends gained an *optional* `scope`
  parameter defaulting to a new `DEFAULT_SATELLITE_SCOPE` constant (`{ country: "GB", source:
  "solar", regionType: "national" }`), rather than a required one. `map.tsx` — which calls these
  functions and is **not** in this track's ownership — was not edited to pass a real scope. This
  is a deliberate compromise: making the parameter required would have forced editing an unowned,
  currently-live file's call sites; optional-with-default preserves behaviour exactly and still
  gives the functions a documented `Scope` seam for the future v1 swap. Flagging this rather than
  quietly calling it "done": satellite's `Scope` is not actually threaded from the UI today, only
  accepted at the leaf.

None of these Scopes change any URL. Every one is explicitly documented as accepted-not-consumed,
per the contract's "even where the current backend ignores the country."

## 7. gsp_lat_long_map.json / dno_lat_long_map.json — left bundled

30 KB and 1 KB respectively, imported by `useAggregateSitesDataForTimestamp.tsx`. The contract
marked moving these as optional. I left them as static imports: the phase's bundle-size number is
about the 25 MB `sitesMap.tsx` pair, and moving 31 KB to a fetch trades a compile-time guarantee
(the map can never be empty because of a failed network request) for no measurable size win.

## 8. Files touched outside the listed ownership, and why

Two files outside my explicit ownership list were edited, both narrowly, both because the task's
own numbered items (4 and 5) point directly at code living there and neither file is on the
DO-NOT-EDIT roster:

- **`components/map/map.tsx`** — one line, the `mapboxgl.accessToken` assignment (item 4). No
  other line touched.
- **`components/layout/layout.tsx`** — the two status hook calls swapped for `useStatus.ts`'s
  exports, plus the `useCurrentCountry()` import (item 5's isolation only works if the real call
  site uses the isolating module). `StatusBanner.tsx` itself is purely presentational — it never
  fetched anything — so the isolation had to land where the fetch actually happens.

Neither file is in the Seam 1/2/3 DO-NOT-EDIT list, and both changes are additive/narrow enough
that they shouldn't collide with the in-flight tracks working elsewhere in those files. Flagging
per the "if the work seems to need one of those, STOP and report" instruction, even though neither
was technically on that list — the ownership list didn't anticipate the token or the status fetch
living outside the named files.

## 9. Open items I isolated rather than resolved (per contract item 5)

`components/hooks/useStatus.ts`'s doc comment carries the detail; summary:

- `/solar/GB/status` is hardcoded to GB regardless of the viewer's country — unknown whether a
  country-aware endpoint exists.
- `${SITES_API_PREFIX}/api_status` has no scope in its URL at all.
- `SolarStatus { status, message }` is asserted from historical usage, not a schema — an unknown
  quantity if the real payload differs.

None of these were guessed at or "fixed" — the URLs and the type are byte-for-byte what they were
before this track.
