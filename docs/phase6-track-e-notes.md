# Phase 6, Track E — the map encoding controls

Wave 3, last track. Everything through Track F was committed before this started; this diff
is the whole of Track E.

## What the merged control is

`color-guide-bar.tsx` and `delta-color-guide-bar.tsx` were two components, unchanged in
content, swapped by a ternary on `comparison` in `map-encoding-controls.tsx`. They are now
**one component, one export, one file** (`components/map/color-guide-bar.tsx`): `ColorGuideBar`
takes `comparison` and `unit`, and switches internally between a `SequentialBands` branch (the
old forecast/percentage/capacity bands, exactly as they were) and a `DeltaBands` branch (the
old delta buckets, exactly as they were). `delta-color-guide-bar.tsx` is deleted; nothing else
imported it.

This makes the "selects the encoding and then explains it" language in contract §5 literal
rather than approximate: the segmented "Colour by" control above sets `comparison`, and the one
`ColorGuideBar` below it reads the same value to decide what to explain. Before this track that
was a control plus two things that happened to sit under it, picked by a ternary one level up;
now it is one component owning both its cases.

I left the "Colour by" segmented control itself as Track D built it — Track D flagged it
provisional and free to redesign, but nothing about the multi-country fan-out or the merge
changes what it needs to do (pick `null` or a preset), and there was no live-judgement problem
with it worth spending the stall budget on. If Brad wants it redesigned on the live pass, that
is a cheap follow-up against a component that is now fully separable from the legend.

## The multi-country legend question

This was the actual design work in this track, per Track F's handoff: `ColorGuideBar` (like
`useCurrentAggregationLevel`, which it calls) explains only the **focused** country's bands,
even when several countries are drawn.

**What I built:** the legend stays single — one row of bands, the sequential branch's existing
layout — but when more than one country is enabled, it is explicitly labelled with the country
it belongs to ("GB bands"), so nobody reads it as a claim about every country on screen. With
only one country enabled, the label is omitted and the legend is pixel-identical to before.

**What I rejected, and why:**

- **A band row per enabled country.** The enabled set is variable-length, and
  `useCurrentAggregationLevel` is a hook — calling it once per enabled country needs the same
  child-component fan-out `use-enabled-country-map-data.tsx` uses for exactly this reason
  (hook rules forbid a variable number of hook calls). That is real machinery for a legend.
- **It would usually show the same thing twice.** The percentage bands (`ActiveUnit.percentage`)
  never read the aggregation level at all — they're `0-10 / 10-20 / … / 70+` regardless of
  country or level. Two countries in percentage mode would render two identical rows. The bands
  only diverge for MW/capacity, and only when the enabled countries sit at different grouping
  tiers (GB on its DNO rollup, bands ×10, while NL is on provinces) — precisely the case
  `feature-state.ts`'s per-feature `grouped` flag exists to handle. Spending a permanent second
  row on a distinction that is usually not a difference, inside a dock already at its §6a
  budget, was the wrong trade.
- **A shared/blended scale.** Rejected outright — GB and NL are on different physical scales
  (GSP vs. province, ×10 apart when grouped), so a single scale spanning both would either
  crush GB's resolution or overflow NL's, and would misrepresent whichever one dominates the
  range. Not attempted.

**What a user with GB and NL both on actually gets:** the same thing they already get for the
headline figure, the level selector and the chart — the focused country's answer, clearly
labelled as such once there's more than one country to confuse it with. Reading the other
country's bands is the same click that already moves everything else: click one of its regions,
focus follows (Track A/F), the legend's label and bands follow with it. No new gesture, no new
surface.

Delta buckets (`DELTA_BUCKET` in `constant.ts`) are a fixed MW scale, not derived from the
aggregation level, so they never had this problem and the label only applies to the sequential
branch.

## Behaviour changes

- `color-guide-bar.tsx` + `delta-color-guide-bar.tsx` → one file, one component, switching on
  `comparison`. `delta-color-guide-bar.tsx` deleted.
- The sequential legend gains a country label ("`{CODE} bands`") when more than one country is
  enabled; unchanged otherwise. No visible change with a single enabled country (the default).
- `map-encoding-controls.tsx` now renders `<ColorGuideBar comparison={comparison} unit={activeUnit} />`
  once, in place of the old `comparison ? <DeltaColorGuideBar /> : <ColorGuideBar unit={activeUnit} />`
  ternary.
