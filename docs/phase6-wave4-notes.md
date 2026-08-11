# Phase 6, Track/Wave 4 — cleanup

Wave 4, last of Phase 6's build plan. Deletes what the structure Waves 1-3 built made dead:
the `VIEWS` enum's dashboard entries, `use-map-chrome`'s remaining effect, `SideLayout`'s
vestigial widths (already gone), and the two duplicate controls Track D flagged.

## 1. `view` / `VIEWS`

Gone. `constant.ts` no longer exports `VIEWS` or `getViewTitle`; `globalState.tsx` no longer
has a `view` field.

**What replaced it, and why two things rather than one.** `view` was folding together two
unrelated facts — "is a comparison active" and "are we on the sites route" — because the old
three-tab dashboard needed one enum to pick between FORECAST/DELTA/SOLAR_SITES. Both facts
already existed as their own state once Track D landed (`comparison`, and the route itself),
so `view` had nothing left to be authoritative about:

- **FORECAST vs. DELTA** is `comparison !== null`. `pages/index.tsx` already mounts exactly
  one of `PvRemixChart`/`DeltaViewChart` on `comparison` (Track D), so any consumer that used
  to branch on `view === VIEWS.FORECAST` inside one of those two components was checking
  something already guaranteed true by which component it was — the guard was dropped, not
  swapped for `comparison`, in `pv-remix-chart.tsx`'s and `delta-view-chart.tsx`'s cursor-reset
  effects. Both are one paragraph explaining why in the diff.
- **SOLAR_SITES** is a new boolean, `isSitesChart`, written only by `pages/sites.tsx` on mount
  and cleared on unmount — the exact same write pattern `view` had, just without the two
  members nothing else needed. `remix-line.tsx` (a dozen call sites, all `view ===
  VIEWS.SOLAR_SITES` or its negation — never FORECAST or DELTA), `solar-site-chart.tsx`'s
  mount-edge effect, `StatusBanner`, and `profile-dropdown`'s `canDownloadCsv` all moved onto
  it directly.

**`pages/sites.tsx`'s declaration survives, renamed.** I read what `remix-line`'s axis actually
branches on before touching it: every one of its ~20 `view === VIEWS.SOLAR_SITES` checks picks
between a *time* x-axis (sites, continuous minutes) and a *category* x-axis (dashboard, discrete
formatted-date strings) — ticks, scale, type, domain, interval, the Y-axis label unit (KW vs
MW). None of them ever distinguished FORECAST from DELTA. So the axis needs exactly the fact
`isSitesChart` now carries, and `pages/sites.tsx` still declares it on mount for the same reason
Track D wrote: the sites chart's time axis needs to know it's the sites chart, and nothing else
in the render tree tells it that.

**`map.tsx`'s `title` prop was never really about `view`.** `pvLatestMap`/`deltaMap`/`sitesMap`
each passed a `VIEWS` member as `title`, and `map.tsx` used it for a DOM id suffix
(`#Map-${title}`) and to gate the satellite cloud-layer control to the forecast map only. That's
a map-instance identity, unrelated to comparison or route — reusing `VIEWS` for it was
convenient, not meaningful. Replaced with three plain string constants in
`components/map/types.ts` (`MAP_TITLE_FORECAST`, `MAP_TITLE_DELTA`, `MAP_TITLE_SOLAR_SITES`),
documented as exactly that.

