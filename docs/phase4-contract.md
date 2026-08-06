# Phase 4 data-layer contract

The interface the view-migration steps code against. Everything in `hooks/data/`, re-exported
from `hooks/data/index.ts` — **import from `hooks/data`, never from the individual files.**

Companion to `adaptive-eu-ui.md` (the plan) and `phase4-progress.md` (in-flight state). This
file is the stable part: if a view needs something not described here, that is a gap to fill in
the data layer, not a reason to fetch in a component.

---

## The three rules

1. **Every hook takes an explicit `Scope`.** There is no ambient country inside this layer.
   `useCurrentCountry()` supplies the default scope in the UI and nowhere else. This is what
   makes the map's N-country fanout one extra argument rather than a second refactor.
2. **Every hook returns one SWR record**, `DataResult<T>` = `{ data, error, isLoading,
   isValidating }`. Never split it into parallel objects — that is exactly the
   `CombinedData`/`CombinedLoading`/`CombinedValidating`/`CombinedErrors` shape this layer
   exists to delete.
3. **Call the hooks you need where you need them.** SWR dedupes on the cache key, so two
   components asking for the same thing is one request. Nothing is assembled into a bundle and
   drilled down. No composing "give me everything" hook may be reintroduced.

`DataResult` deliberately has no `mutate`: the manifest-derived hooks could not carry a
correctly typed one, and a caller that must force a refresh uses SWR's global `mutate` with the
key.

---

## Scope

```ts
type Scope = {
  country: string;     // as the API spells it: "GB", "NL"
  source: string;      // "solar"
  regionType: string;  // "national" | "gsp" | "province" | …, from the manifest
  region?: string;     // a single region name within regionType
};
```

`regionType` and `region` are different things and mixing them is the mistake this type exists
to prevent: `"gsp"` is a region *type*, never a region. A region-scoped hook given no region
does not fetch at all (see *Disabled queries*).

National is the exception: its region type doubles as its path alias, so
`{ country, source, regionType: "national" }` needs no `region`. GB's national region is
*named* "Great Britain" and aliased `national` — key on the alias, display the name.

Helpers: `resolveRegionName(scope)`, `toRegionScope(scope)`, `isFetchableScope(scope)`,
`NATIONAL_REGION_TYPE`.

### Disabled queries

