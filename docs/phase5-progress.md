# Phase 5 — progress

Companion to `phase5-contract.md`. Per-track detail is in `phase5-track-{a..f}-notes.md`; this is
what landed, what changed under the contract, and what is still open.

Baseline at phase start: `tsc --noEmit` exit 0, `jest` 30 suites / 869 tests.
At phase end: `tsc --noEmit` exit 0, `jest` **37 suites / 936 tests**, `next build` exit 0.

---

## The bundle number

The measurement the phase exists to prove, taken on real production builds before and after:

| | before | after |
|---|---|---|
| `/` First Load JS | **11.6 MB** | **828 kB** |
| `/` page size | 6.75 MB | 583 kB |
| no-map pages (`/404`, `/expired`, `/logout`) | **4.83 MB** | **~245 kB** |
| shared by all | 210 kB | 210 kB |

The 4.83 MB floor on pages that render no map was the bundled geometry riding in a shared chunk —
every user paid it to see a login screen. ~36 MB of `require`d GeoJSON in `components/helpers/data.ts`,
25 MB in `sitesMap.tsx`, and the 430 kB constraints overlay are now fetched assets under `public/geo/`.

---

## What landed

**Seam 1 — region types.** `NationalAggregation` is deleted. `nationalAggregationLevel` is a `string`
(the region type as the manifest spells it), defaulting to the country's finest non-derived level —
`gsp` for GB, `province` for NL — resolved from the registry, which is what makes NL work without a
guard. Consumers ask the level (`label` / `minZoom` / `maxZoom` / `derived` / `level`) instead of
branching on region-type identity.

**Seam 2 — geometry.** Assets ship at the paths the registry already declared. Groupings are
name-keyed (`Record<string, string[]>`), `components/helpers/data.ts`'s geometry half is pure, and
`useMapGeometry` / `loadGeoAsset` handle loading. The three async hazards the contract named are
guarded, plus a fourth it did not predict (below).

**Seam 3 — peripherals.** Sites, satellite and status keep their backends but carry a `Scope` and
route through the shared token fetcher. The Mapbox token moved to `NEXT_PUBLIC_MAPBOX_TOKEN`.

**Seasonal norms** (found late — no track owned the file). `use-format-chart-data.tsx` still imported
the 300 kB `data/national_metrics.json` while the registry's `seasonalNorms` URL had *zero* consumers
and Track A's asset shipped unused. It now loads through `loadGeoAsset`, which removed a further
60 kB — and fixed a real bug: the bundled GB metrics were applied unconditionally, so **NL's chart was
drawn with GB's seasonal norms**. `seasonalNorms: null` now renders no norm series at all.

**`AGGREGATION_LEVELS` and the zoom enums survive** — the contract asked whether anything but the
sites view still reads them. Nothing does. Every remaining consumer is the sites map, its zoom slider,
its chart, or `countryState`'s separate sites-view `aggregationLevel` field. They are documented as
the sites bands and are no longer the region hierarchy.

---

## Decisions taken during the phase

**The 2026 NESO file is the canonical GSP set** (Brad, mid-phase). The v1 API serves "all" regions —
including merged/legacy duplicates — only to keep old client scripts working. Regions the NESO file
does not model are legacy, not regions we fail to draw. Consequences:

- The alias map came out **empty**. All six suspected aliases were split/merge duplicates, not naming
  disagreements. `GEO_ALIASES.GB = {}`, mechanism retained, emptiness recorded as a checked claim.
- The six are named in `LEGACY_REGIONS.GB` with per-entry reasons and asserted to match no feature.
- **The pinned +683 MW double-count is accounted for exactly.** All 338 API regions sum to 22,588 MW
  against a national 21,905 MW (+3.12 %); the 332 real regions sum to **21,783 MW (−122 MW, −0.56 %)**.
  The residual is a *coverage gap*, not a double-count — a different problem with a different fix.

**GB reads "GSP" throughout** (Brad). Implemented as a `GeoLayerConfig.label` registry override rather
than a hardcode in the control: it keeps "adding a country is one registry entry" intact, and because
the registry resolves synchronously it also removes the transient "Gsp" that a manifest-sourced label
flashes before `/countries` lands. NL still takes its label from the manifest.

