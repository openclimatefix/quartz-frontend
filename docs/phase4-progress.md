# Phase 4 — in-progress notes

Resume note, written mid-phase when the data-layer agent was killed by a spend limit.
Companion to `adaptive-eu-ui.md`; delete once Phase 4 closes and its Status section is written.

## State of the tree

Working tree is **typecheck-clean** (`npx tsc --noEmit` exit 0). Nothing committed.

### Landed and verified — cleanup step (complete)

- `isProduction` deleted: the export in `components/helpers/utils.ts`, the dead import in
  `profile-dropdown.tsx`, `disabled={isProduction}` on the Solar Sites nav link, and the two
  `{!isProduction && …}` wrappers in `pages/index.tsx`. Behaviour identical — the flag was
  permanently `false`, so the subtrees rendered anyway. `HeaderLink`'s `disabled` prop was kept:
  it is a legitimate component API with a `false` default, just no current caller.
- The three legacy `*London*` aliases deleted from `utils.ts`, with their alias test. Zero
  consumers confirmed by grep. Test count 835 → 834, that block being the only loss.
- `SETTLEMENT_PERIOD` removed: the write in `use-format-chart-data.tsx` and the now-orphaned
  `SETTLEMENT_PERIOD?: number` field on `ChartDataBase` in `remix-line.tsx`.

**The B9 guard was strengthened, not dropped.** The plan doc called this key "written and never
read", which was true of app code but not of the tests — `use-format-chart-data.test.tsx` used it
as the B9 regression guard. It now calls `getSettlementPeriodForDate` and `getUtcHalfHourIndex` on
the same instant and asserts the gap is exactly 2 in BST and 0 in GMT, then separately asserts
`SEASONAL_MEAN` matches the UTC slot and *not* `settlementPeriod - 1`. Reconflating in either
direction now fails it; the old form could only catch one direction.

**Consequence worth knowing:** `use-format-chart-data.tsx` no longer consumes the country timezone
at all. This was checked and is correct, not a regression — the hook's only remaining date handling
is `formatISODateString` for chart keys and an explicit `DateTime.fromISO(key).toUTC()` for the
seasonal-norm lookup, both of which are UTC *by design* under the Phase 3 decision that
`national_metrics.json` stays UTC-indexed. Phase 3's registry wiring concerns *display* formatting
(tick formatters, `csvDownload`), which is untouched.

### Landed and verified — data layer (complete)

Under `hooks/data/`: `scope.ts`, `query.ts`, `snapshot-state.ts`, `index.ts`, `use-forecast.ts`,
`use-generation.ts`, `use-regions.ts`, `use-loading-state.ts`, plus `data-hooks.test.tsx`
(24 tests, green and stable over repeated runs). The contract is `docs/phase4-contract.md`.

All six outstanding items are closed:

1. **The inherited MSW diagnosis was already applied and was not the cause.** The `/v1` prefix was
   correctly handled in the handler paths and the request recorder before this session started, and
   the four tests still failed. The real cause is a **dropped React render**: when two hooks with
   *distinct* SWR keys resolve microseconds apart, the second component update is never scheduled.
   SWR's cache does hold the second response — verified by reading the cache map directly at the
   point of timeout, where both entries had `data` — but the hook it belongs to reports
   `isLoading: true` indefinitely. The data layer was working the whole time; only the render was
   missing. Fixed by calling `rerender()` inside the `waitFor` polling callback, documented at
   `bothSettled`. Anything that widens the gap between the two resolutions — even one extra
   statement in the render callback — hides it, which is why it presented as flakiness that moved
   with unrelated edits, and why the two earlier hypotheses (jsdom `fetch`, the token cache) both
   looked plausible. **Any view test rendering a container with several hooks will hit this.**
2. `hooks/data/dbg.test.tsx` deleted.
3. Prettier clean.
4. The contract is written: `docs/phase4-contract.md`. The three in-code references point at it.
5. **`use-countries.ts` reviewed.** The −53 lines are a pure de-duplication onto `useApiQuery` +
   `manifestSwrOptions`; the descriptor and therefore the cache key are unchanged, and all four
   behaviours (entitlement intersection, the dev-mode predicate, namespaced and plain claim keys,
   an unconfigured country staying discoverable) are below the diff, untouched, with their 13 tests
   passing. The one real change is `MAX_RETRIES` 4 → 6, inherited from the shared options.