Passing `null`/`undefined` for a scope, or a region-typed scope with no region, gives SWR a
`null` key: no request, `data: undefined`, `error: undefined`, `isLoading: false`. That is how
a hook whose scope is not ready stays an unconditional hook call — the rules of hooks require a
constant call count, and country-varying row counts (NL's absent second observer) depend on it.

---

## Hooks

### Countries and capabilities

| Hook | Returns | Endpoint |
| --- | --- | --- |
| `useCountries()` | `{ countries: CountryListing[], isLoading, error }` | `GET /countries` |
| `useEntitledCountries()` | same, filtered to `entitled && configured` | *(same request)* |
| `useCurrentCountry()` | `string` — the selected country code | *(global state)* |
| `useCountryFormatting()` | `{ timezone, locale }` for the current country | *(registry)* |
| `useRegions(scope, filter?)` | `DataResult<Region[]>` | `GET /{country}/{source}/regions` |
| `useRegionTypes(scope)` | `DataResult<RegionTypeCapability[]>` | *(manifest slice)* |
| `useRegionTypeCapability(scope)` | `DataResult<RegionTypeCapability \| undefined>` | *(manifest slice)* |
| `useGenerationSources(scope)` | `DataResult<GenerationSourceCapability[]>` | *(manifest slice)* |

`useRegionTypes`, `useRegionTypeCapability` and `useGenerationSources` are slices of the hourly
`/countries` manifest, not calls to `/region-types` and `/generation-sources`. They share
`useCountries`' descriptor, so they share its cache entry: asking for region types costs no
request.

`useRegions` takes `Omit<RegionsFilter, "regionType">` — `{ parent?, name? }`. `region_type`
always comes from the scope. `Region.label` is `metadata.full_name` ("City Road") falling back
to the raw `name` (`citr_1`); **display the label, key on the name.** The name is what every
other response, every path segment and the GeoJSON join (after the registry's `joinTransform`)
uses. Raw codes must never reach users.

### Forecast

| Hook | Returns | Endpoint |
| --- | --- | --- |
| `useRegionForecast(scope, window?)` | `DataResult<TimeSeries>` | `GET /{country}/{source}/regions/{region}/forecast` |
| `useNationalForecast(scope, window?)` | `DataResult<TimeSeries>` | *(the same, named for its caller)* |
| `useForecastPeriod(scope, window?)` | `DataResult<RegionSeries>` | `GET /{country}/{source}/forecasts/period` |
| `useForecastSnapshot(scope, options?)` | `DataResult<RegionSnapshot>` | `GET /{country}/{source}/forecasts/snapshot` |
| `useForecastLastUpdated(scope, model?)` | `DataResult<UtcInstant>` | `GET …/regions/{region}/forecast/last-updated` |

```ts
ForecastWindow          = { start?, end?, creationLimit?, horizonMinutes?, model? }
PeriodWindow            = { start?, end?, regionNames? }
ForecastSnapshotOptions = { modelName?, modelVersion?, time? }
```
(`start`/`end`/`creationLimit`/`time` take a `Date` or an ISO string.)

### Generation

| Hook | Returns | Endpoint |
| --- | --- | --- |
| `useRegionGeneration(scope, window?)` | `DataResult<TimeSeries>` | `GET /{country}/{source}/regions/{region}/generation` |
| `useNationalGeneration(scope, window?)` | `DataResult<TimeSeries>` | *(the same, named for its caller)* |
| `useGenerationPeriod(scope, window?)` | `DataResult<RegionSeries>` | `GET /{country}/{source}/generation/period` |
| `useGenerationSnapshot(scope, options?)` | `DataResult<RegionSnapshot>` | `GET /{country}/{source}/generation/snapshot` |

```ts
GenerationWindow          = { observer?, start?, end? }
GenerationPeriodWindow    = PeriodWindow & { observer? }
GenerationSnapshotOptions = { observer?, time? }
```

### The staleness indicator

`useLoadingState(options: NationalLoadingQueries)` → the exact `LoadingState<NationalEndpointStates>`
shape `computeLoadingState` produced, so `DataLoadingChartStatus` renders unchanged.

This is the **one** legitimately cross-cutting concern, and it is cross-cutting precisely
because it reports on every request at once. It calls the same small hooks the views call
rather than taking drilled props. SWR makes that free — *provided the arguments produce the
same key*. That is the one thing a caller must get right: **pass it the same scope, window,
model and observers the views are using.** A row whose input is omitted (`regionScope: null`,
no `observers[1]`, no `nHourHorizonMinutes`) disappears from the indicator rather than showing
as permanently failing.

---

## Canonical types

`TimeSeries` (one region over time), `RegionSeries` (many regions on one shared time axis, keyed
by region name), `RegionSnapshot` (every region at one instant). Full definitions in
`lib/domain/types.ts`.

Three invariants that the view code has to respect:

- **Everything is MW.** The wire is kW; `normalise.ts` converts once at the boundary. Every
  chart, the CSV and `Y_MAX_TICKS` assume MW.
- **Every instant is `YYYY-MM-DDTHH:mm:ssZ`.** Canonicalised at the boundary by
  `lib/domain/time.ts`, because v1 emits `Z` where v0 emitted `+00:00` and the chart merge key
  is a raw string. Sub-second precision is truncated (visible only on `cache_updated_utc`).
- **`RegionSeries.regions` is keyed by region name**, so a lookup is O(1). The map's join is a
  key lookup, not a scan — this is what removes `mapZoneFeatures`' per-GSP full-array `find`.

### absent ≠ null ≠ zero

Not a theoretical distinction. `/generation/snapshot`'s newest slot publishes region by region
and can be read mid-fill — a recorded fixture caught 15:00 with 127 of 336 regions, complete 11
minutes later. Regions still to publish are **absent from the payload**, not present with
`null`. The cache never blanks or zero-fills.

Use `regionSnapshotState(snapshot, regionName)`:

- `"unpublished"` — not in the payload. Ask again shortly. Not an error, not a coverage gap.
- `"no-data"` — present with `powerMw: null`. Reported nothing.
- `"value"` — present with a number, **including 0**. Overnight solar is a genuine zero and
  must not render as missing (audit B8's bug class).

The map must render `unpublished` differently from `no-data`, and neither as a zero.
`regionSnapshotPowerMw` flattens the first two to `null` for callers that genuinely do not
care — it never swallows a real `0`. `snapshotCoverage(snapshot, expectedNames)` gives
`{ published, expected, isPartial }` so a view can say "127 of 336 published" rather than
silently drawing 209 holes. A partial newest slot is a permanent characteristic to render, not
a fault to report.

---

## Errors and retries

`error` is typed `unknown` — SWR's error channel carries anything thrown, including a normaliser
bug. **`describeApiError(error)` is the only sanctioned way to read it.** It returns `null` for
anything that is not an `ApiV1Error`; a thrown normaliser bug is not an API error and must not
be reported as one.

```ts
ApiErrorInfo = { status, message, validationErrors, isColdCache, isFatal }
```

There are two error bodies, not one — 400s carry `{"detail": string}`, 422s carry
`HTTPValidationError`'s `{"detail": ValidationError[]}`. Code that assumes one shape crashes on
the other; `describeApiError` flattens both and always populates `message`.

Retry policy, already applied by the hooks — a view does not implement any of it:

- **503 (cold cache)** — `period` and `snapshot` are cache-backed and answer
  "cache is being populated, please retry in 60 seconds" while cold. Confirmed with the API
  owner as a brief post-deploy state, so it is retried silently with backoff and gets **no
  "warming" UI state**: to the user it is indistinguishable from a slow request. Forecast and
  generation caches warm independently, so one can be cold while the other is not.
- **403** — `isFatal`. The token that produced it will not become authorised; retrying only
  loops against an endpoint that will keep refusing.
- Everything else (network blips, 429, other 5xx, a 422 from a since-fixed caller bug) retries:
  6 attempts, backoff doubling from 1s, capped at 30s.

Refresh cadence matches the v0 `useLoadDataFromApi` it replaces — 5 minutes, 2-minute dedupe —
so the migration is not also a polling change. The manifest is hourly.

---

## Facts that constrain the views

These are the ones a view will get wrong if it assumes GB's shape is universal.

- **`period` rejects `region_type=national` with a 400** ("only sub-national region types are
  pre-warmed"). The national chart must use `useNationalForecast`. That is not a workaround:
  `period` has no `model` parameter, national is exactly where model comparison lives, and one
  region is no request storm to collapse.
- **Model selection is national-only.** Confirmed against the code being replaced — every
  `model_name` in `pages/index.tsx` is on the national forecast endpoint and no regional view
  offers a picker. `period` takes no `model`, so a regional *time series* is pinned to the
  region type's default; only `snapshot` can vary it. A `model` param on `period` is wanted
  eventually but is deferred by agreement with the API owner (pre-warming per model multiplies
  cache size).
- **Models are per region type, not per country.** GB `national` offers 12 defaulting to
  `blend_adjust`; GB `gsp` offers 3 defaulting to `blend`. A picker reading the *country's*
  models will offer models the endpoint rejects. Bind to `useRegionTypeCapability(scope)`.
- **No hook defaults `model` from the manifest.** Omitting it makes the API apply the region
  type's default server-side — the same answer, without a manifest round trip in the critical
  path and without the cache key changing from "no model" to "blend_adjust" mid-flight and
  fetching twice.
- **Observers are per country, and there may be exactly one.** GB has two (`pvlive_in_day`,
  `pvlive_day_after`), which is where the two-line GENERATION vs GENERATION_UPDATED chart comes
  from; NL has one (`ned_nl`). **That chart is a GB fact.** Build series from
  `useGenerationSources(scope)` — never from a hardcoded pair, never assuming index 1 exists.
- **`RegionTypeCapability.level` is sparse** (0 national, 10 gsp/province) by design, leaving
  room for GB's client-side DNO and NG-zone levels from the registry.
- **DNO groupings are not a partition** — 15 GSP ids appear in two groupings each, so DNO
  totals double-count. Phase 5 owns the fix; the map rewrite must not bury it.

---

## Testing views against this layer

`hooks/data/data-hooks.test.tsx` is the worked example: MSW over the real
`queries → client → normalise` machinery against recorded production fixtures. Two harness
facts will otherwise cost an afternoon each, both documented at `bothSettled` in that file:

1. **One `waitFor`, not two sequential ones.** The first one's `act()` scope closes before the
   other requests resolve; their updates then land outside any act scope where a second
   `waitFor` never sees them.
2. **Call `rerender()` inside the polling callback.** When two hooks with *distinct* keys
   resolve microseconds apart, the second component update is dropped — SWR's cache holds the
   response (verified by reading the cache map at the point of timeout: both entries had
   `data`) but the hook reports `isLoading: true` indefinitely, because no render was ever
   scheduled for it. Forcing a render re-reads the already-correct snapshot. Anything widening
   the gap between the two resolutions hides it, so it presents as flakiness that moves with
   unrelated edits. Hooks sharing one key are unaffected.

Also: MSW handler paths carry the `/v1` prefix, because `API_V1_PREFIX` ends in `/v1` and that
is what the client issues.

---

## Known gaps

- **`useLoadingState` has no test of its own.** Its inputs are covered, its assembly is not.
  The view that adopts it should bring one.
- **`/region-types` and `/generation-sources` are not called.** The manifest carries the same
  data and `normalise.ts` exports a normaliser for it; the standalone endpoints have none.
  Adding one belongs in `lib/domain`, not in the hooks.
- **`sources()` and `region()` descriptors exist in `queries.ts` with no hook.** Add one when a
  view needs it.