**`presenceMetadataBridge.tsx`** (one I did not find from the notes — it wasn't named in any of
D/E/F's handoffs, but `grep -rn '"view"'` after the rest of the migration turned it up) sends
`view` as free-form telemetry to an external presence feed with a `string`-typed field. Nothing
in this repo reads it back, so I kept the same three string values (`"FORECAST"` / `"DELTA"` /
`"SOLAR SITES"`) computed from `isSitesChart`/`comparison`, rather than changing the wire shape
for a consumer I can't see and can't check.

**`play-button/index.tsx`** (also not named in the notes, also turned up by the same grep) had
`useEffect(() => pause(), [view])` — "pause when tab changes", from when the three dashboard
views were mounted-but-hidden and `PlayButton` stayed mounted across a tab switch. That
condition doesn't exist any more: every owner of `PlayButton` now fully unmounts on the
equivalent transition (`PvRemixChart`/`DeltaViewChart` swap on `comparison`, `/sites` is a real
route). So the dependency array is now `[]` — pause on mount, which is the same edge on every
call site that matters today. Flagged in case there's a call site I haven't found where
`PlayButton` stays mounted across a real state transition; I checked all three render sites
(`forecast-header/index.tsx` — twice, `solar-site-chart.tsx`) and none do.

**`setComparison`** no longer writes a second value — it's `setGlobalState("comparison", id)`
again, not a function synchronizing two keys.

## 2. `use-map-chrome`'s remaining effect

D's prediction held: after Track F's fan-out, exactly one of the three original effects was
still live — the dashboard-mode resize, because it's "the one chrome change that can alter the
map's box without the map hearing about it." I inlined it into `pages/index.tsx` (its only
caller) and deleted `components/hooks/use-map-chrome.tsx`. A one-effect, one-caller hook was
pure indirection once the other two effects went; the inlined version is four lines with the
same comment explaining why it exists.

## 3. `SideLayout`'s vestigial widths

Already fully resolved by Track D — `components/side-layout/*` was deleted outright. I searched
for leftovers (width constants, CSS classes, threaded props) and found none; every remaining
mention of `SideLayout` across the codebase is a comment in `components/shell/*` and
`pages/sites.tsx` explaining what replaced it or what it used to do. Nothing to delete here.

## 4. Two duplicate controls

**The map corner's `ButtonGroup` time print — done, on the dashboard maps only.**
`pvLatestMap.tsx` and `deltaMap.tsx` both rendered a `ButtonGroup` printing
`formatISODateStringHuman(selectedISOTime, ...)` in the map's corner; the shell's
`cursor-readout.tsx` (Track D) says the same fact, better (per-country slots, the grain, DST).
Removed both — `controlOverlay` is now `() => null`, with a comment pointing at the readout —
along with the now-unused `timezone`/`locale`/`formatISODateStringHuman`/`dynamic`/`ButtonGroup`
imports in each file. `deltaMap.tsx`'s loading-state arm printed the same thing; that's also
gone (`<LoadStateMap>{null}</LoadStateMap>`).

**`sitesMap.tsx` keeps its own `ButtonGroup` — deliberately untouched.** `/sites` has no shell,
no cursor readout, nothing else on that route names the selected time. Removing it there would
be a straight regression, not a dedup. I checked this rather than assuming it from the note,
since the note only says "the map corner's `ButtonGroup`" without naming which map.

