# Phase 4, Track B — the national chart on the v1 data layer

Working notes for the step that moved `pv-remix-chart.tsx` off `CombinedData` and onto
`hooks/data/`, and turned its six copy-pasted forecast fetches into a per-country config list.

Companions: `phase4-contract.md` (the interface), `phase4-progress.md` (in-flight state).

---

## What landed

### 1. The chart fetches for itself

`pv-remix-chart.tsx` no longer reads `combinedData` or `combinedErrors`. It calls, per contract
rule 3, the hooks it needs where it needs them:

- `useNationalForecast(scope, { model })` — once per configured series.
- `useNationalGeneration(scope, { observer })` — once per observer the country has.
- `useNationalForecast(scope, { horizonMinutes })` — the N-hour line, only while
  `showNHourView` is on.
- `useGenerationSources(scope)` — a slice of the hourly `/countries` manifest, so no request.
- `useLoadingState({ scope, model, observers, nHourHorizonMinutes })` — the staleness indicator.

The `combinedData` / `combinedErrors` props stay in the component signature (now optional) and
are simply not read, per the instruction not to touch `pages/index.tsx`. `index.tsx` still runs
its own six v0 national fetches: **they are now dead weight for this view** and should be
deleted when index.tsx is decomposed. Nothing else in the tree reads
`nationalIntradayECMWFOnlyData`, `nationalMetOfficeOnly`, `nationalSatOnly`,
`nationalPvnetDayAhead` or `nationalPvnetIntraday` any more — I checked. `nationalForecastData`,
`pvRealDayInData`, `pvRealDayAfterData` and `nationalNHourData` are still read by
`delta-view/` and the map, so those four have to survive until those steps land.

### 2. Series are a curated per-country list

`CountryConfig` gains `nationalChartSeries: ForecastSeriesConfig[]`:

```ts
{ key: string;             // the ChartData key / <Line> dataKey / legend dataKey
  model: string | null;    // v1 model name; null = send no `model` param at all
  label: string;
  legend?: { iconClasses: string; tooltipInputs: ForecastInput[] } }
```

The first entry is the **primary** series by convention (asserted in the config test): it writes
`FORECAST`/`PAST_FORECAST`, supplies the p-levels, feeds the header numbers, and is the model
`useLoadingState` reports on. Everything after it is a comparison model.

GB keeps its six; NL has one. `MAX_FORECAST_SERIES = 8` in `pv-remix-chart.tsx` caps it, because
the hook calls are unrolled to a fixed length — see "Rules of hooks" below.

### 3. Model names — the `_adjust` situation

| v0 (`+ trend_adjuster_on=true`) | v1 (now) |
| --- | --- |
| `blend` | `blend` |
| `pvnet_intraday_ecmwf_only` | `pvnet_ecmwf` |
| `pvnet_day_ahead` | `pvnet_day_ahead` |
| `pvnet_intraday` | `pvnet_intraday` |
| `pvnet_intraday_met_office_only` | `pvnet_ukv` ← **unconfirmed inference** |
| `pvnet_intraday_sat_only` | `pvnet_sat` |

v1 has no `trend_adjuster_on`. It currently exposes the adjusted variants as separate models
(`blend_adjust`, `pvnet_ukv_adjust`, …). The API is about to change again — an `adjust` boolean
like v0's, plus simplified model names — so the instruction is to run non-adjusted now and amend
when it settles.

**The swap is one line:** `NATIONAL_FORECAST_MODEL_SUFFIX` in `config/countries.ts`, currently
`""`. Set it to `"_adjust"` and every series moves. It is applied by `forecastSeriesModel()`,
which is the only thing that turns a config entry into a query parameter, and the config test
asserts no series name already carries the suffix so it cannot double up. When the `adjust`
boolean lands, delete the constant and add the flag to the forecast window instead.

**Consequence, expected and agreed, not a regression to chase: the national chart's values will
not match production.** Prod is trend-adjusted; these are not. Every line will sit slightly off
the production one. `pvnet_ukv` is additionally an inference — the manifest labels it "PVNet
Intraday (Met Office)" and UKV is the Met Office's model, but nobody has confirmed it is the
same series v0's `met_office_only` served. Worth eyeballing against prod.

