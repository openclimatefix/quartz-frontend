# Phase 5 — Track D notes (geometry seam: async loading, name-keyed groupings, the bundle)

Verified at hand-off: `npx tsc --noEmit` exit 0; `npx jest` **36 suites / 931 tests** green (baseline
was 32/898); `npx prettier --check` clean over `components/`, `hooks/`, `lib/`; `npx next build`
exit 0.

---

## 1. The number the phase exists for

Measured on a real `next build`, not estimated:

| | before | after |
|---|---|---|
| `/` First Load JS | **11.6 MB** | **888 kB** |
| Floor on pages that render no map | **4.83 MB** | **198 kB** |

`components/helpers/data.ts`'s `memoise`/`require` block is gone, and with it every
`data/*.json` path it named. Nothing under `components/`, `hooks/`, `lib/` or `pages/` imports
a boundary or grouping file any more — the only surviving `data/*.json` imports are
`national_metrics.json` (charts) and the two lat/long maps in
`useAggregateSitesDataForTimestamp.tsx`, both of which belong to other tracks.

`ng_constraint_boundaries.json` (430 KB) went too: `pvLatestMap.tsx` now fetches the overlay from
the registry's `overlays` URL. It was in the bundle of every page importing that module, for a
layer that is off by default.

## 2. Final signatures

```ts
// lib/geo/assets.ts
export const loadGeoAsset = <T>(url: string): Promise<T>;
export const clearGeoAssetCache = (): void;                    // tests only

// hooks/data/use-map-geometry.ts
export const useMapGeometry = (level, regions) =>
  ({ geometry, groupings, isLoading, error });                 // `groupings` is an addition
export const useLevelGroupings = (level) => ({ data, isLoading, error });   // addition

// components/helpers/data.ts
export const groupRegionNames = (groupings, groupName) => string[] | undefined;
export const rollUpRegionSeries = (series, regionNames, groupName) => TimeSeries | undefined;
export const rollUpRegionValues = (values, groupings: Record<string, string[]>);
export const buildMapFeatureStates = (level, inputs, { groupings?, country? });
export const buildMapGeometry = ({ level, shapes, groupings?, regions,
                                   joinProperty, joinTransform?, country? }) => FeatureCollection;

// components/charts/gsp-pv-remix-chart/use-gsp-region-data.ts
export const useGspAggregateData = (regionNames: string[] | null, groupName: string | null);
export const useGspRegionNames = (gspIds: string[] | null): string[] | null;   // new
```

**Three additions to the contract's signatures**, all additive, none a change:

1. `country` on `buildMapGeometry` / `buildMapFeatureStates`. `geoAliasesFor` and
   `isLegacyRegion` are country-keyed and nothing else in those arguments identifies the
   country. Without it the alias and legacy rules cannot be applied at all.
2. `groupings` on `useMapGeometry`'s return. The grouping file decides a derived level's
   *values* and the polygons decide its *shapes*; returning them from one URL-keyed resolve is
   what makes "one level's numbers on another's ground" unrepresentable. A caller fetching the
   groupings separately would reintroduce exactly the hazard the seam guards.
3. `useLevelGroupings`, so the GSP chart can resolve a DNO selection without dragging GB's
   9 MB boundary file in behind it.

## 3. `RegionBridge` SURVIVES — the contract's condition is met twice over

The contract said it lives only if something other than the groupings still needs the numeric
id. Two things do, and one of them is a silent-failure trap:

- **`use-update-map-state-on-click.ts` coerces the clicked feature's `properties.id` with
  `Number()` at `gsp` level**, and the chart passes the resulting selection on as numbers. A
  name-keyed GSP feature id would become `NaN` there — no type error, no throw, just an empty
  chart. So GSP-level Mapbox feature ids stay numeric, and `buildMapGeometry` uses
  `metadata.gsp_id` where a region has one and the region **name** where it does not (NL's
  provinces, and anything after).
- `components/charts/delta-view/use-gsp-deltas.ts` publishes `gspId` on every `GspDeltaValue`.

What *did* go is `byGspCode`. The geometry join is no longer a hardcoded case fold on
`properties.GSPs`; it is a name join driven by the registry's `joinProperty`/`joinTransform`
plus `config/geo-aliases.ts`. That is what lets a country with no GSPs draw at all.

## 4. How the out-of-order resolve is guarded

