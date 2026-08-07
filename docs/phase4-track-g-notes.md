# Phase 4, Wave 4 — the by-hand cleanup

Working notes for the last step of the view migration: deleting the orphaned v0 fetches,
decomposing `pages/index.tsx`, and retiring `types/quartz-api.d.ts`. Companion to
`phase4-progress.md` (whose "Wave 4" section is the plan this executes) and
`phase4-contract.md`.

Baseline going in: `npx tsc --noEmit` exit 0, `npx jest` 31 suites / 943 tests.

---

## 1. `pages/index.tsx`: 818 → 169 lines

Every v0 fetch for the national and regional views is gone, and with it the four parallel
god-objects. Deleted outright:

- `useGetGspForecast` and its call — the per-scrub-tick refetch that set
  `start_datetime_utc === end_datetime_utc === targetTime`. This was the leading suspect for
  the map's felt lag (see `phase4-progress.md`, "Why the map is slow today", item 3).
- the five comparison-model national forecasts (`nationalIntradayECMWFOnlyData`,
  `nationalMetOfficeOnly`, `nationalSatOnly`, `nationalPvnetDayAhead`,
  `nationalPvnetIntraday`) and their five `Sentry.captureMessage` calls
- the primary `national/forecast?model_name=blend` fetch — it was genuinely double-fetched
  while `pv-remix-chart.tsx` also fetched it through the v1 layer
- both `national/pvlive` regimes, the N-hour forecast, and `/system/GB/gsp/`
- both `gsp/pvlive/all` fetches (historic + rolling) with the `actualsLastFetch30MinISO` /
  `actualsHistoricBackwardIntervalMinutes` / `allGspActualHistory` / `allGspActualFuture`
  state machine that stitched them together
- `currentYieldSet`, `currentYields` and the `gspDeltas` memo — `useGspDeltas` replaced them

### What stayed, and why it is not a container

The plan said "decompose into per-view containers". **It cannot be done as written, and this
is the one deliberate deviation from the plan in wave 4.** All three maps stay mounted at once
(hidden by class, so Mapbox never re-initialises on a view switch) inside `#map-container`,
while the three charts live inside `SideLayout`. A per-view component would have to render into
both halves of the layout at once, which React cannot do without portals. Restructuring the
layout to make it possible is a visual-risk change that has nothing to do with the data
migration, so it was not bundled in here.

What was extracted instead is per *concern*:

- **`components/hooks/useSitesViewData.ts`** — the whole Solar Sites data path. This is the one
  genuine container: sites are Phase 5 and still on v0, and their map and chart sit in
  different halves of the layout, so the data has to be held above both. Quarantining it means
  Phase 5 has exactly one file to migrate rather than a slice of the page component. It owns
  the `sitesLoadingState` global write too, since nothing else has all three fetches' triples.
- **`components/hooks/use-map-chrome.tsx`** — the three Mapbox effects (resize on view change,
  resize on dashboard-mode change, recentre on country change). They exist *because* all maps
  stay mounted; the doc comment says so, since that is not obvious from the code.
- **`components/layout/deprecated-domain-notice.tsx`** — the nowcasting.io banner, with its
  host detection still in an effect so SSR and first client render agree.

What is left in the page is genuinely page-level: view routing, the layout, Sentry identity,
the cookie-persisted `visibleLines`, and the "unset clicked region / force GSP aggregation on
Delta" effect.

## 2. The `Combined*` objects, dissolved

`CombinedData`, `CombinedLoading`, `CombinedValidating` and `CombinedErrors` are deleted from
`components/types.d.ts`. Every consumer had already stopped *reading* them in waves 1–3 and was
carrying the prop only because `pages/index.tsx` still passed it; those props came off `Header`,
`PvLatestMap`, `DeltaMap`, `PvRemixChart` and `DeltaViewChart` together with the passing side.

**`computeLoadingState` went with them, and so did the `loadingState` global it wrote to.**
Grep confirmed the global had no readers at all — Track B's chart and Track F's delta chart
were its last two, and both moved to `useLoadingState()`. `pages/index.tsx` was writing it to
nobody. `hooks/data/use-loading-state.ts`'s doc comment, which described `computeLoadingState`
in the present tense, now describes it in the past.

Also dropped from `types.d.ts` as their last consumer went: `AllGspRealData`, `GspRealData`,
`GspAllForecastData`, `GspEntity`, `GspEntities`, `NationalNHourData` and
`ElexonForecastValue`.

**One incidental change worth knowing.** The non-exported `type X = …` declarations in
`types.d.ts` were reachable by importers only because of how TypeScript resolved that
particular file; removing the `types/quartz-api` import changed that and every one of them
started erroring with "declares X locally, but it is not exported". They are all explicitly
`export type` now, which is what they should always have been.

## 3. The two enums, out of the `.d.ts`

`NationalEndpointLabel` and `SitesEndpointLabel` now live in **`components/endpoint-labels.ts`**,
a real module. They are values; a `.d.ts` is erased at compile time, so under ts-jest an
`export enum` declared in one is `undefined` at runtime.

The proof it worked is what could be deleted:

- the `jest.mock("../types.d", () => ({ NationalEndpointLabel: {…}, SitesEndpointLabel: {…} }))`
  block in `components/charts/pv-remix-chart.test.tsx`, which existed purely to hand the real
  status component something to read
- the duplicated `ENDPOINT_LABEL` literal in `hooks/data/use-loading-state.ts`, which is now
  `= NationalEndpointLabel`

`types.d.ts` re-exports the two `*KeysType` aliases from the new module, so no importer of the
types had to change.

## 4. `types/quartz-api.d.ts`, retired

