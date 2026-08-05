# Adaptive EU UI — v1 API migration & multi-country refactor

Working document for the `epic/adaptive-eu-ui` epic. Covers why the refactor is happening, the
architecture it moves to, the facts established against the live API, and the phase breakdown.

---

## Context

`apps/nowcasting-app` is a single-tenant GB dashboard. Every API call hardcodes `/solar/GB/`
(13+ call sites in `pages/index.tsx` alone), the GB grid hierarchy (GSP / DNO / NG-zone) *is* the
app's data model rather than a pluggable concept, ~30MB of GB-only boundary GeoJSON is statically
imported into the bundle, and `Europe/London` is baked into every date helper. NL support prior to
this work was a single line stripping sites named `nl_*`. The `feat/NL-toggle` branch got NL working
on v1, but by duplicating chart components (`NLNationalChart.tsx`, `NLRegionalChart.tsx`) and
branching inside `index.tsx` — a pattern that does not survive a third country.

The v1 API changes the calculus. Every route is `/{country}/{source}/…`, and `GET /countries`
returns a **capability manifest** per country: region types with their hierarchy level, the valid
forecast models and default model for each, and the available generation observers. The app can
therefore configure most of itself at runtime. Adding Germany should mean one entry in a static
registry (geo assets, timezone, map view), one Auth0 role, and nothing else.

`NOWCASTING-APP-AUDIT.md` catalogues 40 advisories. The data-layer, performance and testing ones
(C1–C6, B1, B2, B5–B9, D1–D3, G1) live precisely in the code this migration rewrites, so they are
fixed as a consequence of the work rather than as separate tickets.

**Outcome:** one generic data pipeline, country as a first-class dimension, and a test suite that
makes the migration safe rather than discovering regressions in production.

---

## Status

**Phase 0 complete**, committed on `epic/adaptive-eu-ui` (unpushed): `d24275a` dead code,
`f748d69` deps, `a2af899` test infra, `9a565eb` lint ratchet, `f5d982a` `.attic` ignore.
101 tests pass, typecheck clean, 0 lint errors, production build succeeds.

Where Phase 0 departed from the original plan, and why:

- **`exhaustive-deps` is a ratchet, not a flat error.** Turning it straight to error meant 24
  failures across 12 files. Adding a missing dependency changes how often an effect or memo
  re-runs — on a map or a polling chart that risks an infinite render loop or a request storm —
  and doing that before the Phase 1 tests exist trades a known lint warning for an unknown runtime
  fault. So: error everywhere, with the 12 existing files pinned at `warn` as a shrink-only backlog
  in `.eslintrc.js`. Most are rewritten in Phase 4, so the list largely deletes itself.
- **The jest UTC setting never worked.** `globals: { TZ: "UTC" }` injects a variable into the test
  sandbox; it does not set the process timezone. Tests ran in the machine's local zone — the wrong
  property to leave to chance in an app whose known defects are timezone defects. Now pinned via
  `globalSetup` (Node caches the zone before `setupFiles` runs) and asserted in a test.
- **Standing up jsdom/RTL/MSW took four non-obvious fixes**, all documented in the config files:
  Node export conditions via a custom environment (the usual `customExportConditions: [""]`
  workaround breaks `@sentry/nextjs`, which declares no `default` condition), Fetch API polyfills
  with undici pinned to v6, a `jsx: "react-jsx"` transform override for ts-jest, and matchers routed
  through `@jest/globals` because the Cypress chai types win the collision on the global `expect`.
  `lib/__tests__/test-infrastructure.test.tsx` guards all four against a dependency bump.
- **Dead code removal exposed a fake type bound.** `useLoadDataFromApi`'s generic was bounded by a
  union whose last member matched almost anything; several callers only compiled because of it. The
  bound was dropped rather than re-enumerating shapes v1 is about to delete.
- **Audit F1 clutter was moved, not deleted** — into a gitignored `.attic/` at the repo root with a
  README manifest. All of it was untracked, so no history was lost.
- **`/` builds at 11.3 MB first-load JS**, which quantifies the Phase 5 geo work.

Deliberately left alone: `clover.xml` (the only tracked clutter candidate, so it needs a real
commit), and the large unreferenced GeoJSON in `data/` (`zone-geojson-test.json` 61MB,
`gsp_regions_20220314.json` 21MB), which is Phase 5 work.

