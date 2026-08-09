# Phase 5 — Track C notes (region-type seam, UI consumers)

## What landed

Migrated all six owned files off `NationalAggregation` to the seam Track B built
(`useCurrentAggregationLevel` / `useAggregationLevels` / `defaultLevelOf`, all from
`components/helpers/aggregationLevels.ts` and `hooks/data`).

- **`components/map/color-guide-bar.tsx`** — deleted Track B's `as NationalAggregation` cast.
  `[NationalAggregation.zone, NationalAggregation.DNO].includes(...)` -> `currentLevel?.derived`,
  exactly as the contract names. The GSP-scale-vs-group-scale branch (`0-450` bands vs `0-4.5k`
  bands) stays a literal `currentLevel?.regionType === "gsp"` check — those numbers are
  GB-calibrated magnitudes, not a generic per-country rule, so genericising it to `!derived`
  would have silently started rendering GSP-shaped bands for NL's `province` level, which is a
  UX decision, not a type migration. Flagged as an assumption below.

- **`components/map/measuringUnit.tsx`** — the 16-ref file. Buttons now source `value`/`label`
  from `useAggregationLevels()` (finest non-derived level via `defaultLevelOf`, and the `dno`
  level looked up by name) instead of the enum. The commented-out Zone/National buttons are kept
  commented, now referencing string literals instead of enum members, so re-enabling them later
  is still a one-line uncomment. Which two levels this control offers was already a product
  decision (two buttons live, two commented) before this migration touched it; I preserved that
  shape rather than generalising to "one button per level," which would be a UX change nobody
  asked for.

- **`components/map/use-update-map-state-on-click.ts`** — both `=== NationalAggregation.GSP`
  sites became `=== "gsp"`. This is a genuine identity check, not a `derived` stand-in: `gsp` is
  the only region type whose feature/URL ids are numeric (the API's `gsp_id`); DNO, zone, and
  NL's `province` are all name-keyed. Documented inline.

- **`components/charts/ChartLegend.tsx`** — `NationalAggregation.DNO` -> `"dno"`. The gated copy
  ("DNO-level data" / "GSP-level aggregation") is itself GB-specific hardcoded text, so this
  stays a literal check.

- **`components/charts/gsp-pv-remix-chart/index.tsx`** — `NationalAggregation.GSP` /
  `.national` comparisons -> `"gsp"` / `"national"`. Kept Track B's `groupGspIds(...)` cast (see
  "Left for Track D" below) since `components/helpers/data.ts` is out of scope. The
  `${nationalAggregationLevel}s selected` string interpolation is now a hardcoded `"GSPs
  selected"` literal — the old code produced "GSPs selected" off the enum's `"GSP"` value; with
  the region-type name now lowercase (`"gsp"`), the interpolation would have silently become
  "gsps selected". Not a copy change — I hardcoded it specifically to prevent one.

