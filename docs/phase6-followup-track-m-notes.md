# Phase 6 followup, Track M — saying when a country has nothing to draw

## The debugging session this answers

Brad opened the delta map with GB and NL both enabled. NL's provinces were coloured; GB's GSPs
drew their outlines but no fill at all. It took several exchanges and a network-tab inspection
to establish that nothing was broken: GB's per-GSP generation cache was ~7 hours stale, so no
GB region had a computable delta at that cursor instant, and `deltaFillColorExpression`
correctly painted "no delta" as transparent. Scrubbing back two hours made GB appear.

The behaviour was right. What was wrong: **a whole country with no comparable data is visually
identical to the app being broken**, and the only signal was per-region — hover a GSP, read "no
delta yet" in the popup. Nothing said *the whole country* had nothing at this instant, and you
cannot hover your way to that fact.

## The three states, and why not two

The brief asked for three real cases to be told apart, because collapsing any two of them is a
different bug than the one being fixed:

- **`loading`** — still fetching, nothing delivered yet. Must never be reported as "no data": a
  spinner-shaped answer to what is actually a staleness question is worse than saying nothing.
  This state renders nothing in the banner (see "What was rejected" below).
- **`no-forecast`** — the values pipeline resolved and delivered **nothing at all**, over the
  whole fetched window (`MapRegionValues.hasValues` false — not "nothing at this instant",
  nothing anywhere in the ~4-day window the API pre-warms). This is a country-wide gap and
  usually means a request failed for that one country. It is not caught by the existing
  top-level `error && !hasValues` gate in `deltaMap`/`pvLatestMap`, because that gate is OR'd
  across every enabled country by design (§: one country's 503 must not blank a map that is
  drawing another country perfectly well) — which is exactly why a country-level signal was
  missing.
- **`no-data`** — the pipeline delivered values somewhere in the window, but no region has the
  fact this map cares about **at the cursor's instant**. This is the GB-cache case verbatim:
  normal, common near the publishing edge (the recent past or the future), not an error.
- **`ok`** — at least one region has the fact at the cursor. The banner says nothing.

`loading` and `ok` both render nothing; only `no-forecast` and `no-data` speak up, and they say
different things (see the banner copy below) because "a request is failing for this country"
and "this instant just hasn't published yet" call for different reactions from Brad.

The whole decision is one pure function, `decideCountryCoverage`, in
`components/map/country-coverage.ts` — a real oracle, so it has a real test rather than a
characterisation pin.

## Where the data already was, and what had to be added

`components/map/use-enabled-country-map-data.tsx` already ran one `useMapRegionValues` per
enabled country and collected a per-country `CountryStatus` (`hasValues`, `isLoading`, `error`,
`nationalCapacityMw`) — but only the merged, OR'd-together version left the hook. The per-country
breakdown existed transiently inside `CountryMapLayer` and was thrown away the moment it reached
the parent's `status` memo.

Two things were missing and both are additions rather than restructuring:

1. **A per-cursor fact, per country.** `MapFeatureState.dataState`/`hasDelta` (the vocabulary
   `buildRegionValues` in `components/helpers/data.ts` already decides) were available inside
   each `CountryMapLayer` as `values.featureStates`, but nothing summarised them into "does any
   region have this fact right now". Added `computeCountryCoverage` (`country-coverage.ts`),
   called once per country in `CountryMapLayer` off the **un-namespaced** states — the
   `GB:`/`NL:` prefix `country-features.ts` adds is a map-layer concern with no bearing on
   `dataState`/`hasDelta`. It returns `{ anyValueAtCursor, anyDeltaAtCursor }` — both facts, in
   one scan, because the forecast map needs the first and the delta map needs the second, and a
   single country component should not run the scan twice.
