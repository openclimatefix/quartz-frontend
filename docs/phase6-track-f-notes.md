# Phase 6, Track F — the map fan-out

Wave 3. The one thing Track D listed as "another track will have to pick up": the map draws
every **enabled** country rather than only the focused one, and every feature says whose it is,
so contract §1's "clicking a region focuses its country" is live rather than latent.

Track E was resequenced behind this, so `components/map/feature-state.ts` — the fill
expressions included — is in this diff. What that leaves for E is at the end.

## The premise, verified before building

The brief said to check three claims rather than inherit them. All three held:

- **The click path's cross-country branch was unreachable.** `useMapGeometry` took its country
  from `useFocusedCountry()` with no way to ask for another, so every feature on the map
  belonged to the focused country and `featureCountry !== focusedCountry` could not be true.
- **The geometry loader really was single-country**, same reason.
- **`REGION_COUNTRY_PROPERTY` was genuinely absent**, and not merely unread. Checked against
  the shipped assets rather than the code: the six boundary files under `public/geo/` carry
  `fid,GSPs,GSPGroup,SSEP17Zone,DSCPs,InGroup_,CDCA_I030` (GB gsp), `ID,Name,LongName` (dno),
  `id` (zone), `id,name` / `name` (national), `name,created_at,updated_at,cartodb_id` (NL
  province). No `country` anywhere, and `buildMapGeometry` — which does take a `country`
  argument, for the alias tables — never wrote one either.

One claim did **not** hold, and it is the one deviation from the brief. See "Not the listings
hook" below.

## What the seam is

Two things, both in `components/map/`.

**`country-features.ts` — the namespace.** Every country's polygons go into the **one**
existing `latestPV` source, merged, and each feature is stamped as it is loaded:

```
properties.country     "GB"           whose region this is — the click path reads it
properties.featureKey  "GB:5"         the country-qualified Mapbox feature id (promoteId)
properties.id          5              UNCHANGED: the country-local region id
```

The third line is the important one. `properties.id` stays the domain id, because that is what
`selectedMapRegionIds` (country-scoped state), the GSP sub-chart, the CSV and the presence
bridge all speak. The namespace is a property of the *map layer* and stops at this module.

**`use-enabled-country-map-data.tsx` — the fan-out.** One `useMapRegionValues` per enabled
country, merged into one collection and one feature-state map.

### Why one source, not one per country

The alternative — a source and a fill/border/select-border trio per country — makes the number
of countries visible to everything downstream: the click handler registers per layer, the
select-borders filter has to be set on the right one, `applyFeatureStates`'s
`removeFeatureState` sweep runs per source, and `map.tsx`'s satellite `beforeId` search has to
know which of N layers is bottom-most. Germany would then be a code change in five places,
which is exactly what `config/countries.ts` says adding a country must not be. One source costs
exactly one thing — ids must be unique across countries — and that is what the namespace buys.

### The feature-id scheme, and why it is not optional

`featureKeyFor(country, id)` → `` `${COUNTRY}:${id}` ``, always a string.

Three collisions it prevents, none of which announce themselves:

1. **Numeric region ids.** GB keys GSPs on the API's `gsp_id`, counting from 1. Any country
   whose API does the same collides on every region — Germany, on the evidence of GB. Mapbox
   does not complain; it paints GB's number on Germany's polygon.
2. **Unmatched features.** `buildMapGeometry` gives a feature with no region a distinct
   *negative* id, counting from −1 **per collection**. GB and NL both produce −1 today, so this
   one is reachable with the two countries we ship.
3. **String/number spelling.** The click path builds keys from `selectedMapRegionIds` (strings)
   and geometry builds them from the API (numbers). `featureKeyFor` normalises both, which is
   what let the old `Number(id)` coercion in the click handler go — it existed only because
   `["in", "id", "5"]` does not match a numeric `5`.

All three are pinned in `country-features.test.ts`.

### Why child components, and why three separate records

The enabled set is variable-length and hook rules forbid iterating over it, so each country
gets a component that calls the hooks and reports upward. They render `null`; they exist for
their hooks. `useEnabledCountryMapData` returns them as `loaders`, and **the caller must render
them on every arm** — dropping them on a failure arm unmounts the pipeline that produced the
error, which clears the error, re-renders the normal arm, remounts, re-fails: a flicker loop
rather than a failure state. Both map components render them outside their branches, with a
comment saying why.