**Sites moved to the canonical NESO file** (Brad). `sites-gsp.json` and its build step are deleted, so
there is exactly one GSP boundary asset and no way to drift back to the 2022 vintage.

**`nationalCapacityMw` now excludes the legacy regions** (Brad). One rule about what is real, applied
in all three places that needed it — geometry, the feature-state join, and the capacity sum. The
published figure moves from 22,588 MW to **21,783 MW**. A test asserts the difference between the
naive and filtered sums equals the legacy regions' own capacity, so the filter cannot be silently
dropped. The remaining −122 MW coverage gap is deliberately untouched.

---

## Contract corrections

- **`carr_1` / `fidf_1` is backwards in the contract.** The 2026 file carries a *merged*
  `carr_1|fidf_1` feature while the API serves both halves *and* the merged region — the opposite of
  "the file splits them where the API merges". The alias/legacy tables follow the measurement.
- **`useMapRegionValues`'s doc comment was wrong** and is corrected: the API's regions are not a
  partition.

## Hazards found that the contract did not predict

- **`isSourceLoaded` lies for a tick.** It can report `true` for the *previous* data immediately after
  `setData`, so a feature-state apply can succeed against geometry about to be replaced and be
  silently dropped. Guarded with one forced re-apply per geometry load. Harmless while geometry was
  synchronous; live now.
- **A regression we introduced and nearly shipped.** Lowercasing the stored region type broke the
  grouped (DNO/zone) chart rollup against a table keyed by the old capitalised enum values. It was
  first reported as pre-existing breakage; checking HEAD showed the path worked before this phase. It
  is fixed, the branch is now on `level.derived` rather than any name, and a test asserts a real
  shipped DNO group yields a non-empty series.
- **A conditional map source in `sitesMap.tsx`** — the source was added only once its fetch landed
  while the layer naming it was added unconditionally, so the first render pointed a layer at a
  nonexistent source. Now added once, empty, and populated on arrival, per the contract's rule.
- **A test fixture that disagreed with reality.** `GB_MANIFEST` claimed the manifest labels `gsp` as
  "GSP"; it says "Grid Supply Point". The suite was green because the fixture matched the old
  hardcoded copy. Fixture corrected, so the label assertions test the override instead of restating
  their own input.
- **Making a synchronous import asynchronous puts a suite on the network.** Moving seasonal norms to a
  fetch made `pv-remix-chart.test.tsx` reach for undici inside jsdom and die on missing
  `clearImmediate` — a failure that looks like a toolchain problem and is actually a design change.
  The hook is stubbed there, as `use-map-geometry` already is in the map suites.

---

## Open — for Brad, deliberately not decided here

1. **The −122 MW coverage gap** (mostly Seabank, plus `grem_p`) — distinct from the resolved
   double-count, and the one part of the capacity discrepancy still open. It needs data (GSPs the
   boundary file models which the API does not publish separately), not arithmetic.
2. **Rotate the Mapbox token.** It was hardcoded in `components/map/map.tsx` and is therefore in git
   history. It is a `pk.` public token, so the exposure is billing/usage abuse rather than data access,
   but moving it to env does not unpublish it.
3. **The DNO 15-way double-count** — still with the API owner. The Phase 5 regeneration reproduces it
   exactly and on purpose; `data.reconciliation.test.ts` documents rather than asserts equality.
4. **The NG-zone grouping file is stale** — 32 GB regions in no zone grouping, 11 unresolved ids. Needs
   a data refresh, not code.
5. **The `national` map level has no values path** (`period` 400s on national, no national grouping
   asset ships). Unreachable from the UI today, so nothing is broken — but it is a decision.
6. **The build script's only `gsp_id → v1 name` source is a test fixture**
   (`__fixtures__/gb-regions-gsp.json`). A shipped build artefact depending on test data is fragile.
7. **A dead positional join in `sitesMap.tsx`.** `getForecastGeoJson` binds forecasts to features by
   array index; its only caller is commented out. Safe today, but a 349→362 vintage change silently
   misaligns every region if anyone revives it.
