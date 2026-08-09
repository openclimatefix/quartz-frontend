# Phase 5 — the contract

> **Phase 5 is delivered. This document is now history, not instructions** — read
> `phase5-progress.md` for what actually landed. Three things below were superseded during the
> phase and are wrong if followed literally:
>
> 1. **The GSP set.** Brad ruled mid-phase that the 2026 NESO file is the *definitive* GSP set;
>    the API serves its extra merged/legacy spellings only for backward compatibility of client
>    scripts. So the alias map is **empty** (all six candidates were duplicates, not naming
>    disagreements) and the six are listed in `LEGACY_REGIONS` instead. The "338/338 after
>    aliases" target below is not the target that was met.
> 2. **`carr_1` / `fidf_1` is stated backwards below.** The 2026 file carries a *merged*
>    `carr_1|fidf_1` feature; the API serves both halves *and* the merged region.
> 3. **The capacity double-count is resolved, not pinned.** `nationalCapacityMw` now excludes
>    the legacy regions (22,588 MW → 21,783 MW). The remaining −122 MW is a coverage gap.
>
> The DNO 15-way double-count *is* still pinned, as written below.

Companion to `adaptive-eu-ui.md` and `phase4-contract.md`. This is the seam every Phase 5 track
codes against. Read it before touching anything; if a track needs to change a signature here, it
stops and says so rather than changing it unilaterally.

Baseline at the start of the phase: `npx tsc --noEmit` exit 0, `npx jest` **30 suites / 869 tests**
green.

---

## What Phase 5 is

Two pipelines and three peripherals:

1. **Region types stop being GB-shaped.** `NationalAggregation` (GSP / Zone / DNO / National) is an
   enum with ~50 call sites. It is replaced by the country-derived list that
   `components/helpers/aggregationLevels.ts` already produces and that currently has **zero**
   production consumers.
2. **Geometry stops being bundled.** ~36 MB of GeoJSON is `require`d into the JS bundle from
   `components/helpers/data.ts`. It moves to `public/geo/{country}/` and is fetched on demand via
   the registry's `geo` / `derivedRegionTypes` URLs, which already exist and already 404.
3. **Peripherals** — sites, satellite, the status banner — keep their current backends but route
   through the shared token-cached fetcher and carry a `Scope`, so each later swap is one file.

Plus the Mapbox token to env, and the bundle measurement that proves point 2 landed.

---

## Findings that set the plan (measured 2026-08-07, do not re-derive)

### The NL boundaries already exist

`origin/feat/NL-toggle:apps/nowcasting-app/data/netherlands.json` — 400 KB, 12 provinces, keyed on
`properties.name` (`"Groningen"`). Lowercased it joins **12/12** against the
`nl-regions-province.json` fixture, which is exactly what the registry's
`province: { joinProperty: "name", joinTransform: "lowercase" }` declares. Nothing needs sourcing.

There is no NL *national* outline. Dissolve the 12 provinces into one feature named `"netherlands"`
— the manifest's national region name — at asset build time.

### The GB boundary refresh moves the gaps rather than closing them

`GSP_regions_4326_20260209.json` is already on `origin/development` (commit 55baa86). Against the
live API's 338 GSP regions:

| file | features | unmatched API regions | unmatched features |
|---|---|---|---|
| `GSP_regions_4326_20250109.json` (current) | 349 | 7 | 4 |
| `GSP_regions_4326_20260209.json` | 362 | 6 | 7 |

The membership swaps sides — the 2026 file merges `brle_1|flee_1` and `iver_1|iver_6` where the API
splits them, and splits `carr_1`/`fidf_1` where the API merges them. **Take the 2026 file anyway**
(it is on `development` and arrives at merge regardless) **and add an alias map.** An alias map is
required whichever file ships.

### The API serves both sides of five GSP splits

Not a boundary problem — an API-side double-count, and a new finding:

```
iver_1  (25,433)  + iver_6  (9,448)   = 34,881 kW  = iver_1|iver_6   (gsp_id 158)
brle_1  (102,546) + flee_1  (358,548) = 461,094 kW = brle_1|flee_1   (gsp_id 41)
carr_1  (19,861)  + fidf_1  (53,697)  = 73,558 kW  = carr_1|fidf_1   (gsp_id 351)
seab1|safo_1 (229,841) overlaps safo_1 (110,776)
actl_2|cbnk_h|gree_h|peri_h|wesa_h        (gsp_id 4)   "Willesden (Zone 1)", 5,299 kW
actl_2|cbnk_h|gree_h|peri_h|powe_h|wesa_h (gsp_id 350) "Willesden (Zone 1)", 5,299 kW
```

Capacities reconcile to the kW, so these are redundant duplicates, not distinct regions.

**Consequence:** the 338 GSP regions sum to **22,587 MW** against a national capacity of
**21,905 MW** — 683 MW (3.1 %) over. `useMapRegionValues`'s `nationalCapacityMw` sums region
capacities and therefore carries this over-count today, and its doc comment claiming the API's
regions "*are* a partition, unlike GB's DNO groupings" is **wrong**. Correct the comment; do not
change the number without a decision.