Geometry, values and status are stored in **three** records rather than one. The map calls
`setData` only when the merged collection's identity changes; merging out of one combined
record would give geometry a new identity whenever a number moved, so every scrub tick would
re-parse and re-tessellate 9 MB of GB boundaries. That is the cost Phase 5 spent itself
removing, and this is where it could have come back. Pinned.

### Not the listings hook — the one deviation from the brief

The contract, Track A's notes and my brief all say the map fans out over
`useEnabledCountryListings()`. **It must not, today.** That hook intersects enabled with
*entitled*, and the Auth0 country claim does not exist on the tenant yet —
`lib/api/auth/entitlement.ts` says so in its opening paragraph, and `readCountryClaim` returns
`[]` for every real session. Fanning the map out over it would draw **no countries at all** in
production, beside a chart that follows `useFocusedCountry()` and is not entitlement-gated and
would carry on showing GB perfectly well. A blank map from a claim nobody has shipped.

So the fan-out reads `useEnabledCountries()`: enabled ∩ configured, synchronous, never empty,
always contains the focused country (`setEnabledCountries` keeps all three invariants). It is
also what Track A's own note sanctions — "a map layer or a cursor grid can depend on it
synchronously" — and it means the map draws from the first frame rather than waiting on
`/countries`.

Entitlement is still enforced where it can wait for the claim: the header toggle will not
enable a country the user has no access to. **When the claim lands, the durable fix is for
`setEnabledCountries` to drop unentitled codes** — one place, every consumer inherits it —
rather than each fan-out filtering for itself. That is a Wave 4 / post-claim item, not a
change to make here.

## What changed in behaviour

**The map draws every enabled country.** Turn NL on and both draw. Each country is at **its
own** aggregation level, because the level is country-keyed state: GB can be on its DNO rollup
while NL is on provinces, in the same frame.

**Clicking a non-focused country's region focuses that country and selects there.** The branch
was already written (Track A); it now has features that can reach it. Shift-click is confined
to the focused country's features — `queryRenderedFeatures` answers for the whole layer, and at
a point where two countries' polygons overlap it would otherwise build a selection spanning
both, which is what §1 makes unreachable, arriving through the back door.

**The selection outline matches on `featureKey`, not `id`.** With several countries in one
source a bare region id can name a region in each of them, and outlining both is a silent wrong
answer. The filter is built from the focused country, which is always the selection's country
by §1.

**Opacity bands are per feature, not per map.** `fillOpacityExpression(unit, isGrouped)` became
`fillOpacityExpression(unit)`, reading a `grouped` flag off feature state. A single argument
cannot describe a frame containing both a GB DNO rollup (bands ten times higher) and an NL
province — one of the two gets the other's thresholds, which is not an error, just a map where
every NL province sits in the faintest band. `namespaceFeatureStates` stamps the flag per
country.

**The "% of national" popup divides by the region's own country's capacity.** It used to hold
one national figure; with two countries drawn that reported NL regions as a percentage of GB.

**Nothing is fetched eagerly.** Each country fetches only its own level's assets, through the
same URL-keyed cache. Enabling two countries fetches two countries' geometry — the Phase 5
property this had to preserve, and the reason the per-country hook instance (rather than a
prefetch-all) is the shape.

## Files

New: `components/map/country-features.ts`, `components/map/use-enabled-country-map-data.tsx`,
and their two tests.

Edited: `components/map/{pvLatestMap,deltaMap,use-update-map-state-on-click,feature-state,
use-map-region-values}.tsx|ts`, `hooks/data/{use-map-geometry,use-aggregation-levels}.ts`,
`components/helpers/data.ts` (one optional field on `MapFeatureState`).

`components/map/map.tsx` was **not** touched: it moves its own camera on `focusedCountry` and
knows nothing about how many countries the source carries, which is the right amount for it to
know.

Three hooks gained an optional trailing `country` argument, defaulting to the focused country
so every existing caller is unchanged: `useMapGeometry`, `useLevelGroupings`,
`useMapRegionValues`, `useAggregationLevels`, `useCurrentAggregationLevel`. The last one now
reads the level through `readCountryScoped` rather than `useCountryState`, which is
focused-country-only; it is the same read.

`hooks/data/use-countries.ts` was **not** extended. Nothing was missing from it.

## Intentional test changes

Four in `map-value-join.test.ts`, all consequences of `fillOpacityExpression` losing its
`isGrouped` argument: three call sites drop the argument, and the grouped-bands test now sets
`grouped: true` in the feature state instead. One test was added there — a grouped and an
ungrouped feature banded differently *by the same expression*, which is the property the
signature change exists for and the one an argument could not express.