2. **A place for the per-country breakdown to survive the merge.** `CountryStatus` gained a
   `coverage: CountryCoverage` field, and `EnabledCountryMapData` gained `countryStatus: Record<string, CountryStatus>` — the same per-country array the merged `status` memo already builds
   internally, now also returned keyed by code rather than discarded. `capacityByCountry` was
   already doing exactly this shape of thing for a different fact, so this follows an existing
   pattern rather than inventing one.

Nothing about what the map draws or how deltas are computed changed. `buildRegionValues` and
`buildMapFeatureStates` in `components/helpers/data.ts` are untouched — the coverage vocabulary
was already right, this only reads more of it.

## Where the indicator lives

A new presentational component, `components/map/country-coverage-banner.tsx`, rendered inside
the `controlOverlay` slot both `deltaMap.tsx` and `pvLatestMap.tsx` already reserve (top-left
corner of the map, `pointer-events-auto` inside a `pointer-events-none` wrapper) and have passed
`() => null` to since Wave 4 — that slot used to hold each map's own time readout, retired when
the shell's cursor readout took over saying the time once for both panes. Reusing it rather than
adding a second absolutely-positioned layer:

- **Doesn't cover the map or compete with the control panel** — it's a small stack of pills in a
  corner that already exists for exactly this kind of "say something about this map instance"
  content, and it is empty (renders `null`) whenever every enabled country is `ok`.
- **Doesn't shout.** No colour coding, no icon, no border — a `bg-mapbox-black-700/80` pill with
  small uppercase text, the same visual register as the existing "no data" legend pill in
  `color-guide-bar.tsx` (read, not fought with — `color-guide-bar.tsx` is Track E's and was not
  touched). Given the brief's framing — this is the *common* state near the publishing edge, not
  an error state — it reads as informational chrome, not a warning.
- **Scales past two countries for free.** The banner iterates
  `Object.entries(countryStatus)`, which is already keyed by whatever `useEnabledCountries()`
  returns — no country name is hardcoded anywhere in this track's files. Germany showing up in
  `config/countries.ts` means a third pill can appear, nothing else changes.

Each map passes its own `metric`: `deltaMap` passes `"delta"` (reads `anyDeltaAtCursor`),
`pvLatestMap` passes `"value"` (reads `anyValueAtCursor`). This is the one piece of "which fact
matters" that is genuinely per-map rather than per-country, and it is a one-word prop, not a
branch on country identity.

Copy:

- `no-forecast` → `"GB · no forecast data"`, title `"GB: nothing has arrived for the whole
  fetched window, not just this instant."`
- `no-data` → `"GB · nothing published yet"`, title `"GB: no region has data for this moment
  yet. Try scrubbing further back."`

## What was rejected

- **A modal or full-width banner.** Explicitly ruled out by the brief — this is a normal state
  that appears often (any time the cursor is in the recent past or the future), so anything that
  takes over the screen would be wrong far more often than it would be right.
- **Reporting `loading` in the banner.** Considered a "fetching…" pill for symmetry with
  `no-forecast`/`no-data`, and rejected: the map already has a global spinner
  (`LoadStateMap`/`showSpinner` in `pvLatestMap.tsx`) gated on the merged `isLoading`, and a
  second, per-country "still loading" pill would either duplicate that or flicker distractingly
  during the normal one-country-arrives-before-another window on first load. Silence is the
  right answer for `loading` — it is the state the brief was most explicit about not
  mislabelling, and the safest way not to mislabel it is not to speak about it at all.
- **Putting this in `color-guide-bar.tsx`.** That file is explicitly out of scope (owned by
  Track E) and already carries a documented, deliberate decision not to grow a per-country row
  (see its own doc comment on "the multi-country legend question") for a different but related
  reason — variable-length hook fan-out for a legend is a lot of machinery. This track's fan-out
  already exists (`use-enabled-country-map-data.tsx`), so reusing its output rather than
  reopening that file's decision was both correct and the only option available under the file
  ownership.