**Phase 1 complete** (uncommitted). 9 suites / **571 tests** (from 101), typecheck clean, 0 lint
errors, production build succeeds. New: `csvDownload.test.ts` (61), `data.geo.test.ts` (50),
`utils.delta.test.ts` (63), `use-format-chart-data.test.tsx` (53), plus ~255 added across the three
existing helper suites.

Bug fixes landed with the tests, as planned:

- **B8** — zeros in the CSV. `entry.solarGenerationKw ? … : null` treated a genuine 0 kW reading as
  missing, blanking every overnight row. Now a nullish check. The same pass found the forecast
  columns propagating `undefined` where the type says `number | null`; normalised to `null`, which
  also fixes delta silently dropping out when either side was 0.
- **B2** — the forecast window helpers. The round-*up* added `hour % 6` (14:00 → 16:00, not a
  boundary at all); it is now a true ceiling and idempotent on boundaries. Both helpers now do their
  arithmetic in UTC, so a viewer in LA gets the same window as one in London — previously they
  differed by hours.
- **B9 — the audit's diagnosis was wrong, and the prescribed fix would have caused a regression.**
  See below.

`downloadNationalCsv` was split into a pure `buildCsvRows` + `generateCsv` and a thin DOM wrapper,
with its public signature unchanged, because none of it was testable otherwise.

### B9: what the audit got wrong

The audit called the chart path's settlement period "off by two all summer" and prescribed making
`getSettlementPeriodForDate` convert to `Europe/London`. Applied literally, that would have shifted
every seasonal-mean and seasonal-bound line on the national chart by two slots throughout BST — a
visible regression, introduced as a bug fix.

The reason: `data/national_metrics.json` is bucketed by **UTC** time-of-day, so its 48-element
arrays are indexed by UTC half-hour slot, not by settlement period. Its generator
(`client-private/seasonal-norm/main.py`) groups on `datetime_gmt` with no timezone conversion, and
the data agrees — the midpoint of the daylight window, which is fixed by solar geometry rather than
by cloud, sits at 12:30 in December (when UK local time *is* UTC) and 12:15–12:30 in June. Local-time
bucketing would put June an hour later. The June sunrise edge confirms it independently: first
generation at slot 04:30 is just after sunrise read as UTC, and before sunrise read as BST.

So `getSettlementPeriodForDate(date.toUTC())` minus one was *already* the correct UTC slot index, and
the chart was right. Its other use, `chartMap[key].SETTLEMENT_PERIOD`, is written and never read
anywhere in the app — which also answers the audit's open question: there was no user-visible
settlement-period bug, only a latent one.

Resolved by separating the two concepts rather than converting in place: `getUtcHalfHourIndex` for
indexing UTC-bucketed data, `getSettlementPeriodForDate` for the GB settlement period a user reads
(now correctly London-based, with 46/50-period clock-change days handled, for its one real consumer,
the CSV). A test pins that the two agree in GMT and differ by exactly 2 in BST.

### Notable behaviours pinned but deliberately not fixed

Each is marked `// CHARACTERISATION` in the tests, with a note on which phase inverts it.

- **B6 staleness** is pinned by asserting the memo returns the *same array instance* when only an
  omitted dependency changes. A control test shows a real dependency changing drags the ignored one
  along, which is why the bug is intermittent rather than reliably broken. That block failing is how
  Phase 4 will know the fix landed.
- **B5** — `aggregateTruthData` (in `use-get-gsp-data.ts`, not `helpers/data.ts` as the audit says)
  reverses the SWR-cached array in place; the test proves the caller's array is mutated.
- **The chart merge key is a raw datetime string, not a parsed instant.** `…10:00:00Z` and
  `…10:00:00+00:00` produce two half-populated rows sharing one `formattedDate`. Latent today
  because every producer emits `+00:00` — but the v1 client is exactly what would start emitting
  `Z`. **Fix in Phase 2 as part of `normalise.ts`**, not Phase 4: canonicalising the instant at the
  boundary is where this belongs anyway.
- Missing readings: `null / 1000 === 0` plots a hard zero, and `undefined` yields `NaN` that
  propagates into `getZoomYMax` and the DNO/zone rollups, where one missing member GSP blanks a whole
  region. `getDeltaBucket` and `getDelta` both return a zero-ish answer for "no data", making it
  indistinguishable from "exactly on forecast".
