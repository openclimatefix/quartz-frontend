# Phase 6 followup, Track G — three things from the live pass

Not a wave. Brad's live pass on `epic/adaptive-eu-ui` produced three explicit requests, all
implemented here: the clipped map legend, the duplicate chart legend, and the chart feeling
cramped when a region is selected. Track H is concurrently touching `cursor-readout.tsx` and
new files beside it for the footer scrubber — untouched here, and its in-progress state is why
`next build` fails in this tree right now (see Verification).

**Item 1 changed scope mid-flight.** Brad's original ask was framed as a clipping bug in the
bottom-right dock; partway through, the coordinator relayed that he actually wants all map
controls — the encoding cluster and the map's own Clouds/PV layer toggles — consolidated into
the **top right**, which subsumes the clipping fix. What follows is the result of that
correction, not the original bottom-right patch (which was built, then superseded before being
reported — no trace of it below).

## 1. The map controls move to top-right (subsumes the legend clipping)

### What moved, and what didn't

`map-control-dock.tsx` (the encoding cluster — "Colour by", the unit toggle, `ColorGuideBar`)
now sits **top-right**, anchored below the map's own Clouds/PV layer-toggle row (`map.tsx`,
rendered top-right via `justify-end`, forecast map only — the delta map has no such row).
That's a genuine reposition, entirely inside files this track owns.

**What it is not: one merged row.** True consolidation — the "Colour by" control sitting in the
same row as the Clouds/PV buttons, or interleaved with them — means moving JSX out of
`map.tsx`, which this track does not own, and which was under live, concurrent investigation
for an unrelated delta-map bug at the time (the coordinator's own words: "I do not want us both
in there"). Per the coordinator's explicit instruction, I did not touch `map.tsx`,
`pvLatestMap.tsx`, or `deltaMap.tsx`. The result is both control groups in the *same corner*,
stacked — the cluster starts below the Clouds/PV row rather than sharing a line with it. That is
a real improvement (one corner for "what does the map show" instead of two opposite ones) but
it is not the single interleaved row Brad's ask implies at its best. **Flagging for a fast
follow once `map.tsx` is free** — see "For the coordinator" at the end.

### The mechanics

New constants in `geometry.ts`:

- `MAP_TOP_ROW_RESERVE_PX` (64) — vertical space the dock's `top` offset clears before the
  Clouds/PV row, without this file reading `map.tsx`'s actual layout. Sized to that row's
  rendered height (`p-4` container, `mt-3` above the row, one line of buttons/select ~28-32px)
  with margin, since I cannot guarantee that file's exact height and should not need to.
- `MAP_CONTROL_HEIGHT_RESERVE_PX` (230) — the encoding cluster's own typical maximum height (the
  "Colour by" toggle, unit control, and the colour guide at its tallest: "GB bands" row present,
  bands wrapped to two lines). A judgement call in the same spirit as the old fixed
  `MAP_CONTROL_WIDTH_PX` was for the width cap it used to feed.
- `CHART_TOP_CLEARANCE_PX` — the sum of the two above plus a gutter, which the floating chart
  now uses as a **height** cap (`floating-chart.tsx`) instead of the old **width** cap. Before,
  cluster and chart shared a bottom edge, so only widths could collide; now they share the right
  side, so a tall chart could grow up under the cluster instead of a wide one growing right into
  it — the coupling moved axis rather than disappearing.

**Both of the new numbers are judgement calls that a green build cannot verify** — the same
category `CHART_SPLIT`'s numbers are in, but with an added risk this track cannot fully retire:
`MAP_TOP_ROW_RESERVE_PX` is guessing at another file's rendered height rather than measuring its
own. If it's off, the symptom is either a visible gap (reserve too generous) or the dock
overlapping the Clouds/PV row (too tight) — worth Brad's eye specifically, more than the other
numbers in this doc.

### The legend clipping itself

Moving corners did not change the dock's width — still `MAP_CONTROL_WIDTH_PX` (260px) — so it
did not, by itself, fix the clipping (per the coordinator's steer: *if* the new arrangement's
width comfortably fit six bands on one row, that would BE the fix; it doesn't, so it isn't).
The underlying fix from the original bottom-right pass carries over unchanged:

`ColorGuideBar`'s `SequentialBands` laid six bands plus a "no data" pill out in one
`flex justify-between` row, in an `overflow-x-auto` wrapper. Seven items at `px-3` plus text do
not fit 260px, so the last two scrolled out of view — worse with Track E's "GB bands"
attribution line, which added a label row above (not width) but made an already-tight corner
(§6a: "near its limit") feel tighter.

**Fix: wrap, don't scroll or shrink.** `overflow-x-auto` is gone from `ColorGuideBar`'s outer
div, and both `SequentialBands` and `DeltaBands` now lay their pills out with `flex flex-wrap
gap-1` instead of `flex justify-between`. Considered and rejected:

- **Widen the dock further.** Now less costly than before it moved (nothing else is anchored to
  its old bottom-right width in the way the chart used to be), but still a wider fix than the
  problem needs, and a legend that only sometimes has a wide row should not permanently claim
  more screen.
- **Shave padding/font size to force one row.** Explicitly what Brad asked not to do — it holds
  today's six bands and breaks again the moment the count grows (the delta encoding already has
  nine buckets, not six) or a country's numbers get longer digits.
- **A more compact band representation** (e.g. a single gradient strip with tick labels instead
  of discrete pills). Real option, but a bigger visual redesign of the legend than the ask
  called for, and the pill shape is shared with the delta encoding's semantics (the border marks
  a real numeric boundary). Wrapping keeps the existing visual language.

Wrapping needed one more change to hold up: the pills were chained with `border-l` on every item
but the first, which reads correctly in one row and wrong once a row breaks (a pill at the start
of row two would carry no left border, and a pill that wrapped would show a stray one against
its new neighbour). Every pill now carries its own `rounded border` on all four sides instead —
self-contained, so it looks right in whichever row it lands on. Applied to both
`SequentialBands` (6 bands + no-data) and `DeltaBands` (9 buckets), so the fix holds for both
encodings and whatever count either has.

Checked: present with "GB bands" row and without (single vs. multiple enabled countries), in
the sequential encoding (6+1) and the delta encoding (9). All wrap cleanly inside 260px with
nothing scrolled or cut off, now rendered top-right.

## 2. The duplicate chart legend

`ChartLegend`/`LegendItem`, mounted bottom-left inside `pv-remix-chart.tsx` and
`delta-view-chart.tsx`, duplicated the display rail's `SeriesToggles`
(`components/shell/display-panel.tsx`) — both built off the same two config sources
(`nationalChartSeries`, `useGenerationSources`).

**Track D and Wave 4 were right to leave it**, for the reason stated: the chart legend was also
the colour key, and the rail's toggles were not. Checking before removing anything: they
already had been made to carry it. `SeriesToggles`, when it was built, rendered its rows through
the very same `LegendItem` component the chart legend uses — same `iconClasses` swatch, same
toggle behaviour over the same `visibleLines` state — and its own doc comment already said so:
*"The legend keeps its own copy of these toggles for now — it is also the key to the colours, so
it cannot simply lose them, and consolidating the two is chart work rather than shell work."*
That consolidation is what this item is. There was no swatch to add — the rail already had one,
built in anticipation of exactly this move — so the work was:

- Remove the `<ChartLegend />` mounts from `pv-remix-chart.tsx` and `delta-view-chart.tsx` (the
  two dashboard chart surfaces).
- Delete `components/charts/ChartLegend.tsx` — once both mounts are gone it has zero remaining
  references anywhere in the app, so keeping it around would be dead code with no caller, not a
  narrower role.
- Rewrite `SeriesToggles`'s doc comment in `display-panel.tsx` to say the consolidation happened,
  rather than that it was still owed.

**`/sites` is untouched**, per the explicit scope limit. `solar-site-view/solar-site-chart.tsx`
never used `ChartLegend` — it has always rendered its own two `LegendItem`s inline (`PV Actual`,
`OCF Forecast`) as part of its bespoke bottom bar, because it has no display rail to hand them
to. That inline usage is unchanged.

