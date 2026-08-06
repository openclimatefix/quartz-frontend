# Phase 4, Track A — the map's value pipeline

Working notes for the map migration onto the v1 data layer, plus Mapbox feature-state.
Companion to `phase4-contract.md` (the interface) and `phase4-progress.md` (in-flight state).

State: `npx tsc --noEmit` exit 0, `npx jest` 28 suites / 933 tests green, `npx next build`
exit 0, prettier clean. Nothing committed.

---

## What landed

### Files edited

- `components/helpers/data.ts` — the v1 value pipeline, appended below the v0 one.
- `components/map/pvLatestMap.tsx` — forecast map, rewired.
- `components/map/deltaMap.tsx` — delta map, rewired; computes its own deltas.
- `components/map/color-guide-bar.tsx` — a "no data" swatch, so the legend names all three states.

### Files created

Two new source files under `components/map/`. Both are new, so they collide with nobody, but
they are outside the literal "edit only" list and are flagged here for that reason.

- `components/map/use-map-region-values.ts` — the one hook the two maps call. It could not
  live in `helpers/data.ts` without putting React in a module that is otherwise pure.
- `components/map/feature-state.ts` — the paint expressions and `applyFeatureStates`. Shared
  by both maps, which is why it is not inside either of them.

### Tests created

- `components/map/map-value-join.test.ts` — 35 tests. The pure join, the three snapshot
  states, the numeric-id bridge, the rollup (including the double-count characterisation),
  and the paint expressions evaluated against synthetic feature states.
- `components/map/use-map-region-values.test.tsx` — 5 tests. MSW over the real machinery;
  the scrub path.

`components/helpers/data.geo.test.ts` is untouched and still green: the v0
`generateGeoJsonForecastData` was left in place rather than deleted, so its characterisation
suite keeps its 60-odd tests. See "Left behind deliberately".

---

## The four changes asked for, and how each was done

### 1. Geometry loads once; values attach via `setFeatureState`

`buildMapGeometry(aggregation, regions)` produces a FeatureCollection carrying **no values** —
only `properties.id` (plus `regionName`/`gspDisplayName` for the popup). It is memoised on
`[aggregation, regions.data]`, so it changes when the user switches aggregation level or when
the region list first arrives, and at no other time. The map components hold the last-applied
geometry in a ref and call `setData` only when that identity moves.

Values travel as feature state. `buildMapFeatureStates` returns a
`Map<featureId, MapFeatureState>`; `applyFeatureStates` clears the source's state in one call
and writes the new set. Colour and opacity are `step` expressions over `["feature-state", …]`,
so a value change repaints without touching geometry and a **unit** change is a
`setPaintProperty` with no data movement at all.

Two things worth knowing about `setFeatureState`:

- A GeoJSON source silently discards feature state set before it has finished loading.
  `applyFeatureStates` returns `false` when `isSourceLoaded()` is false and the caller re-runs
  it from the source's `sourcedata` event. Without that, the first paint after a geometry swap
  is unstyled and stays that way until the next value change.
- `promoteId: "id"` was already on the forecast source but **not** on the delta map's first
  `addSource` call (it had it in one of its two code paths and not the other). Now both.

The paint expressions are also guarded behind an "applied" ref, because the `Map` wrapper
re-invokes `updateMapData` on every render — an unguarded pair of `setPaintProperty` calls
re-validates the whole style on every scrub tick.

### 2. One fetch per window, scrubbed client-side

`useMapRegionValues` fetches `useForecastPeriod` and `useGenerationPeriod` over
`getEarliestForecastTimestamp() … getFurthestForecastTimestamp()` — both already floored /
ceiled to a 6-hour UTC boundary, so the value is constant for six hours and `queryKey` does
not move while the user scrubs. `selectedISOTime` never reaches the network; it selects an
index into the already-fetched axis.

Pinned by `use-map-region-values.test.tsx`: three rerenders at three different target times
issue zero additional requests, and the values still change.

`region_type` is always `gsp`, never `national` — `period` 400s on national.

### 3. The O(n²) joins

`RegionSeries.regions` is name-keyed, so the join is two hash lookups per region. The time
index is resolved **once per series** (`timeIndexOf`) rather than once per region, which is
the specific defect in `mapZoneFeatures`/`mapGspFeatures`: a `.find()` on a date predicate
inside the per-region `forEach`, though the predicate never depended on the region.

The rollup for zone/DNO/national is one pass over the grouping's member ids.

### 4. `unpublished` / `no-data` / `value`

`regionSeriesSnapshotAt` converts a slice of a `RegionSeries` into a `RegionSnapshot`, so
`regionSnapshotState` from the data layer applies verbatim instead of being reimplemented
against a second shape. A region absent from the payload, or with no entry at that index,
stays **absent**; it is never filled with a null.

How each renders:

| state | fill |
| --- | --- |
| `value` | yellow, opacity from the band table — **first band 0.03, not 0** |
| `no-data` | grey `#6b7280` at 0.25 |
| `unpublished` | nothing; the white border still outlines the region |

The 0.03 floor is the B8 fix. The old `interpolate` ramp started at opacity 0, so a region
generating a genuine 0 MW at midnight was pixel-identical to one that had published nothing —
even though `ColorGuideBar` has always claimed "0-50 → 3%". Moving the bands out of
`getOpacityValueFromPVNormalized` and into the paint expression makes the legend and the map
agree by construction; the band tables are asserted against the legend's own labels.