- **`pages/index.tsx`** — the delta-view force and the "unset clicked GSP" guard both now use
  `defaultLevelOf(useAggregationLevels())` (the country's finest non-derived level), matching
  `defaultAggregationLevel`'s rule and the contract's "becomes the country's finest non-derived
  level" instruction verbatim.

## Visible copy changes (flagging per the brief — not decided unilaterally)

- **`measuringUnit.tsx`, first toggle button**: text was hardcoded `"GSP"`, now
  `finestLevel.label`. For GB once the manifest has loaded, that is **"Grid Supply Point"**
  (per the contract and Track B's notes). Before the manifest loads, the aggregationLevels
  fallback (`fallbackLabel`) capitalises the raw region type instead, so the button would flash
  **"Gsp"** momentarily on first paint, then settle to "Grid Supply Point". This is the same
  "National / DNO / Zone / Grid Supply Point" question Track B already raised; I did not
  shorten it, per the brief.
- **`measuringUnit.tsx`, second toggle button**: text was hardcoded `"DNO"`, now
  `dnoLevel.label`. The registry's fallback label for `dno` is `"DNO"` (config/countries.ts:209)
  and the manifest is expected to agree, so this one is a no-op in practice, but it is now
  driven by data rather than a literal, so a manifest change would move it.
- Everywhere else I kept literal copy identical (see the `"GSPs selected"` fix above, which
  actively prevents a regression rather than introducing one).

## Left for Track D

I initially left Track B's `groupGspIds(nationalAggregationLevel as NationalAggregation, name)`
cast in `gsp-pv-remix-chart/index.tsx`, as instructed, with a `TODO(phase5-track-d)` noting a bug
I found beyond what the contract predicted: `AGGREGATION_GROUPINGS` in
`components/helpers/data.ts` was keyed by the enum's *capitalised* string values (`"Zone"`,
`"DNO"`, `"National"`), while `nationalAggregationLevel` is the registry's *lowercase* name, so
`groupGspIds` silently returned `undefined` for every DNO/zone/national selection already — not
a hypothetical the cast deferred, a live regression from the Track B state change.

**Mid-session, Track D landed the seam 1 rekey and `groupGspIds` was deleted from `data.ts`
entirely**, replaced by `groupRegionNames(groupings, groupName): string[] | undefined` (name-keyed,
no numeric ids, matching the contract's seam 1 spec verbatim). This broke my file's build (the
import no longer resolves). I did **not** edit `data.ts` and did **not** edit
`use-gsp-region-data.ts` (out of scope) to try to complete the rewire, because doing so correctly
needs both: (1) the actual `groupings` object threaded into this component from wherever
`dno-groupings.json`/`zone-groupings.json` load (not yet wired to the chart), and (2)
`useGspAggregateData`'s `gspIds: number[]` parameter and its `rollUpRegionSeries(series, gspIds,
bridge, groupName)` call rewritten to region names with no bridge — both inside
`use-gsp-region-data.ts`, which this track does not own. Instead I disabled the grouped
(DNO/zone/national) selection path in my owned file — `{ gspIds: null, groupName: null }` — with
a comment naming exactly what's missing and why, tagged `TODO(phase5-track-d)`. This is not a new
regression: the path returned nothing useful before either, for the case-mismatch reason above.
**Track D (or whoever owns `use-gsp-region-data.ts`) needs to finish wiring `groupRegionNames`
through that hook and this call site before the DNO/zone/national chart selection works again.**

## Assumptions — flagging for Brad

1. **`color-guide-bar.tsx`'s GSP-vs-group band split stays name-based (`"gsp"`), not
   `!derived`.** The bands are GB-calibrated magnitudes (single GSP maxes ~450 MW, a DNO/zone
   grouping maxes ~4.5 GW). Generalising to `!currentLevel?.derived` would make NL's `province`
   level (non-derived) start rendering the GSP-scale legend instead of nothing, which is a new
   visible behaviour for NL I did not think it was my call to introduce.
2. **`measuringUnit.tsx` keeps exactly two live buttons (finest non-derived + `dno` by name),
   commented placeholders for the rest.** I did not turn this into a generic "one button per
   level" control. That would be a real UX change (and would need a design decision for what a
   button list looks like when a country has 4+ levels), not a mechanical enum removal.
3. **`ChartLegend.tsx`'s N-hour-unavailable warning stays gated on the literal `"dno"`**, not
   `derived`, because its copy explicitly says "DNO-level data" / "GSP-level aggregation" — it
   would be wrong copy for NL's `zone`-equivalent (which doesn't exist) or for a hypothetical
   other country's derived level.

## Verification

The tree was actively being edited by other tracks throughout this session (`data.ts`,
`use-map-region-values.ts`, `lib/geo/assets.ts`, `hooks/data/use-map-geometry.ts` all changed
under me — none were touched at session start per the initial `git status`). At the point I
finished:

- `npx tsc --noEmit`: every remaining error is in a file this track does not own
  (`components/charts/gsp-pv-remix-chart/use-gsp-region-data.ts`,
  `components/helpers/data.reconciliation.test.ts`, `components/map/deltaMap.tsx`,
  `components/map/map-value-join.test.ts`, `components/map/use-map-region-values.test.tsx`) —
  confirmed by grepping the error output against this track's six owned files, which produced no
  matches.
- `npx jest` on the three suites this track's seam usage actually touches
  (`aggregationLevels.test.ts`, `countryState.test.ts`, `use-aggregation-levels.test.tsx`):
  44/44 passing. A full-suite `npx jest` run currently fails to compile 7 suites, all downstream
  of the in-flight `data.ts`/`use-map-region-values.ts` work described above, none owned by this
  track.

This track's own files type-check cleanly in isolation; the remaining red is integration surface
between tracks landing concurrently, not something introduced here.

Final grep across owned files (no `NationalAggregation` left except variable names):

```
components/map/measuringUnit.tsx:  setNationalAggregation  (var name only)
pages/index.tsx:                   nationalAggregationLevel/setNationalAggregationLevel (var names only)
```
