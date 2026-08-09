# Phase 5 — Track F notes: seasonal norms off the bundle

## What landed

- `components/charts/use-format-chart-data.tsx` no longer `import`s
  `data/national_metrics.json`. It calls the new `useSeasonalNorms()` hook instead, which
  fetches `getCountryConfig(country).seasonalNorms` through `lib/geo/assets.ts`'s
  `loadGeoAsset` module cache — the same idiom `useMapGeometry` uses, reused rather than
  duplicated.
- New `hooks/data/use-seasonal-norms.ts` (+ `use-seasonal-norms.test.ts`). URL-keyed the same
  way `useMapGeometry`'s internal `useGeoAsset` is: the fetched entry is only returned when its
  URL still matches the current country's URL, so a country switch mid-fetch cannot land a
  stale country's norms after the switch.
- **Correctness fix**: `seasonalNorms` had zero consumers before this; the bundled
  `national_metrics.json` (GB-only data) was applied unconditionally regardless of selected
  country, so NL's national chart was silently drawn with GB's seasonal norms. Now
  `useSeasonalNorms()` returns `undefined` for any country whose config has `seasonalNorms:
null` (NL today), and `undefined` is also what it returns while a real fetch is in flight.
  `useFormatChartData` treats both identically: `if (!gsp && nationalMetrics)` — no
  `SEASONAL_*` keys are written at all when norms are absent, for either reason. NL now renders
  no seasonal-norm band/line, not GB's, not a zero-shaped stand-in.
- `data/national_metrics.json` (the bundled file) itself was left in place. Only the `import`
  that pulled it into the JS bundle was removed.

  **Correction (checked at phase close): do not delete it.** It is the *input* to
  `scripts/build-geo-assets.mjs:171`, which emits `public/data/gb/national-metrics.json` from
  it. Nothing imports it into the bundle any more, so it costs nothing shipped, but removing
  it breaks the asset build. The same is true of the other `data/*.json` the script reads.

## tsc fallout (fixed, in-scope)

Removing the JSON import surfaced two pre-existing type holes that had been invisible because
the whole `nationalMetrics`-derived chain was implicitly `any` (an `@ts-ignore`d index
expression against the JSON-literal type resolves to `any`, which then propagated through
`seasonalMean`, `seasonalMetricData.pLevels`, and the `as SeasonalPValue` cast). Giving the
data an honest type (`SeasonalNormsData`, `Record<string, Record<string, {mean, pLevels}>>`)
made TypeScript check that chain for real, so two casts had to be made explicit:

- The invalid-date branch of `getSeasonalMetricsForDate` returned `seasonalMean: 0`
  (a number) against the valid branch's `number[]`. Changed to `[] as number[]` — identical
  runtime behaviour (`0[i]` and `[][i]` are both `undefined` in JS, so the downstream `* NATIONAL_CAPACITY` still produces `NaN` either way), just a type that unifies with the other
  branch.
- The `SeasonalPValue` object pushed into `seasonalBounds` is genuinely built from 48-slot
  arrays (`seasonalMetricData.pLevels[i]`), not the single numbers `SeasonalPValue`'s type
  declares — that mismatch predates this change and was only ever hidden by `any`. Changed the
  cast to `as unknown as SeasonalPValue` with a comment explaining the mismatch rather than
  silently re-hiding it. `remix-line.tsx` (where `SeasonalPValue` is declared) is out of my
  file ownership, so I did not change the type there; flagging this as something worth fixing
  properly in whichever track owns that file.

## Test changes

- `use-format-chart-data.test.tsx` now mocks `useSeasonalNorms` (returning the fixture
  synchronously by default in `beforeEach`) rather than importing the bundled JSON, so none of
  the ~30 existing synchronous `run(...)` assertions had to become async.
- The fixture the tests read from is `public/data/gb/national-metrics.json` (Track A's shipped
  asset) — verified byte-for-byte identical to the retired `data/national_metrics.json` before
  switching the import, so the hand-checked "July 1st 10:30 UTC" assertion's values are
  **unchanged**.
- Added one test in the `use-format-chart-data.test.tsx` "seasonal norms" block: norms
  `undefined` (covers both loading and "no dataset for this country") writes no `SEASONAL_*`
  keys.
- New `hooks/data/use-seasonal-norms.test.ts`, modelled on `use-map-geometry.test.tsx`'s
  deferred-promise stub: GB fetches and resolves its asset; NL fetches nothing and stays
  `undefined`; a country switch mid-fetch never applies the stale response; switching back to
  an already-resolved country doesn't refetch.

## Assumptions

- Treated a failed fetch the same as "no dataset" (swallowed, no error state) rather than
  surfacing an error, since there's no UI for a seasonal-norm-specific error today and the
  chart's only sane behaviour either way is "no seasonal line."
- Did not delete `data/national_metrics.json` itself — only its import — since the contract's
  asset-deletion language was about the `require`/bundle path, and removing files outside my
  declared scope felt like the wrong side of the line to guess on.

## Results

- `npx tsc --noEmit`: exit 0 (one unrelated pre-existing error in
  `components/map/use-map-region-values.test.tsx` from a concurrently in-flight, uncommitted
  change outside this track's scope — reproduced with this track's files stashed out, so not
  caused by this change).
- `npx jest`: 37 suites / 936 tests green for everything in scope. One unrelated suite
  (`components/charts/pv-remix-chart.test.tsx`) fails on `clearImmediate is not defined` /
  `markResourceTiming is not a function` — an undici/jsdom fetch-polyfill issue, reproduced
  identically with this track's files stashed out, so pre-existing/concurrent and not caused by
  this change.
- `npx next build`: exit 0. `/` First Load JS: **828 kB** (down from the stated baseline of
  888 kB).
