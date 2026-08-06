# Phase 4, Track D — the GSP drill-down chart on the v1 data layer

Working notes for moving `gsp-pv-remix-chart/` onto `hooks/data/`, following the dialect seam
Track B left in `use-format-chart-data.tsx`.

Companions: `phase4-contract.md` (the interface), `phase4-track-b-notes.md` (the seam this
follows), `phase4-progress.md` (in-flight state).

---

## What landed

### 1. v1 covers exactly one selected GSP; v0 stays for everything else

`gsp-pv-remix-chart/index.tsx` used to be single-purpose: `useGetGspData(selectedRegions)`
fetched and *summed* whatever GSP ids were selected, covering single clicks, shift-click
multi-select, and DNO/zone/national aggregation (via `dno_gsp_groupings.json` etc.) all through
one v0 code path.

v1's region-scoped hooks (`useRegionForecast`, `useRegionGeneration`) address exactly one
region each. There is no v1 endpoint that sums several GSPs for a chart's worth of a time
series — `forecasts/period`/`generation/period` return every region on a shared axis but take
no aggregation, and the contract already flags DNO groupings as **not a partition** (15 GSP ids
appear in two groupings, so a naive sum double-counts), fixed in Phase 5, not here.

So the chart now branches on `isSingleGsp = nationalAggregationLevel === GSP &&
selectedRegions.length === 1`:

- **Single GSP** (the common case — an ordinary map click): new `use-gsp-region-data.ts`,
  v1 hooks, canonical dialect into `useFormatChartData`.
- **Multi-select / DNO / zone / national**: unchanged `useGetGspData`, v0 dialect. Its file
  is untouched.

The two paths never double-fetch: `useGetGspData` is called with `isSingleGsp ? [] :
selectedRegions`, so its internal URLs go `null` (disabled) whenever v1 already has the
selection covered, and vice versa (v1's `enabled` argument is `isSingleGsp`).

**This is the one place I deviated from the brief's literal wording** ("replace
`use-get-gsp-data.ts` with the v1 hooks"). A literal replacement can't cover DNO/zone/national
selection with the two named hooks — there's no aggregation primitive in the contract for it.
Flagging per the brief's own instruction to stop and report rather than guess past an
ambiguity; happy to redo if the intended scope was different.

### 2. `use-gsp-region-data.ts` — the new hook

Resolves a numeric GSP id (what `selectedMapRegionIds` / the map click handler still speak) to
a v1 region name via `useRegions({country, source, regionType: "gsp"}).metadata.gsp_id` —
per the progress doc's "interim join" note, this is the intended bridge until Phase 5's
name-keyed boundaries land. Returns `Region.label` for the header title and `Region.capacityMw`
for the y-axis; the raw `citr_1` name only ever reaches the query path, never the UI.

Every underlying hook (`useRegions`, `useRegionForecast`, `useRegionGeneration` × 2 observers,
`useRegionForecast` again for the N-hour line) is called on every render regardless of
`enabled` — disabling means "resolve to a `null` scope", never "skip the call". Verified by a
test that renders with `enabled: false` and asserts zero requests.

Observers come from `useGenerationSources(scope)`, positionally onto `GENERATION`/
`GENERATION_UPDATED` — the same keys and the same "GB has two, don't assume a pair" shape
Track B used for the national chart. The two-key array is duplicated from
`pv-remix-chart.tsx`'s `GENERATION_CHART_KEYS` rather than imported, because that file imports
`GspPvRemixChart` (this component) — importing back would be a circular module dependency.

No hook here ever passes `model`. Confirmed against the contract: GSP time series are pinned
to the region type's default (`blend`), model selection is national-only.

### 3. `use-format-chart-data.tsx` — used, not changed

The chart now passes `forecastSeries`/`generationSeries`/`nHourSeries` (canonical) when
`isSingleGsp`, and the v0 arrays otherwise — exactly the two-dialect shape Track B built for
this. **No edit was needed to `use-format-chart-data.tsx` or its test file**; the v1 dialect
already covers what the GSP chart needs, including `gsp: true` (skips the national seasonal-norm
columns, already wired). The `@deprecated` props and `fromV0*` adapters are untouched — Track C
(delta view) still depends on them.

### 4. Header math, both dialects

`ForecastHeaderGSP` itself (presentational, in `forecast-header-gsp.tsx`) is unchanged. The
figures it's given (`pvValue`, `forecastPV`, `deltaValue`, the big current-forecast number) are
now computed by one `if (isSingleGsp) {...} else {...}` block in `index.tsx`, mirroring
Track B's `forecast-header/index.tsx`: canonical "latest actual" scans backwards for the last
point carrying a number (trailing `null`s are real — a value not yet reported — not a zero),
rather than v0's "newest first, take `[0]`". The v0 branch is the old code, moved but not
rewritten, so the DNO/multi-select path's numbers are pixel-identical to before.

There were no pre-existing tests pinning this component's exact header arithmetic (checked —
neither `index.tsx` nor `use-get-gsp-data.ts` had a test file before this change), so this
wasn't a characterisation constraint, just a straight port for the v0 half and a fresh
implementation for the v1 half.

One dead prop cleaned up in passing: `fourHourForecastAtSelectedTime` was computed in the old
`index.tsx` and never read anywhere. Dropped rather than ported.

---

## Tests added

`components/charts/gsp-pv-remix-chart/use-gsp-region-data.test.tsx` (5 tests), MSW over the real
`queries -> client -> normalise` machinery, same harness style as
`hooks/data/data-hooks.test.tsx` / `pv-remix-chart.test.tsx`:

- disabled (`enabled: false`) — every hook still runs, `scope` is `null`, zero requests.
- enabled but the GSP id doesn't resolve against `/regions` — stays disabled, no bogus path
  segment ever gets built.
- enabled and resolvable — the numeric id (67) resolves to `citr_1` via `metadata.gsp_id`,
  `Region.label` ("City Road") comes through for display.
- both observers fetched once each, keyed `GENERATION`/`GENERATION_UPDATED`; no request ever
  carries a `model` param.
- the N-hour series is gated on `nHour.show`, independent of the plain forecast request.

Suite: **30 suites / 941 tests, all passing** (baseline was 28/933; +2 suites / +8 tests — this
file plus its 5 tests, and `use-gsp-region-data.ts`'s hook itself has no separate suite).
`npx tsc --noEmit` exits 0. Prettier clean. Not committed.

---

## Assumptions and things worth checking

1. **Multi-select / DNO / zone / national selection is out of scope for this pass**, per §1
   above. If that's wrong and a v1-aggregated path was wanted here, it needs a decision on how
   to sum several regions' series (client-side sum over `forecasts/period`/`generation/period`
   filtered by `regionNames`, most likely) — that's new ground beyond what the contract
   describes today and beyond what I built.
2. **`Region.capacityMw` replaces the old `gspLocationInfo` capacity sum** for the single-GSP
   case. For a single region these should be the same number; not independently verified
   against production.
3. The `mwpercent` prop on `ForecastHeaderGSP` was unused in the render before this change (I
   checked — grep found no JSX reference) and still is. Computed for both dialects for
   parity, but nothing renders it.

## Wanted in files I don't own

Nothing new. Track B's two items in `phase4-track-b-notes.md` (`types.d.ts`'s enums,
`pages/index.tsx`'s orphaned v0 fetches) still stand and now also apply here: this chart is
double-fetching (v0 `useGetGspData` fully idle when `isSingleGsp`, but `pages/index.tsx`'s six
national v0 fetches are unrelated dead weight already flagged by Track B).