- `fourHourData` merges *after* the settlement/seasonal loop, so a timestamp only the N-hour series
  knows about gets neither.

---

## Decisions

| Question | Decision |
|---|---|
| Sites API | Stays on its current client/URL; v1 support is coming. Isolated behind the shared fetcher so the swap is a one-file change. |
| Satellite | Deferred. Stays on its current client in the interim. |
| Status | Deferred. Will come from the separate Status API (outside main infra), not `/solar/GB/status`. |
| Geo assets | Lazy-fetch from `public/` now; Mapbox tilesets or an API geometry endpoint later. Registry indirection makes that swap config-only. |
| Country model | Combined UI — the app knows about every country the user has access to. Not a route. |
| Country UI | A country toggle in the menu, following `country-toggle.tsx` from the NL branch. A working draft to be assessed against v1 in practice, not a final answer; the data layer is built so revisiting it is a UI change only. |
| `/countries` scope | Returns **all** countries, not just entitled ones, by design — so prospects can see what is available and configure ahead of a subscription completing. The frontend intersects with entitlement. |
| NL branch | Superseded. `data/netherlands.json`, the v1 learnings and the legend / measuring-unit / chart-gap fixes are harvested; the `NL*` duplicate components are dropped. |
| Test stack | jsdom + React Testing Library + MSW on top of the existing pure-function suites. |

### Scope model

**Explicit scope in the data layer, current-country convention in the UI.**

This is what lets the menu toggle be a working draft rather than a commitment. The toggle sets the
current country and everything reads from it — but the map can still show all entitled countries at
once, and that case decides the design: the fetching layer must already fan out to N countries no
matter what the charts do. A context-only model means the map either bypasses the data layer or
forces a rewrite the moment the UX changes.

- Every data hook takes an explicit `Scope = { country, source, regionType, region? }`. No ambient
  country inside the fetching layer.
- `useCurrentCountry()` is a thin context supplying the default scope for charts, headline figures
  and CSV, so single-country UI stays as ergonomic as today.
- `useEntitledCountries()` fans out for the map and any cross-country totals.

Because SWR cache keys include the country, N-country fanout is free — per-country dedup, refresh
and error state come out of the box. The cost is one extra argument; the cost of the alternative is
a second refactor.

---

## Verified API facts

Established by probing the live API on 2026-08-04. Recorded here so they do not have to be
re-derived.

**The API token in `apps/nowcasting-app/.env.local` (`QUARTZ_API_V1_TOKEN`) works against
production only** — `https://api.quartz.solar/v1`. Both `api-dev.quartz.solar` and
`api-dev.nowcasting.io` reject it with `invalid_token` / "No matching key found for kid": a
different Auth0 tenant signs dev tokens.

1. **The GeoJSON join works on a plain `.toLowerCase()`.** v1 GB gsp region names are lowercase
   codes (`citr_1`, `sjow_1`) and merged GSPs are pipe-joined composites
   (`actl_2|cbnk_h|gree_h|peri_h|wesa_h`) — and the GeoJSON `properties.GSPs` uses the same scheme
   in uppercase. Case-insensitive whole-string match: **345/349 features, 331/338 regions.** No
   pipe-splitting or fuzzy matching needed. The registry carries `joinTransform: "lowercase"`
   alongside `joinProperty`.
2. **`metadata.gsp_id` is present**, so regenerating the client-side groupings is a clean id lookup:
   `dno_gsp_groupings.json` resolves 348/349 refs, `ng_gsp_zone_groupings.json` 306/317. The
   unresolvable ids are GSPs the API has since merged into composites; the regeneration script
   should report them for a decision rather than silently drop them.
3. **`metadata.full_name` is the human label** ("City Road" for `citr_1`). Key on `name`, display
   `full_name` — raw codes must not reach users.
4. **7 API regions have no polygon** (`iver_1`, `iver_6`, `brle_1`, `flee_1`, `safo_1`,
   `carr_1|fidf_1`, and a 6-way `actl_2|…|powe_h|…` variant): the API splits and merges differently
   from the 2025-01-09 boundary file. Separately, 4 GeoJSON features have no data
   (`Off_NETS(unassigned)` ×3 covering Mull/Tiree, Ardnamurchan and the Kintyre coast, plus
   `Off_NETS(G_EXTRA_12)` covering Shetland) — genuinely unassigned island and offshore polygons,
   correctly rendered as no-data. The 7 API-side gaps are boundary-file version skew and **need a
   decision in Phase 5**: refresh the file or add an alias map.