- `MeasuringUnit` and `feature-state.ts` are otherwise untouched — Track F's `isGrouped` →
  per-feature `grouped` flag change already covers the case this track needed (per-country
  band thresholds), so nothing further was required there. `MeasuringUnit` still reads the
  focused country's level via `useCurrentAggregationLevel()` with no argument, consistent with
  the legend's own "focused country, labelled when ambiguous" answer — I did not give it the
  optional `country` argument since it edits state (`setNationalAggregation`) and a control
  that changes a non-focused country's level without any way to see that country's map state
  reflect it felt like a worse UX than the status quo, not a design call this track should
  make unasked. Flagging it rather than deciding it: if the multi-country legend answer above
  is wrong, this is the same axis and should be revisited with it.

## Files

Edited: `apps/nowcasting-app/components/map/color-guide-bar.tsx` (rewritten),
`apps/nowcasting-app/components/shell/map-encoding-controls.tsx` (import + one render site).

Deleted: `apps/nowcasting-app/components/map/delta-color-guide-bar.tsx`.

Untouched (read, not edited): `measuringUnit.tsx`, `feature-state.ts`, `comparison.ts`,
`comparison.test.ts`, `map-control-dock.tsx`. Track F's `feature-state.ts` handoff already
solved the per-feature banding problem this track would otherwise have needed to touch it for.

## Intentional test changes

**None.** No test asserted the two-component swap or the `DeltaColorGuideBar` export, so there
was nothing to update. No new tests were added — the change is presentational (one label,
conditionally shown) and the underlying band/bucket logic is byte-for-byte what
`map-value-join.test.ts` and `country-features.test.ts` already pin at the `feature-state.ts`
layer; there is no new behaviour at that layer to test. If Brad wants the label itself pinned,
that's a small addition to `map-encoding-controls`-adjacent tests, deferred here as
presentation rather than logic.

## Verification

- `yarn tsc --noEmit`: clean, bar the known pre-existing `jest.globalSetup.ts(14,1) TS1208`.
- `npx next lint`: **17 warnings, 0 errors** — baseline exactly, none in touched files.
- `npx jest`: **1039 passed / 42 suites** — unchanged from the Track F baseline (no tests
  added or removed).
- `npx next build`: exit 0, "Compiled successfully", all four pages generated.

## For the live pass

- **Single country enabled (default GB).** The legend should look exactly as it did before this
  track — no "GB bands" label, same bands, same layout. This is the case that must not regress.
- **Enable NL, GB focused, unit = %.** Legend still says "GB bands" (once NL is on), and the
  bands themselves are the same six percentage bands NL would also show — confirm they read as
  sensible for NL too, since the copy ("0-10", "70+") was written with GB numbers in mind.
- **Enable NL, put GB on its DNO level, unit = MW.** GB's legend should show the ×10 grouped
  bands ("0-500" … "4.5k+") labelled "GB bands". Click an NL region to focus it — legend should
  switch to NL's province-level bands ("0-50" … "450+"), still labelled, now "NL bands".
  This is the actual case the label exists for; confirm it reads clearly rather than as clutter.
- **Toggle comparison on with NL enabled.** Delta buckets should look identical regardless of
  focus or enabled countries — no label appears on that branch, by design; confirm that reads
  as intentional rather than as a missed case.
- **Whether the "GB bands" wording is the right call.** I chose the country code over the full
  name (`GB` not `Great Britain`) to match how the country is named everywhere else in this
  chrome (chart header chip, cursor readout). Worth a look alongside those.

## Deferred, and why

- **Redesigning the "Colour by" segmented control itself.** Track D flagged it provisional and
  free to redesign; nothing in this track's brief (the legend merge, the multi-country
  question) required touching it, and there's no test or measured problem driving a redesign —
  it's a pure live-judgement call Brad hasn't made yet. Left as Track D built it.
- **`MeasuringUnit` taking the optional `country` argument Track F's hooks now accept.** See
  "Behaviour changes" above — giving the unit/level toggle a way to edit a non-focused
  country's state seemed like a worse default than today's single-country control, but it's
  the same "focused vs. all enabled" axis as the legend question and deserves the same
  deliberate look rather than a decision made in passing here.
- **A fourth control in the cluster.** Not needed — this track added a label inside the
  existing legend, not a new control, so the dock stays at its current depth (segmented
  control, unit + level buttons, legend) and does not trip §6a's popover threshold.