`useGeoAsset` (inside `use-map-geometry.ts`) stores the **URL alongside the parsed asset** and
compares them at *render* time. An asset can therefore only ever be read back under the URL it
was fetched for. The effect's `cancelled` flag and a `latestUrl` ref close the common cases and
StrictMode's double-invoke, but they only save a wasted render — the render-time comparison is
what makes the wrong answer unrepresentable rather than merely unlikely.

Keying on the URL alone is sufficient and deliberate: asset paths are country-scoped, so a
country switch landing on the same region-type name (`gb/national.json` → `nl/national.json`)
is still a different key.

**The test** (`hooks/data/use-map-geometry.test.tsx`) forces the ordering rather than racing
it: it starts a GSP fetch, switches to DNO mid-flight, settles the DNO assets, then settles the
stale GSP fetch last, and asserts the displayed geometry is *identical by reference* before and
after, that the feature ids are still the DNO group names, and that `67` (City Road's gsp_id)
appears nowhere. Plus: a level revisited resolves from cache with no second fetch, and a
rejection surfaces as an error and stops reporting as loading.

## 5. The flicker hazards in the two map components

- The PV source is added **unconditionally** with a module-level `EMPTY_GEOMETRY` and populated
  by `setData` on arrival. This is not defensiveness: layer order in Mapbox is creation order,
  and `map.tsx` inserts satellite raster layers *beneath* whichever PV layer already exists. A
  conditionally-created source means the PV layers are created after the satellite ones and the
  yellow fill ends up under the clouds — intermittent, network-timing dependent, invisible
  until someone turns clouds on.
- Feature states are re-applied whenever **either** side moves. Clearing `appliedStatesRef` on
  a geometry swap is what makes the geometry side count: a value set that arrived while the
  boundary file was in flight was applied to an empty source and dropped by Mapbox.
- **New guard, and it is the one I would not have predicted from the contract:**
  `pendingGeometryReloadRef`. `setData` is asynchronous and `isSourceLoaded` can still report
  `true` for the *previous* data for a tick afterwards, so an apply made immediately after
  `setData` can succeed against geometry that is about to be replaced — and Mapbox then drops
  the state when the new data lands, leaving the existing `sourcedata` handler with nothing to
  do because its `appliedStatesRef === statesRef` check passes. The ref forces exactly one
  re-apply per geometry load. Re-applying is idempotent. This was harmless while geometry was
  synchronous and is a live hazard now.

## 6. The grouped chart regression — FIXED, not left disabled

The coordinator's correction was right and Track C's premise was wrong: at HEAD the state held
`NationalAggregation` values (`"DNO"`) and `AGGREGATION_GROUPINGS` was keyed by those same
values, so the grouped rollup worked. Track B's move to lowercase region-type names is what
broke it. **We caused it.** It is working again.

What changed:

- `useGspAggregateData` takes `regionNames: string[]` and calls
  `rollUpRegionSeries(series, regionNames, groupName)`. No `RegionBridge`, no numeric id.
- `gsp-pv-remix-chart/index.tsx` branches on **`level.derived`, not on the level's name**.
  Derived ⇒ the selected feature id *is* the group's key in the grouping file, resolved with
  `groupRegionNames(useLevelGroupings(level).data, name)`. Non-derived ⇒ the feature ids are
  the map's (numeric at GSP level), resolved by the new `useGspRegionNames`.
- **The mismatch is structurally impossible now, not fixed by hand.** There is no
  region-type-name-keyed lookup table left anywhere in this path: the grouping URL comes from
  `config/countries.ts` keyed by the level's own `regionType`, and the group name comes from
  the asset itself. `AGGREGATION_GROUPINGS` is deleted.

**Tests, since this broke silently twice and nothing caught either:**

- `use-gsp-region-data.test.tsx` — `useGspAggregateData` against MSW with the real shipped
  `dno-groupings.json`: a real group name (`"UKPN (London)"`, chosen because four of the
  recorded fixture's five published regions fall in it) yields `forecast.regionName === group`,
  a series with **at least one numeric `powerMw`**, `capacityMw > 0`, one `memberLabel` per
  member that is a label rather than a raw region name, and **one** `/forecasts/period` request
  for the whole group. A blank chart — `undefined`, `[]`, or all-null values — fails it. Plus:
  a null selection disables the hook rather than charting zeroes, and `useGspRegionNames` turns
  `["67"]` into `["citr_1"]`.
- `data.reconciliation.test.ts` — the same claim at the pure level, plus a new test that every
  `derivedRegionTypes` key is lowercase and matches its own grouping URL, so a capitalised key
  cannot creep back in.

## 7. Files touched outside the original ownership list

- `components/charts/gsp-pv-remix-chart/use-gsp-region-data.ts` + `index.tsx` — handed to me
  mid-track by the coordinator.
- `components/helpers/data.reconciliation.test.ts` — not in either list, but it is a test *of*
  `data.ts` and could not survive the signature change. Migrated to the shipped
  `public/geo/gb/*-groupings.json`; assertions unchanged in substance.
- `components/charts/gsp-pv-remix-chart/use-gsp-region-data.test.tsx` — extended (came with the
  file above).

`hooks/data/index.ts` was **not** touched; consumers import `use-map-geometry` by path to avoid
a collision with another track. Worth adding the export at the wave boundary.

## 8. Assumptions — the part that needs Brad

1. **`nationalCapacityMw` still sums all 338 regions, including the six legacy ones.** My brief
   said a `LEGACY_REGIONS` region "must not be summed"; Track A deliberately left this number
   alone as Brad's call, and it is a *published* figure (the map popup's "% of National"), so
   filtering it moves what users see by 3.1 %. I did not override that decision. The doc
   comment is corrected with Track A's prose and carries a `TODO(brad)` naming the one-line
   change. **Geometry and the feature-state join do exclude the six** — nothing legacy is drawn.
   This needs a decision, not another agent.
2. **The `national` aggregation level now has no values path, and I did not build one.**
   `forecasts/period` and `generation/period` 400 on `region_type=national`, so
   `useMapRegionValues` returns a `null` scope for it and fetches nothing. Previously it drew
   the national outline from `data/national_gsp_zone.json`, a `{ National: [every gsp_id] }`
   grouping that Phase 5 ships no replacement for. `measuringUnit.tsx` offers only the finest
   level and `dno`, so nothing reaches it today. If the national map level is wanted back it
   needs either a synthetic all-regions group or the snapshot endpoints — a small decision, not
   an oversight to fix silently.
3. **`deltaMap` no longer depends on `pages/index.tsx` forcing the level.** It takes
   `defaultLevelOf(useAggregationLevels())` — the country's finest non-derived level — directly.
   Same rule as the initial state, so the two cannot drift, and it works for NL. The forcing in
   `pages/index.tsx` is now redundant for this file (still needed for the rest of the view).
4. **The registry's `joinTransform` is applied to the GeoJSON feature key, not the region name.**
   That is what the old `byGspCode` did (`lowercase(properties.GSPs) === region.name`) and what
   both GB and NL need. `geoAliasesFor` keys are stored already in the transformed form, per
   Track A. Pinned by a test.
5. **A derived level draws every polygon in its shapes file, whether or not the grouping file
   has a group of that name.** A group with no polygon has nowhere to draw; a polygon with no
   group draws unstyled. Neither is silently dropped.
6. **Two "loaded" states are deliberately separate.** `geometry` becomes available as soon as
   the shapes land; `isLoading` stays true until the groupings do too. So a derived level draws
   its borders a frame before its fills. That reads as progress rather than as a fault, but it
   is a visible choice.

## 9. Findings the contract did not predict

- **The `isSourceLoaded`-after-`setData` race** (§5). The contract's three async hazards are all
  real; this is a fourth, and it only became reachable because geometry went async.
- **`geoAliasesFor` returning two features and a multi-part GSP being several polygons are the
  same case.** 362 GB polygons carry 335 distinct keys. Both resolve as "several features share
  one Mapbox id, one `setFeatureState` paints all of them" — so the non-1:1 requirement needed
  no special handling beyond not building a `Map` keyed the wrong way round.
- **The Off_NETS negative-id workaround still earns its place**, contrary to Track A's
  suggestion that it might be obsolete. There are now *seven* unmatched features across three
  keys (`off_nets(unassigned)` ×5, `grem_p`, `seab1`), and feature state still cannot tolerate
  two features sharing an id. Pinned by a test asserting the ids are distinct and negative.
- **`buildMapGeometry` must not mutate its input.** The fetched asset is shared between the
  forecast and delta maps through `loadGeoAsset`'s cache, so the v0 habit of writing `id` onto
  the source features would corrupt the other map. It spreads; there is a test.
- **`NationalAggregation` now has no PRODUCTION importer at all.** Grepped: the only remaining
  import is `components/helpers/aggregationLevels.test.ts`, which compares the derived level
  list against the enum's members. Left in place per the brief — a later wave deletes it — but
  the deletion is now unblocked, and that test is the only thing that has to move with it.