### 4. Observers are per country, and there may be exactly one

Generation series are built from `useGenerationSources(scope)`, mapped **positionally** onto
`GENERATION_CHART_KEYS = ["GENERATION", "GENERATION_UPDATED"]` (exported from
`pv-remix-chart.tsx`). GB's `pvlive_in_day`/`pvlive_day_after` land on the two keys `remix-line`
already draws; NL's single `ned_nl` lands on `GENERATION` alone and nothing looks for a second.

The two generation hooks are both called unconditionally with a `null` scope when the observer
does not exist — a disabled query, `isLoading: false`, no request.

The **guard** in `use-format-chart-data` changed accordingly. It was "forecast AND both pvlive
regimes"; it is now "the primary forecast AND every generation series this country has". A
single-observer country renders on one series instead of waiting forever for a second.

### 5. `useLoadingState` adopted

The chart passes it the *same* scope, model, observers and N-hour horizon it uses itself, which
is the one thing the contract says a caller must get right. A test asserts the consequence
directly: adopting the indicator adds **zero** requests (6 forecasts + 2 generations + manifest,
nothing more). If the keys ever diverge, that count doubles and the test fails.

The global `loadingState` state is no longer read by this chart; `index.tsx` still writes it for
the other views.

### 6. Legend driven by the same two lists

`ChartLegend.tsx` renders its comparison-model entries from `nationalChartSeries.slice(1)`
filtered to those with a `legend` block, and its generation entries from
`useGenerationSources`. GB gets the same three model entries as before (ECMWF / Met Office /
Satellite); the two PVNet series remain fetched-and-charted but unlabelled, exactly as they
were. NL gets none, and one generation entry.

**Copy change to confirm:** the generation legend labels now come from the manifest, so GB reads
"PV Live Estimated" / "PV Live Updated" where it previously read "PV live initial" / "PV live
updated". This is deliberate — hardcoding "PV live initial" would render NL's `ned_nl` under a
GB-specific name — but it is user-visible copy, so flag it if product cares.

---

## Design decisions worth knowing

### The v0 props were kept, not deleted

`use-format-chart-data.tsx` and `forecast-header/` are consumed by
`gsp-pv-remix-chart/index.tsx` and `delta-view/delta-view-chart.tsx` — **both on the do-not-edit
list**. So both now accept *two dialects*: the canonical `TimeSeries` inputs the national chart
passes, and the v0 arrays the other two still pass. Every v0 prop is marked `@deprecated` with
the canonical prop that supersedes it.

This is why the 53 existing characterisation tests, including the strengthened B9 guard, all
still pass untouched: the v0 path is adapted rather than replaced. When the GSP and delta steps
land, deleting the deprecated half is mechanical.

Internally both dialects collapse into one `SeriesPoint[]` (`{ timeUtc, powerMw, plevels }`),
which is what the merge, the past/future split and the seasonal loop now operate on.

### `remix-line.tsx` untouched, as agreed

D4's eight copy-pasted `<Line>` blocks are still there. The brief's "absorb D4" and the settled
fact "do not attempt config-driven series inside remix-line" pull opposite ways; I followed the
settled fact, since `remix-line.tsx` is also on the do-not-edit list. What the config list does
give is the precondition: the keys, labels and colours a config-driven `<Line>` set would need
are now all in one place, so absorbing D4 is a later mechanical change rather than a redesign.

Because the `<Line>` set is fixed, a country whose config named a key `remix-line` does not draw
would fetch and merge the data and draw nothing. GB's `PVNET_DAY_AHEAD` and `PVNET_INTRADAY`
are already in exactly that state, and were before this change.

### Rules of hooks: unrolled slots

`useNationalForecast` is called eight times explicitly rather than mapped over the series list.
The list length is a country fact that changes when the user switches country, and the rules of
hooks need a constant call count. Unused slots get a `null` scope. It reads as copy-paste and it
is, but the alternative (a loop) trips `react-hooks/rules-of-hooks` and is genuinely unsafe on a
country switch.

### `null` readings