This goes to the API owner alongside the DNO apportionment question. Until then it is pinned, not
fixed, in the same style as the DNO double-count.

### The DNO double-count is still unanswered

No word from the API owner on whether a GSP feeding two licence areas is legitimate. **So Phase 5
regenerates the grouping files name-keyed and reproduces the double-count exactly.** The 15
duplicate ids stay duplicated. `data.reconciliation.test.ts` keeps documenting the excess; it does
**not** flip to an equality assertion this phase. Its header comment must be updated to say so, or
the next reader will think the regeneration was supposed to fix it and didn't.

---

## Seam 1 — region types

### The state

`countryState.ts` currently holds `nationalAggregationLevel: NationalAggregation`. It becomes:

```ts
/** Region type as the manifest spells it (`"gsp"`, `"province"`, `"national"`), or the
 *  synthetic name of a derived level (`"dno"`, `"zone"`). Country-keyed, as today. */
nationalAggregationLevel: string;
```

Default is no longer a hardcoded `GSP`. It is **the finest non-derived level the country has** —
`gsp` for GB, `province` for NL — resolved from the registry, which is what makes NL work without
a guard. A country whose registry entry has no sub-national `geo` entry falls back to `"national"`.

`aggregationLevel: AGGREGATION_LEVELS` (NATIONAL / REGION / GSP / SITE) is the **sites** view's
level and is a different thing. Leave it alone this phase; it belongs to the peripherals track.

### The hook

New — `hooks/data/use-aggregation-levels.ts`:

```ts
/** The current country's aggregation levels, outermost first. `[]` for an unconfigured country. */
export const useAggregationLevels = (): AggregationLevel[];
/** The level matching the current `nationalAggregationLevel`, or the country's default. */
export const useCurrentAggregationLevel = (): AggregationLevel | undefined;
```

It composes `deriveAggregationLevels(getCountryConfig(country), regionTypes)` with the manifest's
region types from `useRegionTypes(scope)`. `deriveAggregationLevels` is already written and already
tested — **do not rewrite it**, and do not duplicate its fallback rules.

### The rule that replaces every `switch` on the enum

Components must not branch on the *identity* of a region type. They ask the level for what they
need:

- **Display label** — `level.label`, from the manifest. Not a hardcoded string, and not
  `regionType.toUpperCase()`.
- **Zoom band** — `level.minZoom` / `level.maxZoom`.
- **Is this a client-side grouping?** — `level.derived`. This is the only legitimate branch, and it
  is a branch on *kind*, not on name. `derived === true` means values come from a rollup over the
  source region type; `false` means they come from the API for that region type directly.
- **Ordering** — `level.level`, ascending from 0 (national).

`NationalAggregation.GSP` forced on entering the delta view (`pages/index.tsx`) becomes "the
country's finest non-derived level".

### Deletions this seam earns

`NationalAggregation` in `components/map/types.ts` goes, along with the shim comments on it and on
`AGGREGATION_LEVEL_MIN_ZOOM`/`MAX_ZOOM` in `constant.ts` that point at Phase 4. Those two zoom enums
survive only as the sites view's bands — if nothing but sites reads them when the track is done, say
so and leave them for the peripherals track.

---

## Seam 2 — geometry

### Asset layout

Exactly the paths the registry already declares. Nothing invents a new one.

```
public/geo/gb/national.json         national outline           joinProperty "name"
public/geo/gb/gsp.json              362 GSP polygons           joinProperty "GSPs", lowercased
public/geo/gb/dno-groupings.json    name-keyed grouping        derived level "dno"
public/geo/gb/zone-groupings.json   name-keyed grouping        derived level "zone"
public/geo/gb/dno.json              DNO polygons               (see below)
public/geo/gb/zone.json             NG zone polygons           (see below)
public/geo/gb/ng-constraints.json   overlay
public/geo/nl/national.json         dissolved provinces        joinProperty "name"
public/geo/nl/province.json         12 provinces               joinProperty "name", lowercased
public/data/gb/national-metrics.json  seasonal norms
```

`DerivedRegionTypeConfig` today carries a `groupings` URL but **no polygon URL** — GB's DNO and NG
zone shapes have nowhere to be declared. Add one field:

```ts
export type DerivedRegionTypeConfig = {
  …
  /** Boundary geometry for the derived level's own polygons. */
  geometry: GeoLayerConfig;
};
```

### Groupings become name-keyed

Today: `Record<string, number[]>` — grouping name → GSP **ids**. The numeric id only exists because
the bundled files predate v1, and `RegionBridge` exists solely to translate.

After: `Record<string, string[]>` — grouping name → v1 region **names** (`"citr_1"`).

