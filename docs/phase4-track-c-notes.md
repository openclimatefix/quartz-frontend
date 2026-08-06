# Phase 4, Track C — the delta chart's GSP list and buckets

Working notes for migrating the delta bucket UI onto the v1 data layer. Companion to
`phase4-contract.md` (the interface) and `phase4-track-a-notes.md` (the map's seam this
reuses).

State: `npx tsc --noEmit` exit 0, `npx jest` 30 suites / 941 tests green (baseline was
28/933; the extra suite is not mine — a concurrent track's test landed in the same run).
Prettier clean. Nothing committed.

---

## What landed

### Files edited

- `components/charts/delta-view/delta-view-chart.tsx` — `DeltaChart` no longer reads
  `combinedData.gspDeltas`. It still destructures the rest of `combinedData` (national
  forecast/actual series feeding the top `RemixLine`, which is out of scope here and stays
  v0 for this step) and calls the new `useGspDeltas(selectedTime)` hook for the GSP list and
  bucket counts instead. `gspDeltas` stays in `CombinedData`'s destructure comment as a
  pointer to why it's gone, and stays in the type/prop chain untouched.

### Files created

- `components/charts/delta-view/use-gsp-deltas.ts` — the hook. Calls `useCurrentCountry`,
  `useForecastPeriod`, `useGenerationPeriod`, `useRegions` over `{ regionType: "gsp" }` with
  the same `getEarliestForecastTimestamp()…getFurthestForecastTimestamp()` window
  `useMapRegionValues` uses, so the delta map and this hook share one SWR cache entry per
  endpoint rather than issuing the request twice. The actual join — `hasDelta`, `delta`,
  `deltaBucket`, the future-slot rule — is Track A's `buildRegionValues` from
  `components/helpers/data.ts`, called directly rather than reimplemented, per the brief's
  "do not build a second, parallel delta computation" instruction. This hook's own work is
  just: filter to `hasDelta === true`, bridge each region name to its numeric `gspId` via
  `buildRegionBridge` (needed because `GspDeltaColumn`'s map-selection interop —
  `selectedMapRegionIds`, shared global state with the map — is keyed on the numeric GSP id,
  not the region name), and shape the result as `Map<string, GspDeltaValue>` so
  `delta-buckets-ui.tsx` and `GspDeltaColumn` (both unedited) keep working against the exact
  type they already expect.
- `components/charts/delta-view/use-gsp-deltas.test.tsx` — 3 tests, MSW over the real
  `queries → client → normalise` machinery against the same GB GSP fixtures Track A's map
  test uses (`citr_1` / `gsp_id 67`, the "City Road" region from the contract's own example).
  Covers: the MW delta computed from the fixture (forecast 1.538 MW, generation 1.599 MW →
  delta 0.061 MW), the label/gspId bridge, the scrub-issues-no-extra-request property
  (inherited free from reusing `useForecastPeriod`/`useGenerationPeriod`), and the exclusion
  case — a target time outside the fetched window has `hasDelta: false` for every region, and
  the map comes back **empty**, not full of zeroes.

---

## The three-state distinction, as it applies here

`DELTA_BUCKET` has nine buckets, `NEG4..POS4`, with `ZERO` a real bucket for a genuine
near-zero delta. There is no "no-data" bucket. `hasDelta === false` — a future slot, or a
region where forecast or generation hasn't published — is **dropped from the map entirely**,
the same "draws nothing" treatment `deltaMap.tsx` gives those regions, rather than being
folded into `ZERO`. The v0 code (`pages/index.tsx`'s old `gspDeltas` memo) did the opposite:
`isFutureOrNoYield` forced `delta = 0`, so an unpublished GSP and a genuine dead-calm GSP were
indistinguishable in the bucket counts. That collapse is gone by construction — `useGspDeltas`
never inserts a `hasDelta: false` region into the map at all, so `DeltaBuckets`' "no
positive/negative GSP deltas for current filters" empty state now means what it says, rather
than counting unpublished GSPs as zero.

---

## Assumptions

- **"The delta chart" = the GSP list + bucket UI**, not the top `RemixLine` inside
  `DeltaChart` (the national forecast-vs-actual overlay). Only `GspDeltaColumn` and
  `DeltaBuckets` ever read `gspDeltas`; the top chart reads `nationalForecastData` /
  `pvRealDayInData` / `pvRealDayAfterData` / `nationalNHourData` via `useFormatChartData`,
  which is Track B's file (`use-format-chart-data.tsx`) and out of my ownership. Left as v0
  for this step — matches the brief's "the delta chart currently reads the `gspDeltas` Map"
  framing, which is specifically about that prop, not the whole component.
- **`GspDeltaValue`'s dead fields stay dead.** `deltaColor`, `dataKey`, `deltaPercentage` are
  declared on the type (`components/types.d.ts`, not owned) but nothing in `delta-view/**`
  ever reads them — confirmed by grep before writing the hook. v0's own construction of this
  Map didn't even set `deltaColor`/`dataKey` (untyped `new Map()`, so the type annotation on
  the prop was never checked against the literal). I populate them with harmless placeholder
  values (`""`, and `dataKey` mirroring `deltaBucketKey`) purely to satisfy the type checker,
  not because anything downstream uses them.
- **A region with no resolvable numeric `gspId`** (the four `Off_NETS` placeholders Track A's
  notes describe, which have no real GSP behind them) is dropped from the delta map the same
  way a `hasDelta: false` region is. They are boundary-file artifacts, not real API regions,
  so `useRegions` shouldn't return them in the first place — this is a defensive guard, not an
  observed case.
- **`selectedTime` (minute-truncated, no offset) is an acceptable `targetTime`,** not the raw
  `selectedISOTime` the map passes. `buildRegionValues`' `utcMinuteKey` reformats either form
  to the same `yyyy-MM-ddTHH:mm` key, and `selectedTime` already has `DeltaChart`'s existing
  fallback (`selectedISOTime || new Date().toISOString()`), so reusing it avoids a new
  undefined-handling path for no behavioural difference.

## Nothing contradicts the docs

Read `docs/phase4-track-a-notes.md` before writing any bucketing code, per the brief.
`buildRegionValues`, `buildRegionBridge`, `regionSeriesSnapshotAt`, `getEarliestForecastTimestamp`
and `getFurthestForecastTimestamp` were all already exported from `components/helpers/data.ts`
for exactly this kind of reuse — no gap found, nothing needed there.

## No change needed in a file I don't own

None found. `delta-header-block.tsx` (`DeltaHeaderBlock`, also under `delta-view/**` but
untouched) takes a pre-computed `deltaValue` string prop from `forecast-header/index.tsx`
(Track B) and never reads `gspDeltas` — it's the *national* delta, a different number, and
out of scope for this step.