5. **NL has one generation observer** (`ned_nl`) where GB has two (`pvlive_in_day`,
   `pvlive_day_after`). The GENERATION vs GENERATION_UPDATED two-line chart is therefore
   *GB-specific*, and chart series must be driven off `generation_sources` from the manifest.
6. **Models are per region type, not per country.** GB `national` offers 12 models, GB `gsp` only 3
   (`blend`, `pvnet_intraday`, `pvnet_day_ahead`). Defaults differ too: `blend_adjust` national,
   `blend` gsp. The model picker must be region-type aware.
7. **`level` is sparse** — 0 for national, 10 for gsp/province — leaving deliberate room to slot
   GB's derived DNO/zone levels in between.
8. **GB's national region is named "Great Britain"**, with `national` accepted as a path alias. Key
   on the alias, display the name.

---

## Architecture

```
config/countries.ts        Static registry — only what the API cannot tell us
lib/api/v1/
  schema.d.ts              openapi-typescript, generated from v1-api.json
  client.ts                openapi-fetch client + shared cached token
  queries.ts               Pure: Scope + window -> { path, params }        [unit-tested]
lib/domain/
  types.ts                 Scope, TimeSeries, RegionSeries, RegionSnapshot, CountryCapability
  normalise.ts             Pure: v1 wire shape -> canonical model          [unit-tested]
hooks/data/                SWR hooks over queries + normalise; take explicit Scope
hooks/derived/             Delta, client-side groupings, chart formatting  [unit-tested]
```

### Time discipline

**Everything stays UTC until it is shown to a user.** The wire is UTC (`times_utc`), the canonical
model keeps UTC ISO strings, and every chart map, cache key and comparison works in UTC. Conversion
to a zone happens at the render boundary, using the timezone from the country registry.

Stating it explicitly matters because "keep it UTC" alone does not decide two cases, and leaving
them implicit is what produced B9:

1. **Domain concepts defined in local time.** A GB settlement period *is* half-hours from
   `Europe/London` midnight — that is its definition, not a formatting choice. It is still consistent
   with the rule: a user-facing label derived at the boundary from a UTC instant. The bug was
   conflating it with a positional index into a UTC-bucketed dataset. The two are now separate
   functions (`getSettlementPeriodForDate` vs `getUtcHalfHourIndex`) precisely so the boundary is
   visible in the type of question being asked.
2. **Day bucketing.** A "day" is inherently local, so anything keyed by day has to choose a zone.
   `national_metrics.json` is keyed by month/day derived from UTC, so its "21 June" is 00:00–00:00
   UTC rather than local midnight to local midnight. Immaterial for GB and DE; a real choice, not a
   default. **Phase 3 decision** — it only becomes visible at a larger offset, and the same question
   applies to axis day labels and any per-day CSV grouping.

**Canonical internal model.** v1 speaks kW and returns columnar matrices (`times_utc[]` +
`regions[].power_kW[]`). Normalise **once at the boundary** to MW keyed by region name — MW is what
`MAX_NATIONAL_GENERATION_MW`, `Y_MAX_TICKS`, the CSV export and every chart already assume. Nothing
downstream sees kW or columnar shapes.

**Region identity standardises on `regionName: string`, replacing `gspId: number`.** The app has
been in a half-way house on this: `components/helpers/data.ts` already joins on name
(`system.gspName === feature.properties.GSPs`) while the grouping files still key by numeric gsp_id.
v1 is the point to commit to the recommended way of referencing regions, and it is what makes the
model portable — a numeric GSP id means nothing in NL or DE, a region name does. Consequences:

- Grouping files are regenerated name-keyed by a one-off script under `data/scripts/`.
- The GeoJSON join property is declared per country + region type in the registry, so no country
  needs bespoke join code.
- `gspId` disappears from the domain types rather than lingering alongside the name.

### Dynamic vs static

**From the API (`GET /countries`, cached long) — never hardcoded:** country code, display name,
national capacity, centroid, region types + hierarchy levels + labels, forecast models + default
model per region type, generation observers.