**The chart legend's series toggles — left alone, as D flagged.** `ChartLegend.tsx` keeps its
own copy of the series on/off toggles alongside the display rail's (`components/shell/
display-panel.tsx`), and D's caveat holds: the legend is also the key to the line colours, so
losing the toggles would mean losing the colour key too. Consolidating them is chart layout
work — deciding what a legend-without-toggles looks like, or a toggle-rail-that-also-shows-
colour — not a trim. Left as is.

## Explicitly out of scope, carried forward

Per the brief, none of these were touched:

- **GB-calibrated MW/capacity thresholds** (`feature-state.ts`'s `MW_THRESHOLDS_GSP`,
  `MW_THRESHOLDS_GROUPED`). NL is still coloured on GB's scale. Needs per-country thresholds in
  the registry — a design decision, not cleanup.
- **Entitlement moving into `setEnabledCountries`.** Waits on the Auth0 country claim shipping
  (`lib/api/auth/entitlement.ts`).
- **Whether `MeasuringUnit` may edit a non-focused country's level.** Same open question Track E
  flagged and declined to decide.
- **The camera framing the enabled set**, and **the constraints overlay being
  focused-country-only.** Both still true; both still design decisions belonging with the shell
  or the registry, per Track F's notes.

## Intentional test changes

**`components/helpers/comparison.test.ts`, rewritten, one fewer test (1039 → 1038).** The five
tests Track D added pinned that `comparison` and the `view` it mirrored could never disagree —
`setComparison("generation")` moves both, clearing returns both, every preset maps to
`VIEWS.DELTA`. `view` no longer exists, so there is no second value left to disagree with; the
tests were asserting a relationship this wave deliberately removed. Rewrote the file to test
what's actually still true — `setComparison` sets `comparison`, `comparisonTitle` names it for
the chart header's echo — and dropped the redundant "every preset maps to the delta view" test
outright rather than inventing a replacement assertion for a fact (`view`) that no longer
exists. The docstring at the top of the file says this is an intentional change and why, so a
future reader doesn't mistake the smaller test count for a coverage loss.

No other test file changed. Nothing else in the suite asserted `VIEWS`, `view`, or
`use-map-chrome`.

## Verification

- `yarn tsc --noEmit`: clean, bar the known pre-existing `jest.globalSetup.ts(14,1) TS1208`.
- `npx next lint`: **16 warnings, 0 errors** — down from the 17-warning baseline. The drop is
  real: `play-button/index.tsx`'s `useEffect(() => pause(), [view])` was contributing an
  `exhaustive-deps` warning the old code left unsuppressed; the rewritten version's `eslint-
  disable-next-line` (matching the same one-line justification the effect already had in
  comments) removes it. No warnings appear in any other touched file.
- `npx jest`: **1038 passed / 42 suites** — down from the 1039/42 baseline by exactly the one
  `comparison.test.ts` test removed above. No other movement.
- `npx next build`: exit 0, "Compiled successfully", all four pages generated
  (`/`, `/sites`, plus the static/dynamic auth pages).

## For the live pass

- **The dashboard maps' corner.** Confirm the time is still visible via the cursor readout with
  the `ButtonGroup` gone from both `pvLatestMap` and `deltaMap` — nothing should look like a
  regression, just one fewer (redundant) place naming the time.
- **`/sites`.** Confirm its own `ButtonGroup` still prints the time as before — this route has
  no shell cursor readout, so it's the only place that does.
- **The document title.** `Layout` now computes it from `isSitesChart`/`comparison` instead of
  `VIEWS` — check the browser tab reads "Quartz Solar - PV Forecast" / "- Delta" /
  "- Solar Sites" exactly as before across a comparison toggle and a route change.
- **CSV download modal, on and off a comparison.** The "Delta" column's availability now reads
  `comparisonActive` instead of `view === VIEWS.DELTA` — confirm it's still disabled with no
  comparison active and enabled with one on.
- **Play button, switching between Forecast and a comparison, and navigating to/from `/sites`
  while playing.** The pause-on-mount edge changed from `[view]` to `[]`; confirm starting
  playback and then switching away still stops it (a leftover interval would show up as the
  cursor still advancing on the view you switched to, or a console error from a `setState` after
  unmount).
- **Presence feed** (if there's a viewer for it outside this repo): confirm the `view` field
  still reads `"FORECAST"` / `"DELTA"` / `"SOLAR SITES"` as before — I preserved the old string
  values on the theory an external consumer might match on them, but I can't verify that from
  here.

## Files

Edited: `constant.ts`, `components/helpers/{globalState,comparison}.tsx|ts` (+ `comparison.test.ts`),
`components/charts/remix-line.tsx`, `components/charts/pv-remix-chart.tsx`,
`components/charts/delta-view/delta-view-chart.tsx`,
`components/charts/solar-site-view/solar-site-chart.tsx`,
`components/layout/{layout,StatusBanner}.tsx`,
`components/layout/header/{csvDownloadModal,profile-dropdown}.tsx`,
`components/map/{map,pvLatestMap,deltaMap,sitesMap,types}.ts|tsx`,
`components/play-button/index.tsx`, `components/presence/presenceMetadataBridge.tsx`,
`pages/{index,sites}.tsx`.

Deleted: `components/hooks/use-map-chrome.tsx`.

Not committed, per the brief.
