# Phase 4, Track F — the delta chart's top RemixLine, and the CSV export

Working notes for the last two v0 consumers: `DeltaChart`'s national forecast-vs-actual
overlay, and `csvDownload.ts`/`csvDownloadModal.tsx`. Companion to `phase4-contract.md` and
`phase4-track-b-notes.md` (the pattern this step follows twice).

State: `npx tsc --noEmit` exit 0, `npx jest` **31 suites / 943 tests**, all green (baseline
30/941). Prettier clean. Nothing committed.

---

## What landed

### 1. `DeltaChart`'s top chart, moved onto the v1 dialect

`components/charts/delta-view/delta-view-chart.tsx` no longer reads `nationalForecastData`,
`pvRealDayInData`, `pvRealDayAfterData` or `nationalNHourData` off `combinedData`. It fetches
for itself, following Track B's pattern exactly: `useNationalForecast(scope, { model })` for
the primary series (country's `nationalChartSeries[0]`, via `forecastSeriesModel`),
`useNationalGeneration` once per observer from `useGenerationSources(scope)`, and
`useNationalForecast(scope, { horizonMinutes })` for the N-hour line, gated on
`showNHourView` exactly as `pages/index.tsx`'s v0 fetch was. `GENERATION_CHART_KEYS` is
imported from `pv-remix-chart.tsx` rather than re-declared, so the two charts can never drift
on which observer lands on which `<Line>` key.

`combinedData`/`combinedErrors` stay in `DeltaChartProps`, now optional and unread — Track B's
precedent — because `pages/index.tsx` still passes them and is out of this step's ownership.

The single-observer generalisation from Track B applies here too: `waitingForData` replaces
the old `!nationalForecastData || !pvRealDayInData || !pvRealDayAfterData` guard with `!forecast.data
|| generationSeries.some(series => series.series === undefined)`, so a one-observer country
doesn't spin forever. `hasGspPvInitialForSelectedTime` (gates the "delta values not available
yet" message) now reads off `generation0.data` (the day-in observer) instead of `pvRealDayInData`.

**`useGspDeltas` extended, not reimplemented.** It already computed the GSP-scope window this
component's top chart needs to match for `useLoadingState`'s "same scope, window, model,
observers" rule — I added `scope` and `window` to its return (owned file, `delta-view/**`)
rather than recomputing `getEarliestForecastTimestamp()`/`getFurthestForecastTimestamp()` a
second time. `DeltaChart`'s `useLoadingState` call passes `regionScope`/`periodWindow` from
that, so the staleness indicator still reports on the GSP list beneath it, which the old global
`loadingState` (computed once in `pages/index.tsx` from every fetch at once) did implicitly.
That global is no longer read here — Track B's chart already dropped it, so this component was
its last consumer; `pages/index.tsx` still writes it, now to nobody.

No test file added for `delta-view-chart.tsx` itself — none existed before this step, and the
hook-composition pattern it now runs is the one `pv-remix-chart.test.tsx` already covers
end-to-end.

### 2. The CSV, onto `TimeSeries`

`components/helpers/csvDownload.ts`: `buildCsvRows` and `downloadNationalCsv` take a new
`NationalCsvSeries = { forecast?, generationInitial?, generationUpdated?, nHour?: TimeSeries }`
instead of `CombinedData`. The kW→MW division is gone — v1's `TimeSeriesPoint.powerMw` is
already MW off the normalise boundary, so a leftover `/ 1000` would have silently halved every
reading by 1000. p-levels read `plevelsMw` keyed by the raw level (`"10"`, `"90"`) instead of
v0's `plevel_10` string-prefixed keys. `generateCsv` and `escapeCsvCell`/`joinCsvRow` — the
RFC 4180 escaping — are untouched: they operate on `CSVRow`, never on the input dialect.

`components/helpers/csvDownload.test.ts` rewritten fixture-for-fixture onto `TimeSeries`
(`series(values)` helper building `{ regionName, capacityMw: null, values }`), same test
descriptions and assertions. New: a dedicated "generation values are MW, not re-converted"
block (was "kW to MW conversion") that pins a value passing straight through unchanged — the
unit-bug assertion the brief called for. Instants moved to the `Z` suffix in the new fixtures
(v1's actual wire shape) rather than v0's `+00:00`; the escaping and timezone-parameterisation
tests, which don't depend on the input dialect, are byte-identical to before.

`components/layout/header/csvDownloadModal.tsx` needed **no change** — it never touched
`combinedData` or `CSVRow`, only `CSVColumn` and `getNHourForecastLabel`, both unchanged.

### 3. `CombinedData` deletes itself out of the header chain

`ProfileDropDown` (`components/layout/header/profile-dropdown.tsx`) no longer takes
`combinedData` as a prop. It fetches its own national scope, primary-series model, observers
and (gated on `showNHourView`) N-hour series — same hooks, same pattern as the chart. `Header`
(`components/layout/header/index.tsx`) stops forwarding `combinedData` to `ProfileDropDown`,
per the plan doc's "`Header` never uses it — it is a pure pass-through" — but keeps the prop
in `HeaderProps`, unread, because `pages/index.tsx` still passes it and is on the do-not-edit
list.

`canDownloadCsv` changed from `Boolean(combinedData && view !== VIEWS.SOLAR_SITES)` to
`view !== VIEWS.SOLAR_SITES`. `combinedData` was always a non-null object at the one real call
site — the `Boolean(combinedData && …)` half only mattered for a caller that omitted the prop,
which doesn't happen in the app. Flagging in case product wants the CSV entry hidden while the
national forecast/generation hooks are still loading; today it's visible immediately and the
download itself queries live data at click time.

---

## Assumptions

- **The primary national series (`nationalChartSeries[0]`) is what both the delta top chart
  and the CSV's "Current Forecast" column reflect**, matching what `pv-remix-chart.tsx` treats
  as primary. Not the trend-adjusted v0 model — same "values won't match production, agreed"
  caveat from Track B's notes applies to the CSV export too now.
- **The CSV's `generationInitial`/`generationUpdated` map onto the country's first and second
  observer, positionally**, exactly like `GENERATION_CHART_KEYS`. A country with one observer
  (NL) leaves the "Updated" column empty rather than blocked.
- **No new test for `Header`/`ProfileDropDown`'s hook wiring.** Neither had a test before this
  step; the hook-composition itself is the same shape `pv-remix-chart.test.tsx` and
  `national-loading-state.test.tsx` already exercise. Flagging rather than deciding — if this
  should have MSW coverage of its own, that's a place to add it.

## Nothing contradicts the docs

Read `phase4-contract.md`, `phase4-track-b-notes.md`, `phase4-track-c-notes.md` and
`phase4-progress.md` before starting. No gap found in the v1 dialect (`use-format-chart-data.tsx`
needed no changes, as Track D's precedent predicted) and no gap found in the data layer.

## No change needed in a file I don't own

None found, beyond the two already-flagged, already-agreed items from `phase4-progress.md`
(`pages/index.tsx`'s now-fully-orphaned v0 national/pvlive fetches, and `types.d.ts`'s enums) —
both wave-4 territory, not new findings from this step.

## Hit mid-session, not caused by this step

Partway through, `npx tsc --noEmit` briefly failed on `components/helpers/data.ts:990` (a type
error unrelated to anything in this step's ownership) and `data.reconciliation.test.ts` — a
concurrent track mid-edit in a file on the do-not-edit list. It self-resolved within the
minute; recorded here in case it's seen again and looks like something this step broke.