- **Extending `MapFeatureState` or the coverage vocabulary in `helpers/data.ts`.** Not needed —
  `dataState` and `hasDelta` already say everything a country-level summary needs; this is
  purely a presentation and aggregation change, confirmed before writing any code.

## Files

New: `components/map/country-coverage.ts` (pure decision + the per-country scan, both tested),
`components/map/country-coverage.test.ts` (10 tests), `components/map/country-coverage-banner.tsx`
(presentational, untested — it is a `.map()` over already-tested data with no branching logic of
its own beyond the sort).

Edited: `components/map/use-enabled-country-map-data.tsx` (`CountryStatus` gained `coverage`,
`EnabledCountryMapData` gained `countryStatus`, `CountryMapLayer` computes it),
`components/map/deltaMap.tsx` and `components/map/pvLatestMap.tsx` (read `countryStatus`, wire
`CountryCoverageBanner` into the existing `controlOverlay` slot).

`components/helpers/data.ts` — **not touched**. The coverage vocabulary did not need extending.

## Tests

`components/map/country-coverage.test.ts`, 10 tests:

- `decideCountryCoverage`: loading (with the cursor fact irrelevant while loading), no-longer-
  loading once anything has arrived (mid-refetch is not "loading"), no-forecast, no-data, ok.
- `computeCountryCoverage`: all-unpublished, all-no-data, one-region-published-with-delta, the
  independence of the two facts (a future slot: `dataState: "value"` with `hasDelta: false`),
  and the empty-region-set edge case.

## Verification

Run from `apps/nowcasting-app`:

- `yarn tsc --noEmit` — clean, bar the known pre-existing `jest.globalSetup.ts(14,1) TS1208`.
- `npx next lint` — **16 warnings, 0 errors**, baseline exactly; nothing reported against any
  file this track touched.
- `npx jest` — **1147 passed / 51 suites**, all green. (Two suites and roughly a dozen tests
  above the 1132/49 baseline stated in the brief belong to `components/helpers/comparison.test.ts`,
  a pre-existing untracked file from another track that was present but not yet counted; this
  track's own addition is `country-coverage.test.ts`'s 10 tests / 1 suite.)
- `npx next build` — compiles successfully (`✓ Compiled successfully`, same lint output as
  above). The build step subsequently fails on `pages/auth/denied`, `pages/404`, `pages/logout`,
  `pages/expired` lacking a valid default export — this is unrelated to this track (`pages/*` is
  explicitly out of scope and was never touched here) and was already present in the working
  tree from concurrent work before this track started; flagging it here rather than silently
  working around it, per the "no country branching" / "stop and report" norms for anything
  outside owned files.

## What Brad should check by eye

- **The exact case that prompted this: scrub to a recent slot with GB and NL both enabled in the
  comparison (delta) view.** GB should show a quiet `GB · nothing published yet` pill in the
  top-left corner of the delta map while its cache is behind; scrubbing back to where GB's
  generation has actually landed should make the pill disappear with no other visual change.
- **The same scrub on the forecast map (`pvLatestMap`)** — scrub into the future far enough that
  a country's forecast horizon is exhausted (GB ~36h, NL ~48h) and confirm the `· nothing
  published yet` pill appears there too, using the forecast fact rather than the delta fact.
- **First load, briefly.** With a slow network, confirm nothing appears in the banner while a
  country is still loading — no flicker of a "no data" pill in the gap before its first response
  lands.
- **A genuinely broken country.** Hard to force by hand, but if a country's `/forecasts/period`
  or `/generation/period` 503s while another enabled country is fine, that country should show
  `· no forecast data` rather than either blanking the whole map or saying nothing at all.
- **Two countries in different bad states at once**, if reachable — confirm both pills show,
  sorted by code, and that the row wraps sensibly rather than overflowing the corner.
- **Toggling a country off** should remove its pill immediately along with its polygons — this
  falls out of `countryStatus` being keyed by `useEnabledCountries()`, but worth a look since
  `onUnmount` is the one path that could plausibly leave a stale entry behind.