The canonical path **drops** points with `powerMw: null` rather than plotting them as 0, so the
line breaks where there is no reading. The v0 path still does `null / 1000 === 0` because the
characterisation tests pin it for the GSP and delta views. Both behaviours are tested.

### ForecastHeader's "latest actual"

v0's pvlive payload was newest-first, so the header took `[0]`. The canonical `TimeSeries` is
ascending and its trailing slots can be `null`, so the canonical path scans backwards for the
last point carrying a number. `at(-1)` would have shown 0.0 GW for the first few minutes of
every half hour.

---

## Tests added

| File | What it covers |
| --- | --- |
| `config/countries.test.ts` (+7) | series list well-formedness, the v0→v1 model mapping pinned, NL's single entry, which series carry legends, `forecastSeriesModel` and the suffix |
| `components/charts/pv-remix-chart.test.tsx` (new, 10) | MSW end-to-end: GB asks for exactly its six configured models by v1 name; it does *not* fan out over the manifest's twelve; no `_adjust` request goes out; N-hour only when enabled; GB fetches two observers, **NL exactly one**; the legend follows both lists; `useLoadingState` adds no requests |
| `components/charts/national-loading-state.test.tsx` (new, 10) | `useLoadingState`'s assembly — which rows exist per country, single-observer row dropped, period rows only with a `regionScope`, N-hour never gating initial load, error precedence, disabled scope |
| `components/charts/use-format-chart-data.test.tsx` (+10) | the canonical dialect: config-named keys, MW not double-converted, the generalised guard, `null` dropped, canonical p-level key shape |

Suite: **28 suites / 933 tests, all passing.** `npx tsc --noEmit` exits 0. Prettier clean.
(Baseline at the start of this session was 25/859; the map track added suites concurrently.)

### Harness gotchas hit, for the next view migration

- **`ResizeObserver` is not defined in jsdom.** recharts' `ResponsiveContainer` observes its box
  on mount and throws. Stubbed at the top of the chart test. Any test that renders a recharts
  chart will hit this.
- **`NationalEndpointLabel` is an `export enum` in `components/types.d.ts`.** Next's compiler
  emits an object for it; ts-jest treats a `.d.ts` as ambient, so at test runtime it is
  `undefined` and `DataLoadingChartStatus` dies on `key in undefined`. The chart test
  `jest.mock`s `../types.d` with the enum's values so the *real* status component stays under
  test. See "wanted in files I don't own" below.
- The `rerender()`-inside-`waitFor` rule from `bothSettled` is real and the chart hits it every
  time — twelve hooks on distinct SWR keys.

---

## Wanted in files I don't own

1. **`components/types.d.ts` — move the two `export enum`s out of the `.d.ts`.** They are values,
   not types, and living in a declaration file makes them unreadable under ts-jest. Every future
   test that renders `DataLoadingChartStatus` will need the same `jest.mock` workaround until
   this moves to a real `.ts`. `hooks/data/use-loading-state.ts` already carries a duplicated
   `ENDPOINT_LABEL` map for the same reason — two copies of the same list now.
2. **`pages/index.tsx` — the six national forecast fetches and the two pvlive fetches are now
   unused by this chart.** Five of the six (`nationalIntradayECMWFOnlyData`,
   `nationalMetOfficeOnly`, `nationalSatOnly`, `nationalPvnetDayAhead`, `nationalPvnetIntraday`)
   have no remaining consumer anywhere and can be deleted outright. The chart is currently
   double-fetching the national forecast (v0 in index.tsx, v1 here) until that happens.
3. **`components/charts/delta-view/delta-view-chart.tsx` and `gsp-pv-remix-chart/index.tsx`** are
   the last callers of the v0 half of `useFormatChartData` and `ForecastHeader`. When they
   migrate, delete every `@deprecated` prop and the two `fromV0*` adapters.

## Open questions

- `pvnet_ukv` as the replacement for `pvnet_intraday_met_office_only` is unconfirmed.
- The generation legend copy change (see §6) is user-visible.
- NL charts only `blend`. Its other national model, `ecmwf_mo_sat_uncurtailed`, is the blend's
  single input, so charting both would compare a series against itself. Add it to
  `nationalChartSeries` if someone wants it.