Everything else is addition: 21 tests over the two new suites.

## Verification

`yarn tsc --noEmit` clean bar the known pre-existing `jest.globalSetup.ts(14,1) TS1208`.
`next lint` **17 warnings, 0 errors** — the baseline exactly; the four warnings reported
against `use-update-map-state-on-click.ts` are its pre-existing `exhaustive-deps` ones and the
total is unmoved. `next build` green (exit 0, "Compiled successfully"). Full Jest suite
**1039 passed / 42 suites**, from a baseline of 1017 / 40.

## For the live pass

This track is almost entirely interactive, and the failures it can produce look plausible
rather than broken. Worth being specific:

- **Enable NL with GB focused.** Both countries' polygons should draw and both should be
  coloured. You will have to zoom out — the camera is still the focused country's, by design.
- **Click an NL region while GB is focused.** Focus should move to NL (chart, headline figures,
  level selector and the chart-header picker all follow), the NL region should be outlined, and
  any GB selection should be gone. This is the gesture the whole track exists for.
- **Shift-click across the two countries.** It should be impossible to end up with regions of
  both outlined at once.
- **The selection outline at GSP level.** This is the id path that changed. Select a GB GSP,
  confirm exactly one region is outlined and that no NL region lights up with it. Then check
  the same in reverse.
- **Put GB on its DNO or Zone level with NL enabled and on provinces.** GB's rollup polygons
  should read on the ten-times bands and NL's provinces on the region-level ones, at the same
  time. Before this change one of the two would have been visibly flat.
- **The popup in "% of capacity" mode on an NL province.** The percentage should be of NL's
  national capacity, not GB's — sanity-check it against the NL headline figure.
- **Scrub with both countries enabled.** It should feel exactly as it does with one. If the
  map visibly hitches per tick, the geometry identity has been broken somewhere and boundaries
  are being re-parsed; that is the one regression a test can miss in practice.
- **Toggle NL off again.** Its polygons should vanish immediately, with no leftover outline and
  no ghost colouring.
- **The network tab on first load.** GB-only should fetch GB's boundary files and nothing of
  NL's. Enabling NL should fetch NL's, once.

## For Track E

`feature-state.ts` is yours again as you found it, with these differences:

- **`fillOpacityExpression(unit)` — the `isGrouped` argument is gone**, replaced by a
  per-feature `grouped` flag in feature state. If the diverging encoding needs a per-feature
  domain too, that is the pattern to follow: put the fact on the feature, not in the signature.
  Any per-map argument you add reintroduces the "one country's thresholds applied to another's
  regions" failure.
- **Feature ids are `"GB:5"`, not `5`.** `applyFeatureStates` is unchanged and still takes a
  `Map` keyed by whatever the caller supplies; the caller now supplies namespaced keys.
  `country-features.ts` has `countryOfFeatureKey`/`regionIdOfFeatureKey` if you need to get
  back out.
- **A handoff, deliberately not done here.** `ColorGuideBar` and `MeasuringUnit` read
  `useCurrentAggregationLevel()`, i.e. the *focused* country's level, so with two countries at
  different levels the legend explains one of the two maps on screen. Both files are yours and
  I did not touch them. The honest options are to label the guide with the focused country, or
  to show a band set per drawn country; that is a design call, not a mechanical one. Both hooks
  now take an optional country argument if you want the second.

## Deferred, and why

- **Entitlement on the enabled set.** Above. It belongs in `setEnabledCountries` when the claim
  ships, not in the map.
- **The constraints overlay is still focused-country-only.** It is a registry `overlays` entry
  and GB is the only country with one, so fanning it out today would be untestable code. The
  same fan-out shape applies when a second country gets one.
- **The camera does not frame the enabled set.** `map.tsx` jumps to the focused country's
  stored viewport, so enabling a second country does not zoom out to show it. Changing that
  means overriding a viewport the user set by hand, which is a design decision (§3 says the map
  is the ground, not that it auto-frames) and belongs with the shell rather than the geometry.
- **The country chip animation** Track A asked for. Still presentation, still Track D/E's
  surface — but note that this track is what makes it *fire*, so it is now visible when focus
  moves without any signal.
- **`deltaMap`'s popup still reads `properties.GSPs`**, a GB-only boundary-file property, so an
  NL region's popup shows an empty sub-line. Pre-existing, not introduced here, and it is chart
  copy rather than geometry.
