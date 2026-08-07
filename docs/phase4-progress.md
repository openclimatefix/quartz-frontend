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

### In flight — the view migration

Baseline before any of it: `npx tsc --noEmit` exit 0, `npx jest` 24 suites / 858 tests green.

Running as four waves, sequenced on file ownership and data dependencies:

- **Wave 1 (parallel).** Track A = the map value pipeline (`components/map/*`,
  `helpers/data.ts`). Track B = the national chart (`pv-remix-chart.tsx`,
  `use-format-chart-data.tsx`, `forecast-header/*`, `config/countries.ts`).
- **Wave 2 (parallel, after wave 1).** Track C = delta (`delta-view/*` and the delta computation
  leaving `pages/index.tsx`) — depends on A's snapshot join. Track D = the regional drill-down
  (`gsp-pv-remix-chart/*`) — depends on B's formatting seam.
- **Wave 3.** Track E = CSV (`csvDownloadModal.tsx`, `helpers/csvDownload.ts`) and the
  `combinedData` prop removal, which takes the last of the object with it.
- **Wave 4, by hand.** `pages/index.tsx` decomposition into per-view containers, deleting the v0
  fetches each track orphaned, and retiring `types/quartz-api.d.ts` once its last consumer is gone.

### Wave 4 — done

Waves 1–3 were done and verified at 31 suites / 943 tests. **Wave 4 is now done too:**
`npx tsc --noEmit` exit 0, `npx jest` **30 suites / 879 tests** green. Detail in
`phase4-track-g-notes.md`.

The test count falls because three characterisation suites went with the code they characterised
— `data.geo.test.ts` (43 cases on `generateGeoJsonForecastData`) deleted whole, `data.test.ts`
reduced from 23 cases to its 7 B2 window-helper cases, and `use-format-chart-data.test.tsx`'s
four kW→MW cases retired with the v0 adapter that did the dividing. No behaviour lost coverage:
everything else in that last suite was ported onto the canonical dialect test for test.

All six planned items landed:

1. **Orphaned v0 fetches deleted from `pages/index.tsx`** — 818 → 169 lines. The national
   forecast is no longer double-fetched, and the per-scrub-tick `useGetGspForecast` is gone.
2. **The v0 dialect deleted from `use-format-chart-data.tsx`** — both `fromV0*` adapters and all
   ten `@deprecated` props. Track F had already moved the delta view's top chart, which was the
   prerequisite.
3. **The two `export enum`s moved** out of `components/types.d.ts` into
   `components/endpoint-labels.ts`. Both workarounds they forced — the `jest.mock("../types.d")`
   block and `use-loading-state.ts`'s duplicated label list — are deleted, which is the proof.
4. **`CombinedData`/`CombinedLoading`/`CombinedValidating`/`CombinedErrors` dissolved**, along
   with `computeLoadingState` and the `loadingState` global, which had no readers left.
5. **`types/quartz-api.d.ts` retired**, and the v0 value pipeline deleted from `helpers/data.ts`.
6. **Sites left alone**, as planned — now quarantined in `components/hooks/useSitesViewData.ts`.

**Deviation from the plan, deliberate:** "per-view containers" is not achievable as written. All
three maps stay mounted inside `#map-container` while the charts live in `SideLayout`, so a
per-view component would have to render into both halves at once. Extracted per *concern*
instead (`useSitesViewData`, `useMapChrome`, `DeprecatedDomainNotice`). **Brad wants a proper
layout/screen-real-estate rationalisation discussed at the end of this phase** — the current
arrangement is an artefact of organic feature growth and has not been rationalised in a long
time; he thinks there is an easy refactor that serves current needs much better. That
conversation is where real per-view containers belong.

## MUST REVISIT BEFORE PHASE 4 CLOSES

**The DNO double-count is now baked into a second place, deliberately.** Wave 3 builds a
time-series rollup (summing `RegionSeries` across grouping members per timestamp) so the GSP
chart's DNO/zone/multi-select paths leave v0. Brad's decision, knowingly: **it reproduces today's
double-count exactly** — 15 GSP ids appear in two DNO groupings each, so DNO totals sum above
national. Correct behaviour preserved, wrong numbers preserved with it.

**Where the discrepancy comes from — Brad's read, and it fits the measured numbers.** The excess
decomposes as 15 duplicated ids + 31 DNO-only ids − 14 ids present nationally but in no DNO
grouping. GB has had at least two GSP updates that added new GSPs and retired old ones, while the
bundled grouping files stayed a fixed snapshot. So the 31 are retired GSPs still in the file and
the 14 are new GSPs it never gained. **That explains the two set-membership problems but not the
15 duplicates** — staleness cannot put one GSP in two groupings at once, so that remains a live
question.

**Preferred fix: get it from v1 and delete the grouping files entirely.** Checked against the
spec — v1 GSP metadata currently carries only `full_name` and `gsp_id`, and the spec never mentions
DNO, licence area or grouping, so this is not available today. The contract's sparse
`RegionTypeCapability.level` (0 national, 10 gsp) was deliberately left open for it. Two asks for
the API owner, in order:

1. **Add the DNO and NG zone to each GSP region's metadata.** Groupings then derive from the same
   payload as the GSP list, so additions and retirements cannot drift — the whole staleness class
   dies at source and the bundled files are deleted rather than regenerated. The rollup stays
   client-side and simply reads live ids.
2. **Eventually, DNO and zone as first-class region types with their own `level`**, so `period` and
   `snapshot` serve them directly.

**The schema depends on the apportionment answer, so ask both together:** if a GSP can legitimately
feed two licence areas the field must be `dnos: []`, not `dno: string`; if it cannot, the 15
duplicates are simply a data error.

He does **not** yet have the final answer on apportionment or on where the double-count originates
(is a GSP feeding two licence areas legitimate, or a data error?). So this is pinned, not fixed,
and must be revisited at the end of the phase. The reconciliation test wave 3 adds is the tripwire:
NG zones reconcile to national, DNO deliberately does not, and the assertion says so out loud. When
Phase 5 regenerates the groupings name-keyed, that test flips from documenting a bug to proving the
fix.

**Gap found by Track C, must close before the v0 dialect can be deleted.** The delta view has two
charts, and only one was in scope. `DeltaChart`'s *top* `RemixLine` — national forecast vs actual —
still reads `useFormatChartData` through v0 props; Track C migrated the GSP list/bucket UI beneath
it. So `use-format-chart-data.tsx`'s `@deprecated` v0 dialect has a live consumer even after
Tracks C and D are done. Migrating that top chart is a prerequisite for the wave-4 cleanup, not an
optional tidy — deleting the dialect first would break the delta view.

No track edits `pages/index.tsx`. Each stops *reading* the props it no longer needs and leaves them
in the signature — `CombinedData` dissolves in wave 4, per the decision below. Views double-fetch
(v0 props + v1 hooks) mid-phase; that is intended and ends in wave 4.

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

## Decisions taken in the migration session (2026-08-06)

- **Model names: use the non-`_adjust` variants, provisionally.** v1 has no `trend_adjuster_on`
  param (0 hits in `v1-api.json`); it currently exposes `_adjust` model variants instead. The API
  is about to change again — an `adjust` boolean like v0's, plus simplified model names — so Brad's
  call is to wire the plain names now and amend once that settles. Mapping used:
  `blend`→`blend`, `pvnet_intraday_ecmwf_only`→`pvnet_ecmwf`, `pvnet_day_ahead`→`pvnet_day_ahead`,
  `pvnet_intraday`→`pvnet_intraday`, `pvnet_intraday_met_office_only`→`pvnet_ukv`,
  `pvnet_intraday_sat_only`→`pvnet_sat`. The last one is an **unconfirmed inference**.
  **Consequence: the national chart will not match production**, because prod is trend-adjusted and
  these are not. Agreed, not a regression.
- **Chart series are a curated per-country list in `config/countries.ts`** — not hardcoded fetches,
  and not yet derived from the manifest. GB keeps today's six lines. This absorbs D4's copy-pasted
  `<Line>` blocks without also changing what is on screen in the same pass, and keeps the model swap
  above to a one-line edit.
- **`met_office_only → pvnet_ukv` is confirmed, not an inference.** The manifest labels
  `pvnet_ukv` as "PVNet Intraday (Met Office)". All six v0 models map cleanly.
- **Legend labels come from the manifest, and the copy change is accepted as-is.** GB now reads
  "PV Live Estimated"/"PV Live Updated" instead of "PV live initial"/"PV live updated", and the
  comparison models read their full manifest names ("PVNet Intraday (ECMWF)" for "ECMWF-only").
  No per-country display override was added: hardcoding GB's copy would have labelled NL's
  `ned_nl` with GB wording, and the same incoming API change that brings the `adjust` boolean also
  shortens the model names, so the long labels are expected to shrink at the source. Revisit only
  if the legend crowds at real width.
- **The delta map's three collapsed states get separated now.** Today `!currentYield.yield` forces
  `delta = 0`, so a future time, a genuine overnight zero and a region absent from the payload all
  render identically as "on target". Audit B8's bug class; the map rewrite is the cheap moment.
  Fixed rather than pinned, by Brad's decision — so it is a visible change to eyeball against prod.

### Geometry stays where it is during Phase 4

`public/geo/` **does not exist yet** — the registry's `geo` URLs in `config/countries.ts` point at
files Phase 5 creates. Geometry keeps loading from the bundled `data/*.json` imports. Phase 4 is the
*value* pipeline; Phase 5 is the *geometry* pipeline.

Interim join: bundled GeoJSON features are keyed by numeric GSP id, v1 keys by region name
(`citr_1`). `useRegions(gspScope)` returns `Region.metadata.gsp_id`, which bridges the two. Isolate
it in one commented function — Phase 5 deletes it when the boundaries are regenerated name-keyed.

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