Deleted. Its five importers went as follows:

| importer | resolution |
| --- | --- |
| `pages/index.tsx` | all v0 fetches deleted (§1) |
| `components/types.d.ts` | `Combined*` and the v0 GSP payload types deleted (§2) |
| `components/helpers/data.ts` | v0 pipeline deleted (§5) |
| `components/helpers/data.test.ts` | reduced to the B2 window helpers (§5) |
| `components/helpers/data.geo.test.ts` | deleted with the pipeline it characterised (§5) |

## 5. The v0 value pipeline, out of `helpers/data.ts`

Deleted: `getGspActualValueMwForTime`, `getGspForecastForTime`, `setFeatureObjectProps`,
`mapGspFeatures`, `mapZoneFeatures`, `generateGeoJsonForecastData`, and the compact-payload
family (`filterCompactHistoricData`, `filterCompactFutureData`,
`getOldestTimestampFromCompactForecastValues`, `getOldestTimestampFromForecastValues`,
`calculateIntervalDuration`, `calculateHistoricDataStartFromCompactValuesIntervalInMinutes`,
`calculateHistoricDataStartFromForecastValuesIntervalInMinutes`). The maps had already stopped
calling the first group in wave 1; `pages/index.tsx` was the only caller of the second.

**Kept**, and deliberately so: the seven memoised boundary-file loaders (all still used by
`buildMapGeometry` and `AGGREGATION_GROUPINGS`), and `getEarliestForecastTimestamp` /
`getFurthestForecastTimestamp` with their `floorToSixHoursUtc` / `ceilToSixHoursUtc` helpers —
the v1 hooks use those for the request window, and the B2 fix lives in them.

`components/helpers/data.geo.test.ts` is deleted whole. It was ~750 lines characterising
`generateGeoJsonForecastData` only. **The DNO double-count tripwire is not in it** — that is
`components/helpers/data.reconciliation.test.ts`, on the v1 `rollUpRegionSeries` rollup, and it
is untouched. `data.test.ts` keeps only its "forecast window helpers (B2)" block; everything
else in it tested a deleted function.

## Still open after this wave

- **Layout and screen real-estate, to be discussed at the end of Phase 4.** Brad's call: the
  current map-half / chart-half arrangement is an artefact of organic feature growth and has not
  been rationalised in a long time, and he thinks there is an easy refactor that serves current
  needs much better. Real per-view containers (see §1) fall out of that conversation, so the
  per-concern extraction here is explicitly the interim shape, not the intended end state.
- The **DNO double-count** remains pinned, not fixed — see `phase4-progress.md`'s
  "MUST REVISIT BEFORE PHASE 4 CLOSES". Nothing in wave 4 touched it.
- `components/charts/forecast-header/index.tsx` still accepts the v0 `pvLiveData` /
  `pvForecastData` props alongside the canonical ones, with the canonical winning. They are
  exercised by `country-wiring.test.tsx` and by nothing else; removing them is a small tidy,
  not a migration blocker.
- Sites remain on v0 by design: `SITES_API_PREFIX`, `sitesMap.tsx`, `solar-site-view/*`,
  `satelliteLayer.ts`, and now `useSitesViewData`. Phase 5.
- The NL-site removal loop in `useSitesViewData` splices the array it is iterating, so two
  adjacent `nl_` sites leave one behind. Pinned verbatim from `pages/index.tsx` with a comment
  naming the bug; it is Phase 5's to fix.

## 6. The v0 dialect out of `use-format-chart-data.tsx`

Both `fromV0Forecast` and `fromV0PvReal` are deleted, along with all ten `@deprecated` props
(`forecastData`, the five comparison-model arrays, `fourHourData`, `probabilisticRangeData`,
`pvRealDayAfterData`, `pvRealDayInData`) and the `: [...]` fallback branches that built
`generation`, `models` and `nHourPoints` from them. `forecastSeries`, `modelSeries`,
`nHourSeries` and `generationSeries` are the only inputs now.

Track F had already migrated the delta view's top chart, which was the stated prerequisite —
without it, deleting the dialect would have broken the delta view.

**B6 is narrowed, not closed.** `delta` and `gsp` are still read inside the memo and still
absent from its dependency array, and the two tests that pin that staleness are still there.
Only the entries for the deleted v0 props came out. The dep array is now
`[forecastSeries, modelSeries, nHourSeries, generationSeries, timeTrigger, nHourForecast, pLevels]`.

### The test suite, ported

`use-format-chart-data.test.tsx` went 66 → 58 cases, all eleven describe blocks intact:

- **Retired:** the four `describe("kW to MW conversion")` cases. They pinned `fromV0PvReal`'s
  `/1000` and its `null / 1000 === 0` / `undefined / 1000 === NaN` quirks — behaviour that no
  longer exists, since canonical `powerMw` is already MW. The canonical replacement is "a null
  reading is dropped rather than plotted as zero", and a canonical "a genuine zero survives as
  0" case was added so that assertion did not disappear with the block.
- **Generalised:** `describe("the five extra model series")` became "model series write whatever
  key the config names" — same five keys, same assertions, but reached through
  `ChartSeriesInput[]`, because "five" is a country-config fact now, not a fact about the hook.
- Everything else translated one for one. No behavioural divergence between the canonical and
  v0 paths was found: every ported assertion passed unchanged.

**One trap worth recording.** The B6 staleness tests need their `TimeSeries` fixtures hoisted to
module level. An inline fixture builder returns a fresh object every render, which forces
`useMemo` to recompute on its own and so *masks* the staleness the test exists to pin — the test
passes for the wrong reason. Two tests failed first and caught it.