This removes the hardcoded five-model comparison block in `pages/index.tsx` — models come from
`regionType.forecast_models`, so a new model appears in the UI with no code change (and resolves
B7's two fetched-but-never-rendered endpoints).

**Static registry `config/countries.ts` — one entry per country:**

```ts
{
  code: "GB",
  timezone: "Europe/London",         // replaces hardcoded Europe/London  (F5, B2, B9)
  locale: "en-GB",
  map: { center, zoom, minZoom, maxZoom },
  geo: {
    gsp: { url: "/geo/gb/gsp.json", joinProperty: "GSPs", joinTransform: "lowercase" },
    national: { url: "/geo/gb/national.json", joinProperty: "name" }
  },
  derivedRegionTypes: {               // client-side groupings the API doesn't model
    dno:  { source: "gsp", groupings: "/geo/gb/dno-groupings.json", label: "DNO" },
    zone: { source: "gsp", groupings: "/geo/gb/zone-groupings.json", label: "Zone" }
  },
  overlays: [{ id: "constraints", url: "/geo/gb/ng-constraints.json" }],
  seasonalNorms: "/data/gb/national-metrics.json",
  auth0Role: "GB_ROLE_ID"
}
```

`derivedRegionTypes` is the escape hatch keeping GB's DNO/zone levels working without polluting the
generic model — v1 offers only `national`, `gsp`, `province`. `NationalAggregation` and
`AGGREGATION_LEVELS` (currently GB-shaped enums in `components/map/types.ts` and `constant.ts`)
become a country-derived list of `{ regionType, level, label, minZoom, maxZoom }`.

### Endpoint mapping

| Today (v0) | v1 replacement |
|---|---|
| `/solar/GB/national/forecast` (×6 models) | `/{c}/{s}/regions/national/forecast?model=…`, models from manifest |
| `/solar/GB/national/pvlive?regime=…` | `/{c}/{s}/regions/national/generation?observer=…` |
| `/solar/GB/national/forecast?forecast_horizon_minutes=` | `…/forecast?horizon_minutes=` |
| `/solar/GB/gsp/forecast/all?compact=true` + stitching | `/{c}/{s}/forecasts/period` (columnar, one request) |
| `/solar/GB/gsp/pvlive/all?compact=true` + stitching | `/{c}/{s}/generation/period` |
| map data via O(n×m) joins over all-GSP payloads | `/forecasts/snapshot` + `/generation/snapshot` — one value per region name |
| `/system/GB/gsp/` | `/{c}/{s}/regions?region_type=…` |
| — | `/{c}/{s}/regions/{r}/forecast/last-updated` (freshness indicator) |

The `period` and `snapshot` endpoints are the major simplification: they delete the incremental
historic/future stitching wholesale, taking B1 (splice-in-forEach), C4 (race-prone stitching) and
D2 (O(n×m) map joins) with them.

---

## Dependencies

1. **Auth0 country claim.** `../.attic/root/auth0Roles.js` assigns `GB_ROLE_ID` / `NL_ROLE_ID` per client domain
   but sets only `trial_ends_at` as a custom claim, so roles never reach the token. A country claim
   off those same roles is being added. `pages/api/get_token.ts` surfaces it, and `useCountries()`
   intersects it with the `/countries` manifest to mark each country `entitled: boolean`. The read
   is guarded so a missing claim degrades to "nothing entitled but everything discoverable" rather
   than throwing, which keeps local dev and any claim-propagation lag working.
2. **Status API and satellite** — deferred. Both stay on their current clients, routed through the
   shared token-cached fetcher in Phase 5 so the eventual swap is a one-file change.

---

## Naming, structure and in-flight work

Component filenames, titles and most of the existing logic are explicitly **not** load-bearing —
there is no attachment to them, and tidying them up is in scope for this epic.

**The rule: rename when you are already rewriting the file, not before.** A standalone rename pass
would collide with everything in flight, and produce a diff where genuine behaviour changes are
buried in move noise. Each phase renames what it touches, and the characterisation tests are what
make that safe — they are written against behaviour, so a rename that breaks something fails loudly.

The one category worth being eager about is **names that encode GB-specific concepts**, because
Phase 3 and 4 otherwise cement them into the generic layer where they are actively misleading:
`gsp` in anything not GB-specific (region types come from the manifest), `pvlive` in shared code
(NL's observer is `ned_nl`), and `remix`/`RemixLine` for what is simply the main chart. Rename these
as their phase reaches them, and do not introduce new ones.

Also in scope as their phase reaches them: the `data.ts` / `utils.ts` grab-bags split along the
architecture boundaries above; `globalState.tsx` and `constant.ts` reshaped by the Phase 3 state
split; the dead `SETTLEMENT_PERIOD` chart key dropped.

**The rebrand / reskin is Phase 7 — the last phase of this epic.** It is a restyle: colours, copy,
assets and branding, with components staying where they are. Running it last is the right order,
because it then applies to the decomposed components Phase 4 leaves behind rather than to the
~800-line `index.tsx` that is about to be deleted, and there is no window where a styling diff and a
file-move diff have to be reviewed on top of each other.

The consequence for earlier phases: **do not guess at product-facing strings**. The
`Quartz_National_` CSV filename, page titles and `ChartInfo.tsx` copy all get revisited in Phase 7,
so where an earlier phase has to touch one, keep it mechanical — parameterise or move it, do not
reword it.

**Interim work folds into this branch.** Where a smaller change lands elsewhere that this epic
supersedes, bring it onto `epic/adaptive-eu-ui` rather than merging it separately and rebasing the
epic over it — the epic rewrites the same code, so a separate merge just creates a conflict to
resolve twice. The `feat/NL-toggle` branch is the model: harvested for `data/netherlands.json`, the
v1 learnings and the legend / measuring-unit / chart-gap fixes, with its duplicated `NL*` components
dropped rather than merged.

## Implementation phases

Each phase is independently shippable and leaves the app working.

**Phase 0 — Groundwork (no behaviour change).** *Complete — see Status.*

**Phase 1 — Characterisation tests (before touching data code).** *Complete — see Status.*

**Phase 2 — v1 client foundation.**
- Generate `lib/api/v1/schema.d.ts` from `v1-api.json` via the already-installed
  `openapi-typescript`; retire `types/quartz-api.d.ts` (C1).
- Build `lib/api/v1/client.ts`: `openapi-fetch` plus a **shared cached token** (C2 — every call
  currently makes an extra `/api/get_token` round trip; `satelliteLayer.ts` has its own 60s cache
  that this replaces). Typed errors replace `error.toString().includes("403")`.
- `queries.ts` and `normalise.ts` as pure functions, fully unit-tested against the spec.

**Phase 3 — Country configuration.**
- `config/countries.ts` registry plus `useCountries()` (manifest ∩ entitlement),
  `useCurrentCountry()`, `useEntitledCountries()`.
- Country toggle in the menu, adapting `country-toggle.tsx` from the NL branch: driven by
  `useCountries()`, with unentitled countries shown but disabled. Current country persists via
  cookie alongside the existing `visibleLines`/`pLevels` settings in `cookieStorage.ts`.
- Parameterise date/locale helpers in `components/helpers/utils.ts` and `csvDownload.ts` by timezone
  from the registry; standardise on Luxon (F5). Update `ChartInfo.tsx` copy.
- Per-country map defaults replace the hardcoded GB `lng`/`lat`/`zoom` in `globalState.tsx`.
- Split global state: cross-country keys (`selectedISOTime`, `view`, `visibleLines`, `activeUnit`,
  `pLevels`) stay flat; country-dependent keys (`clickedGspId`, viewport, aggregation level, region
  selection) become keyed by country code.

**Phase 4 — Migrate the pipeline, view by view.**
Order: national chart → forecast map → regional drill-down → delta → CSV. Each step swaps its hooks
to the v1 data layer against the Phase 1 tests. `pages/index.tsx` (~800 lines) decomposes into a
`useDashboardData(scope)` hook plus per-view containers, resolving D1's rebuilt-every-render
`combinedData`/`combinedErrors`. Chart series become config-driven from the model manifest,
absorbing D4's eight copy-pasted `<Line>` blocks and B5's prop-mutating sorts.

**Phase 5 — Geo, and the peripherals.**
- Move boundaries to `public/geo/{country}/…`, lazy-fetched via the registry; regenerate the
  grouping files name-keyed; resolve the 7 region/polygon gaps; delete unreferenced GeoJSON cruft
  after confirmation.
- Mapbox token to env (A1), style and token per registry.
- Sites, satellite and the status banner: left functional on their current clients but routed
  through the shared token-cached fetcher and scope, so each later swap is a one-file change.

**Phase 6 — Germany.**
Should reduce to: add the `DE` registry entry, drop in `public/geo/de/*`, add `DE_ROLE_ID`. Any code
change required here counts as a bug in the abstraction and is fixed there instead.

**Phase 7 — Rebrand / reskin.**
Colours, copy, assets and branding, applied to the decomposed components Phase 4 produces. No file
moves, no data-layer changes. See *Naming, structure and in-flight work* for why it goes last.

---

## Test strategy

- **Pure functions (jest):** `queries.ts` (scope → URL, table-driven per country), `normalise.ts`
  (kW→MW, columnar→canonical, null/gap handling), date and settlement-period helpers across DST
  boundaries and non-UK browser timezones, delta buckets, groupings, CSV rows.
- **Hooks (jest + jsdom + RTL + MSW):** `renderHook` over the data hooks with MSW handlers built
  from `v1-api.json` and recorded production payloads, covering multi-country fanout, entitlement
  filtering, refresh, error and retry paths. This is where the bugs that unit tests miss live.
- **Contract:** a test asserting fixtures still validate against `v1-api.json`, so backend shape
  drift fails CI rather than production.
- **E2E (Cypress):** thin — one smoke test per view with intercepted fixtures, plus a country-switch
  test, reusing the hook-test fixtures. Lands alongside the wider Cypress improvements.
- All wired into `.github/workflows/yarn_test.yaml` beside the existing jest and Cypress steps.

---

## Verification

1. `yarn test` — full suite green, with coverage on `lib/` reported.
2. `yarn dev` (port 3002) against the real v1 API; compare national chart, map, delta view and CSV
   export side by side against production for the same timestamp. Numbers must match to the MW,
   which is the real check that the kW conversion and the name-keyed joins are right.
3. Toggle to NL from the menu and confirm the same views render from the same components — no `NL*`
   components exist, and unentitled countries appear disabled rather than hidden.
4. Network panel: one `/api/get_token` per token lifetime rather than one per request, and
   `period`/`snapshot` replacing the per-GSP request storm.
5. Bundle analysis: GB boundaries no longer in the JS bundle (baseline to beat: 11.3 MB first-load).
6. Dry-run Phase 6 with a stub `DE` entry and confirm the app renders it without code changes.

---

## Open items

- Exact shape of the Auth0 country claim once added — the intersect logic is one small function, so
  this can be adjusted late.
- The 7 v1 regions with no polygon: refresh the boundary file or add an alias map (Phase 5).
- **The DNO groupings are not a partition.** 15 GSP ids each appear in two DNO groupings
  (26, 40, 60, 103, 135, 142, 155, 180, 199, 240, 279, 281, 322, 328, 341), so the DNO view
  double-counts their generation and DNO totals sum above national. The NG-zone groupings are clean
  (19 groups, 317 ids, no duplicates). The three files also disagree on which GSPs exist: DNO has 31
  ids the others lack, they have 14 DNO lacks. Needs a decision when the files are regenerated
  name-keyed in Phase 5 — is a GSP feeding two licence areas legitimate (in which case the rollup
  needs an apportionment rule) or is it a data error?
- **CSV output has no escaping** — every cell is joined raw on commas. Safe today (numbers and ISO
  datetimes only), but Phase 3 puts country and region labels into that file, and one label
  containing a comma or quote silently corrupts it. Fix before those labels land.
- Day-bucketing timezone for seasonal norms and axis day labels — see Time discipline (Phase 3).
- `generateGeoJsonForecastData` logs the aggregation level to the console on every call
  (`data.ts:237/250/260/272`), i.e. on every map render. Debug logging left in a hot path; delete it
  when Phase 4 rewrites the function.
- `prettyPrintDayLabelWithDate` formats in the viewer's zone with no `timeZone` option, unlike every
  neighbouring helper, so a late-evening UTC timestamp labels the wrong day for a UK viewer.
  Pinned by test; fix as part of the Phase 3 timezone parameterisation.
- `prettyPrintChartAxisLabelDate` throws on any Z-suffixed ISO string (it appends `+00:00` to a
  string that already carries a zone). Unreachable today — ticks arrive in the 16-char form — but it
  is an uncaught throw inside a chart tick formatter. Phase 4.
- Status API base URL and response shape.
- Satellite v1 path.
- Sites on v1 — the Phase 5 isolation is what makes the swap cheap when it lands.
- Multi-country UX beyond the menu toggle, once the toggle has been used against v1.