```ts
export const groupRegionNames = (
  groupings: Record<string, string[]> | undefined,
  groupName: string
): string[] | undefined;

export const rollUpRegionSeries = (
  series: RegionSeries | undefined,
  regionNames: string[],
  groupName: string
): TimeSeries | undefined;          // note: no RegionBridge parameter
```

`buildRegionBridge` / `RegionBridge` survive only if something other than the groupings still needs
the id. Check; if nothing does, delete it and say so.

**The regeneration must be reported, not silently lossy.** Emit a manifest alongside the assets
listing every gsp_id that resolved to no v1 region name and every v1 region in no grouping. The
Phase 2 probe found `dno_gsp_groupings.json` resolving 348/349 refs and
`ng_gsp_zone_groupings.json` 306/317 — those numbers are the expectation to check against, not a
target to hit by dropping the awkward ones.

### Loading

New — `lib/geo/assets.ts`:

```ts
/** Fetch a GeoJSON/grouping asset once per URL per session. Module-level cache, not SWR:
 *  these are immutable build artefacts, and two maps mount at once. */
export const loadGeoAsset = <T>(url: string): Promise<T>;
```

New — `hooks/data/use-map-geometry.ts`:

```ts
export const useMapGeometry = (
  level: AggregationLevel | undefined,
  regions: Region[] | undefined
): { geometry: FeatureCollection | undefined; isLoading: boolean; error: unknown };
```

`components/helpers/data.ts`'s geometry half becomes **pure**: it takes the fetched
`FeatureCollection` as an argument and never loads anything. The `memoise`/`require` block at the
top of that file, and every `data/*.json` import it names, are deleted — that block is the whole
point of the phase's bundle number.

```ts
export const buildMapGeometry = (args: {
  level: AggregationLevel;
  shapes: FeatureCollection;
  groupings?: Record<string, string[]>;
  regions: Region[] | undefined;
  joinProperty: string;
  joinTransform?: GeoJoinTransform;
}): FeatureCollection;
```

### Geometry is now async, and the map must not flicker

The one real hazard in this seam. Today geometry is synchronous, so `setData` and the first
`setFeatureState` happen in the same tick. After the change the geometry arrives a frame or more
later than the values.

- Feature states must be **(re)applied after** geometry lands, not only when values change. A value
  update that fires while geometry is still loading must not be dropped.
- The map source is added once with an empty `FeatureCollection` and populated on arrival, rather
  than the source being added conditionally — conditional source creation is how layer ordering
  breaks against the satellite layer.
- Switching aggregation level while a fetch is in flight must not apply the stale response. Guard
  it; an out-of-order resolve paints one level's numbers onto another's polygons, which looks like
  plausible data and is the failure mode nobody catches by eye.

### The alias map

One file, `config/geo-aliases.ts`, GB only, keyed by country:

```ts
/** v1 region name -> the GeoJSON feature key(s) that draw it, where the API's splits and
 *  merges disagree with the published boundary file. See the contract for why this cannot
 *  be fixed by refreshing the file. */
export const GEO_ALIASES: Record<string, Record<string, string[]>>;
```

Six GB entries, from the 2026 file's unmatched set. A region aliased to two features draws both. Do
not fuzzy-match, do not pipe-split at runtime: the alias table is explicit so that it is reviewable
and so that a stale entry is visible rather than silently absorbed.

---

## Seam 3 — peripherals

Sites, satellite and the status banner stay on their current backends. What changes:

- Every one of them goes through `lib/api/auth/token.ts` (satellite already does, from Phase 2) and
  `useLoadDataFromApi`'s ad-hoc auth path is retired in favour of it.
- Each carries a `Scope` — `{ country, source, regionType }` — even where the current backend
  ignores the country. That is what makes the later v1 swap one file.
- `sitesMap.tsx` imports `data/gsp_regions_20220314.json` (20 MB) and
  `data/dno_regions_lat_long_converted.json` (5 MB) directly. These move to fetched
  `public/geo/gb/` assets like everything else — 25 MB of the bundle number lives here.
- The status API base URL and response shape are still open items. Isolate, do not invent.

---

## Test obligations

- `deriveAggregationLevels` is already tested; extend to cover the new default-level rule.
- A join-rate test over the shipped `public/geo/` assets, asserting the numbers in this document
  (GB 355/362 features and 332/338 regions *before* aliases, 338/338 after; NL 12/12). This is the
  test that catches an asset rebuild that silently drops polygons.
- `data.reconciliation.test.ts` keeps documenting the DNO excess. Update its header to say the
  Phase 5 regeneration deliberately did **not** fix it and why.
- A test that a region type with no boundaries in the registry is not offered as a level.
- The out-of-order geometry guard needs a test — resolve level B's fetch after level A's and assert
  A's feature states are never applied to B's geometry.

## Reporting obligations

Every track writes `docs/phase5-track-{x}-notes.md`: what landed, what it assumed, what it found
that the contract did not predict. Assumptions in particular — they are the thing that has to come
back to Brad.