The popup says which of the three it is ("no data" / "awaiting") rather than printing 0.

Capacity mode is deliberately **not** gated on `dataState`: installed capacity is known for
every region whether or not it has published, so gating it would blank the capacity view
every time the newest slot was mid-fill.

The delta map gets the same treatment via `hasDelta`: a future slot, or a region where either
side is missing, draws nothing rather than the zero-bucket colour. The v0 code forced those to
`delta: 0`.

---

## Things found along the way

### The GSP GeoJSON join does not need `gsp_id`

The brief said the bridge is `Region.metadata.gsp_id`. That is true for the **grouping files**
(zone/DNO/national, which are arrays of numeric ids) but not for the GSP boundaries: a plain
case fold of `properties.GSPs` matches 345 of the 349 bundled features whole-string, exactly
as `config/countries.ts` already describes with `joinTransform: "lowercase"`. Verified against
`gb-regions-gsp.json` — the four misses are `Off_NETS(unassigned)` ×3 and
`Off_NETS(G_EXTRA_12)`, placeholders with no region behind them.

Both joins are in `buildRegionBridge`, the one clearly-commented function Phase 5 deletes.
`gsp_id` is still needed because the Mapbox feature id has to stay numeric at GSP level:
`use-update-map-state-on-click.ts` does `Number(clickedFeature.properties?.id)` and
`setFilter(["in", "id", ...numbers])`. That file is not mine and was left alone.

The four unmatched features now get distinct **negative** ids (−1…−4). The v0 code gave all
four the same fallback id (1000), which feature state cannot tolerate — one region's state
would have applied to all four.

### `data/*.json` geometry is now lazily required

The seven boundary/grouping imports at the top of `helpers/data.ts` are ~36MB and were parsed
by every consumer, including pure-function tests that touch no geometry. They are now memoised
`require()`s inside getters. Webpack still resolves them statically (`next build` exit 0,
bundle size unchanged) and the parse is deferred to the first map render at that aggregation
level. Test-suite side effect: `map-value-join.test.ts` runs in ~10s instead of ~25s.

### `useGetGspForecast` in `pages/index.tsx` is still there

It is the per-scrub-tick refetch named in the progress notes, and I do not own that file. The
maps no longer read its output, but the request still goes out on every tick. **Deleting it is
a change I need in a file I do not own** — see below.

---

## Left behind deliberately

- **`generateGeoJsonForecastData` and its helpers** in `helpers/data.ts`. No map calls them
  any more. Deleting them would have meant editing `components/helpers/data.geo.test.ts`, a
  characterisation suite I do not own, and would have dropped ~60 tests below the baseline.
  They go when `pages/index.tsx` stops fetching `/gsp/forecast/all`.
- **The `combinedData` / `combinedLoading` / `combinedValidating` / `combinedErrors` props**
  on both maps. Still in the component signatures so `pages/index.tsx` compiles unchanged;
  no longer read, and documented as such in the prop types.
- **The DNO double-count.** 15 GSP ids appear in two groupings each, so a DNO total
  double-counts both power and capacity. Named in `rollUpRegionValues`' doc comment and pinned
  by a `CHARACTERISATION` test that asserts a GSP listed twice is summed twice. Phase 5 owns
  the fix; de-duplicating here would have changed published DNO numbers without anyone
  deciding to.
- **`public/geo/` is still not fetched.** Geometry comes from the bundled `data/*.json`, as
  instructed. Phase 5 is the geometry pipeline.

---

## Changes needed in files I do not own

1. **`pages/index.tsx`: delete `useGetGspForecast` and its call.** It sets
   `start_datetime_utc === end_datetime_utc === targetTime` and refetches on every scrub tick.
   Nothing renders its output any more — the maps were its only consumers via
   `combinedData.allGspForecastData`, and `gspDeltas`, which is also computed there, is no
   longer read by `deltaMap`. Check the delta *chart* / GSP list before removing `gspDeltas`
   itself; the fetch can go regardless.
2. **`pages/index.tsx`: `allGspSystemData` (`/system/GB/gsp/`) may now be unused by the map
   path.** Its remaining consumers are `currentYields` → `gspDeltas`, which item 1 covers.
3. Nothing else. `use-update-map-state-on-click.ts`, `components/types.d.ts`,
   `config/countries.ts` and `hooks/data/**` were read but not touched, and need no change for
   this step.

---

## Known gaps

- **No test renders the map components themselves.** mapbox-gl needs WebGL, which jsdom does
  not have. The two halves are tested separately instead: the value join and the paint
  expressions as pure functions, the fetch behaviour through the hook. The wiring between them
  (`applyFeatureStates` against a real `mapboxgl.Map`) is unverified by tests and wants a
  browser check.
- **`useLoadingState` is not wired into the map.** The map has its own spinner as before.
  Adopting the shared staleness indicator is the chart track's call, and doing it here would
  mean two views passing different scopes to it.
- **Coverage is computed but not shown.** `useMapRegionValues` returns
  `{ published, expected, isPartial }` so a view can say "127 of 336 published"; no map surface
  renders it yet. It is a one-line addition wherever the header wants it.