6. **Model selection is national-only** — confirmed against the code being replaced (every
   `model_name` in `pages/index.tsx` is on the national forecast endpoint; no regional view offers
   a picker) and pinned by a test. Recorded in the contract.

### Not started — the view migration

The fan-out below is untouched. This is the bulk of the phase.

## Decisions taken this session

- **Seam depth: canonical model to the formatting layer.** `use-format-chart-data.tsx` and the map's
  value path take the canonical `TimeSeries`/`RegionSeries`/`RegionSnapshot`; `remix-line.tsx` keeps
  its current row shape and `<Line>` blocks for now. Config-driven series is a follow-on *inside* the
  phase if the first views land clean — deliberately not bundled into the risky first pass.
- **`CombinedData` dissolves rather than being removed.** Each view drops its keys as it migrates, so
  the object shrinks per step and dies when the CSV step takes the last of it. `Header` never uses
  it — it is a pure pass-through to `ProfileDropDown`, which needs it only for `canDownloadCsv` and
  `downloadNationalCsv`. So the prop deletes itself at the CSV step.
- **No god-object may be reintroduced.** `useDashboardData` must not become one bundle of everything.
  Small hooks, one per query, each with explicit `Scope`, each returning SWR's own
  `{data, isLoading, isValidating, error}` rather than shredding it across parallel objects. SWR
  dedupes by key, so colocated calls are free. The one legitimate cross-cutting concern is the
  staleness indicator (`useLoadingState()`).
- **Mapbox feature-state is folded into Phase 4** (agreed, previously loose Phase 5 territory).
  Geometry loads once; values attach via `setFeatureState` on the existing `promoteId: "id"`; colour
  buckets move into `step`/`interpolate` expressions over `["feature-state", …]`. Rationale: it is
  the *value* pipeline, the same seam as the data swap, and orthogonal to Phase 5's *geometry*
  pipeline (where boundaries load from). Deferring it means tearing out `setData` from the same
  files twice.

### Why the map is slow today — measured from the code, for whoever does that step

1. `mapZoneFeatures` (`helpers/data.ts:175-187`) calls
   `gspForecastsDataByTimestamp.find(fc => … === formatISODateString(targetTime))` **inside** the
   per-GSP `forEach`, though the predicate does not depend on the GSP. Hundreds of full array scans
   and thousands of redundant date formats per render. `mapGspFeatures` has the same shape
   (349 features × ~350 systems).
2. The whole FeatureCollection is rebuilt and handed to `setData`, so Mapbox re-parses and
   re-tessellates unchanged geometry every time only the numbers moved.
3. **`useGetGspForecast(selectedTime)` refetches per scrub tick** — it sets
   `start_datetime_utc === end_datetime_utc === targetTime`. Likely the dominant felt lag. Fetching
   `period` once per window and scrubbing client-side removes it.

Note the plan's open item that DNO groupings are **not a partition** (15 GSP ids in two groupings
each, so DNO totals double-count). Phase 5 owns the fix; the map rewrite must not bury it.

## Planned fan-out for the migration step

Sequenced on file ownership, not size:

- **Map track (one agent, single ownership):** `pvLatestMap.tsx`, `deltaMap.tsx`, `map.tsx`,
  `helpers/data.ts`. Forecast and delta maps **cannot** be split — they share
  `generateGeoJsonForecastData` and the source/layer setup.
- **Chart track (parallel):** `pv-remix-chart.tsx`, `use-format-chart-data.tsx`,
  `forecast-header/*`.
- **Then sequential:** regional drill-down (`gsp-pv-remix-chart/*`), then CSV
  (`csvDownloadModal.tsx`, `helpers/csvDownload.ts`, and the `combinedData` prop removal).
- **Then, by hand:** `pages/index.tsx` decomposition into per-view containers, and retiring
  `types/quartz-api.d.ts` once its last consumer is gone.

Country toggle placement is settled — it is already where it should be
(`components/layout/header/index.tsx:155`), contrary to the plan's "in the menu" wording. It takes
no props, so it is free to move at any time with no wiring impact.