One loose end, left alone deliberately: `LegendTooltipContent.tsx` and `components/LegendTooltop.tsx`
existed to give `ChartLegend`'s rows a hover explanation of what feeds each forecast line.
`SeriesToggles` never had that tooltip — its rows are otherwise identical (colour, label,
toggle), but a user glancing at the rail no longer gets "ECMWF, Met Office, Satellite" on hover
for a comparison model. Both files are now unreferenced. Neither is in this track's file
ownership (they're not a chart-legend mount point), so I left them rather than scope-creeping
into a deletion or a tooltip port; worth a Wave-4-style sweep, and worth Brad deciding whether
the tooltip is missed enough to port over.

## 3. The chart grows when a region is selected

`CHART_SPLIT` in `geometry.ts` gained two entries alongside `plain`/`comparing`/`expanded`:

```
selected:           { width: 54, height: 78 }   // was plain 46×62
comparingSelected:  { width: 40, height: 60 }   // was comparing 34×46
```

`floating-chart.tsx` reads `selectedMapRegionIds` directly (`useCountryState`, the same
read-only hook `ChartLegend` used to use, and the one `display-panel.tsx` still uses) rather
than taking it as a prop from `dashboard-shell.tsx` — that file is out of scope for me, and the
component already had a precedent for reading shared state itself instead of being wired
through the shell. `dashboard-shell.tsx` needed no change.

Composition: `expanded` (the explicit user override) wins over everything, unconditionally —
selection state must not second-guess a handle the user pulled themselves. Below that,
comparison and selection are independent booleans, each with its own bump, matching §3's own
framing ("a comparison *and* a selection is a real combination"):

- **Height grows more than width.** Track D's note names the mechanism precisely — selecting a
  region stacks `GspPvRemixChart` under the national chart *inside the same panel*, so the
  scarce dimension is vertical room for two charts, not horizontal room for one. `selected` is
  +8 width / +16 height over `plain`.
- **`comparingSelected` gets a smaller bump than `selected` alone** (+6/+14 over `comparing`,
  vs. +8/+16 over `plain`), rather than summing the two deltas uncapped. Comparison's whole
  reason to shrink the chart is to give the map room for the diverging encoding, and that
  reason does not go away just because a region is also selected — so the combined state stays
  narrower than `selected` alone, while still growing enough that the stacked sub-chart is not
  the cramped case Track D flagged.

Numbers are a starting point in the spirit of §3, explicitly for Brad to judge by eye, not a
formula.

## Files

Owned and changed: `components/shell/geometry.ts`, `floating-chart.tsx`, `map-control-dock.tsx`
(newly granted mid-flight, for the top-right move), `display-panel.tsx` (comment only);
`components/map/color-guide-bar.tsx`; `components/charts/pv-remix-chart.tsx`,
`components/charts/delta-view/delta-view-chart.tsx` (both: remove the `ChartLegend` mount and
its now-unused import).

Deleted: `components/charts/ChartLegend.tsx`.

Untouched, confirmed in scope: `components/charts/LegendItem.tsx` (still the shared building
block — used by `SeriesToggles`, unchanged, and by `solar-site-chart.tsx`, unchanged),
`gsp-pv-remix-chart/index.tsx` (never mounted `ChartLegend`), `solar-site-view/solar-site-chart.tsx`
(unchanged, per scope limit), `map-encoding-controls.tsx` (read, no change needed).

Not mine, not touched, and account for `git status` noise elsewhere in this tree:
`cursor-readout.tsx`, `use-hot-key-control-chart.tsx`, `lib/time/cursor.ts`,
`components/shell/scrub-track.tsx`, `scrub-scale.ts`, `use-cursor-range.ts` — Track H's
in-progress footer scrubber work, concurrent with this session.

## Intentional test changes

`components/charts/pv-remix-chart.test.tsx` — the `describe("the legend follows the same two
lists", ...)` block asserted on legend text (`"PV Live Estimated"`, `"ECMWF-only"`, `"NED NL
Initial"`, etc.) that only existed because `ChartLegend` rendered inside the chart under test.
That behaviour moved to `display-panel.tsx`, which this suite does not render, so the block
could not simply keep passing. Replaced with `describe("the chart no longer carries its own
legend", ...)`: two tests (GB, NL) pinning the *absence* of the old legend text inside the
chart, with a comment pointing at where the equivalent "series list drives the legend" coverage
should live if someone writes it — `display-panel.tsx`/`SeriesToggles` has no dedicated test
today (it didn't before this change either), and building one means largely re-deriving this
suite's MSW harness against a different component, which is more than the three asks called
for. Flagging as a gap rather than closing it silently.

No other test files reference `ChartLegend`, `color-guide-bar`, `floating-chart`, `geometry`, or
`display-panel`, so nothing else needed updating.

## Verification

From `apps/nowcasting-app`:

- `yarn tsc --noEmit` — clean bar the known pre-existing `jest.globalSetup.ts(14,1) TS1208`.
- `npx next lint` — **16 warnings, 0 errors**, the baseline exactly (the 16 are the same
  pre-existing `exhaustive-deps`/`no-anonymous-default-export` set, none of them in files this
  track touched).
- Full Jest suite — passing throughout (1038/42 at the point this track's own diff was frozen;
  the count moved to 1073/44 by the time of the final run because Track H added tests
  concurrently in the same tree — nothing under this track failed at any point).
- `next build` — **not green in this tree right now**, but not because of this track: it fails
  compiling `components/shell/cursor-readout.tsx` ("Unterminated JSX contents") and a Prettier
  rule in `scrub-track.tsx`, both Track H files mid-edit concurrently (`git status` shows them
  modified/untracked, not part of this diff). Nothing under this track's ownership appears in
  that failure. Worth a rebuild once Track H lands.

## For the coordinator

**The top-right consolidation is a reposition, not a merge**, and I want that flagged rather
than left implicit. The encoding cluster (`map-control-dock.tsx`) now sits top-right, stacked
below the map's Clouds/PV toggle row — same corner, two visual groups. Getting to one row (or
otherwise genuinely interleaved) means moving the Clouds/PV button markup out of `map.tsx`,
which per your instruction I have not touched, given the concurrent delta-map investigation
there. If/when that work lands, the remaining step is small: pull the Clouds/PV buttons into
`map-encoding-controls.tsx` (or a shared row above it) and delete `MAP_TOP_ROW_RESERVE_PX`
entirely, since the guess-the-other-file's-height problem it exists to paper over goes away
once both live in files I own. Happy to pick this up once you say the map files are free.

Also worth your eye specifically: `MAP_TOP_ROW_RESERVE_PX` (64px) and
`MAP_CONTROL_HEIGHT_RESERVE_PX` (230px) in `geometry.ts` are both estimates of things outside
this diff's ground truth — one guesses `map.tsx`'s row height without reading it, the other
guesses the cluster's own worst-case height. A green build cannot catch either being off; only
looking at it can.

## For the live pass

- **Top-right corner, forecast map.** The Clouds/PV buttons and the encoding cluster ("Colour
  by" / unit / colour guide) should now both be top-right, stacked, with a visible gap between
  them rather than an overlap. This is the number to eyeball most carefully — `MAP_TOP_ROW_RESERVE_PX`
  is a guess at the buttons' rendered height, not a measurement.
- **Top-right corner, delta map.** No Clouds/PV row here, so the cluster sits with extra
  headroom above it — expected, not a bug, but confirm it doesn't look like an accidental gap.
- **The legend band row.** Enable a second country to get the "GB bands" row, then check the
  band row wraps to a second line rather than clipping, in both the sequential (%, MW, capacity)
  and delta (comparison) encodings — now inside the top-right cluster.
- **A tall/expanded chart with the top-right cluster present.** Expand the chart (or select a
  region while comparing, which also grows it) and confirm it stops short of the cluster's
  bottom edge rather than growing up underneath it — this is `CHART_TOP_CLEARANCE_PX`, the
  other number worth checking by eye.
- **Bottom-left of the chart** should now be empty — no floating legend/toggle cluster there
  any more. Open the display rail (right edge) and confirm each series toggle shows a colour
  swatch matching its line on the chart, and that toggling a row still shows/hides that line.
- **With the rail collapsed**, there is now no colour key visible anywhere on screen — that is
  the direct consequence of the move and worth Brad's explicit sign-off, since it is a real
  behaviour change from "always visible bottom-left" to "visible when the rail is open."
- **Select a region** (GB GSP or NL province) with no comparison active: the chart panel should
  grow, mostly taller, to give the stacked GSP sub-chart room. Clear the selection and it should
  return to the plain size.
- **Select a region while a comparison is active**: smaller growth than the plain-selected case,
  chart still visibly bigger than plain `comparing`.
- **Expand handle still wins**: with a region selected, hit expand — should reach the same
  `expanded` size as with nothing selected, not something added on top.
