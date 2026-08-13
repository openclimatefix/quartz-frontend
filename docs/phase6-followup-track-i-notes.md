# Phase 6 followup, Track I — one map control panel

Brad asked twice: "can we consolidate the map controls all into the top right?", then the
correction — "when I said consolidate map controls, I meant into one panel (if we're doing a
panel)". Track G got both control groups into the same corner but stacked as two separate
floating things, because `map.tsx` was under concurrent investigation and off-limits to it.
This track had `map.tsx` free and finishes the merge: **one bordered panel**, not two.

## What the panel is

`components/shell/map-encoding-controls.tsx` is now the whole thing. Top to bottom:

- **"Colour by"** — the comparison-preset segmented control (unchanged).
- **`UnitToggle`** — the %/MW/Capacity buttons, split out of `measuringUnit.tsx`.
- **`ColorGuideBar`** — the legend (unchanged).
- **"More map settings"** — a disclosure row (chevron, `MdKeyboardArrowDown`). Closed by
  default. Opens to reveal:
  - **`AggregationLevelToggle`** — the GSP/DNO buttons, the other half of the old
    `measuringUnit.tsx`.
  - **`MapLayerControls`** — new file, `components/map/map-layer-controls.tsx`: the Clouds/PV
    buttons and the satellite channel/composite select, moved out of `map.tsx` verbatim (same
    markup, classes and behaviour, just relocated). Shown only when `comparison === null`
    (forecast map), mirroring `map.tsx`'s old `title === MAP_TITLE_FORECAST` gate — this panel
    is now the one place that knows which map is mounted.

## How I grouped it, and why

Four different questions live in this corner (which basemap layer, what the colour encodes,
what unit, what grouping) plus the legend that explains the current encoding. §6a already
flagged the corner as near its limit with three controls before this track added a fourth
(the layer controls), so a flat stack was not an option — I split into two tiers by how often
each answer changes and how tightly it's coupled to what's *always on screen*:

- **Always visible**: Colour-by, unit, legend. These are one conversation — pick the encoding,
  pick the unit it's shown in, read what the current colours mean. The unit toggle stays out of
  the collapsible tier specifically because it changes the numbers the always-visible legend
  shows; hiding it behind the same disclosure as the rest would hide the reason those numbers
  just changed.
- **Behind "more map settings"**: aggregation level (GSP/DNO) and the layer toggles. Both are
  closer to *how the map is drawn* than *what the colour means* — the same "what vs how" split
  contract §6 draws between navigation and the display rail, applied one level down inside a
  cluster §5 keeps off the rail entirely. They also change less often than the encoding above
  them, so collapsing them keeps the always-visible footprint close to what it was before this
  track added a second control group to the corner.

**Rejected: putting the aggregation/layer controls on the display rail instead of behind a
disclosure here.** That would satisfy §6's letter but not what Brad actually asked for — "into
one panel" — and it would split one coherent "what/how the map draws" story across two
different pieces of chrome for no real gain: the rail is about the chart's series and
confidence bands, not the map's basemap.

**Rejected: a popover instead of an in-panel disclosure.** A popover would keep the
always-visible footprint even smaller, but it also hides the *legend*'s neighbours further away
from it (aggregation level changes what the MW/capacity bands mean) and adds a second floating
surface to manage z-index and outside-click dismissal for, in a shell whose whole positioning
model (`dashboard-shell.tsx`'s "chrome inset") is built around not needing that. An in-panel
disclosure is simpler and keeps everything inside the one bordered box Brad asked for.

**Rejected: shrinking padding/font size to fit everything in the old ~230px budget.** Same
reasoning Track G already rejected it for the legend — it holds today's content and breaks the
moment anything grows, and Brad explicitly didn't want pixel-shaving as the fix last time.

## The mechanical move

- `components/map/map.tsx` no longer renders the Clouds/PV row or the channel select. The
  satellite fetch/decode pipeline (the big effect block, the TIF cache, `applyForTimestamp`)
  stays here — it needs the live Mapbox instance, which a panel mounted elsewhere has no
  business holding.
- `showCloudLayer`, `activeChannel`, `showPvLayer` were already global state (for exactly this
  cross-component-visibility reason). `map.tsx` now reads them without their setters — the
  setters moved to `map-layer-controls.tsx`, the only place that still writes them.
- Two new global-state fields, `isSatelliteLoading` and `satelliteError`
  (`components/helpers/globalState.tsx`), replace what used to be local `useState` inside
  `map.tsx`. `map.tsx` still writes both (it's driving the fetch); `map-layer-controls.tsx`
  reads them to show the spinner and the disabled/error state on the select — the same UI as
  before, just readable from outside the component that used to own it alone.
- `components/map/measuringUnit.tsx` split `MeasuringUnit` into two named exports,
  `UnitToggle` and `AggregationLevelToggle`, sharing the same `MapUIButton` helper. The default
  `MeasuringUnit` export still renders both together, unchanged, for anything that wants the
  old combined behaviour — nothing does any more (only `map-encoding-controls.tsx` imported it,
  and now imports the two pieces separately), but there was no reason to delete a working,
  harmless fallback.

## Footprint constants — what changed and what depends on them

`components/shell/geometry.ts`:

- **`MAP_TOP_ROW_RESERVE_PX` is deleted.** It existed only to reserve space for the Clouds/PV
  row `map.tsx` used to render above the dock without this file reading `map.tsx`'s actual
  height. That row doesn't exist any more — everything is one panel — so the guess is gone,
  not just re-tuned. `map-control-dock.tsx` now anchors `top: STAGE_GUTTER_PX`, the same
  gutter it already used for `right`.
- **`MAP_CONTROL_HEIGHT_RESERVE_PX` changed from 230 to 350.** The old number covered
  Colour-by + unit + legend at their tallest. The new number has to cover the panel's
  *expanded* state — aggregation toggle and the layer controls (including the channel select)
  visible too — because the chart must not overlap the panel in whichever state the user
  leaves it: someone who opens "more settings" and then expands the chart must still see their
  open settings, not have the chart grow up over them. This is a judgement call in the same
  spirit as the numbers it replaces — nothing in the build verifies it, only looking does.
- **`CHART_TOP_CLEARANCE_PX` simplified** to `MAP_CONTROL_HEIGHT_RESERVE_PX + STAGE_GUTTER_PX`
  — one term instead of two, since there's only one thing in the corner to clear now.
  `floating-chart.tsx` itself is otherwise unchanged; its `maxHeight` still reads this
  constant, so the height cap follows the new panel automatically.

Nothing else reads these constants outside `geometry.ts`, `map-control-dock.tsx` and
`floating-chart.tsx` (checked with a repo-wide grep).

## Rail and narrow-viewport check

- The panel is mounted inside `dashboard-shell.tsx`'s chrome inset (`<MapControlDock>` next to
  `<FloatingChart>`, both inside the div whose `right` shrinks by `RAIL_WIDTH_PX` when the rail
  is open) — unchanged structurally, so "never collide with the rail" is still a property of
  where it's mounted, not something this track had to re-derive. Rail open or closed, the
  panel's `right: STAGE_GUTTER_PX` is relative to that inset, so it moves with the inset's edge
  exactly as it did before this track.
- Narrow viewport (`FloatingChart`'s `NARROW_QUERY`, `<1024px`): the chart goes full-width and
  bottom-anchored; the panel is unaffected by that query (it never was) and stays top-right at
  its fixed `MAP_CONTROL_WIDTH_PX` (260px). The height cap (`CHART_TOP_CLEARANCE_PX`) is what
  keeps them from overlapping vertically on a narrow, tall viewport — unchanged mechanism, just
  a bigger number now that the panel can be taller when expanded. This is the same collision
  guard Track G relied on; I did not change the narrow-viewport logic itself.

## Files

Owned and changed: `components/map/map.tsx` (layer JSX removed, satellite status lifted to
global state), `components/map/measuringUnit.tsx` (split into `UnitToggle` +
`AggregationLevelToggle`, default export kept as a thin wrapper), `components/shell/geometry.ts`
(`MAP_TOP_ROW_RESERVE_PX` deleted, `MAP_CONTROL_HEIGHT_RESERVE_PX` retuned,
`CHART_TOP_CLEARANCE_PX` simplified), `components/shell/map-control-dock.tsx` (top offset,
doc comment), `components/shell/map-encoding-controls.tsx` (rebuilt with the disclosure),
`components/shell/floating-chart.tsx` (doc comment only, no logic change).

New: `components/map/map-layer-controls.tsx`.

Touched outside the explicit ownership list: `components/helpers/globalState.tsx`, to add
`isSatelliteLoading`/`satelliteError`. Not in the FILES YOU OWN list, but also not in DO NOT
EDIT, and additive-only (two new fields with defaults matching the old local-state defaults) —
flagging rather than silently doing it, since it's a shared file the coordinator or another
track could also be touching.

Untouched, confirmed in scope: `components/map/color-guide-bar.tsx` (read, no change needed —
its positioning comment about living in the map control dock is still accurate, since it still
does), `pvLatestMap.tsx`, `deltaMap.tsx` (both read-only, `controlOverlay={() => null}` is
unchanged and untouched), `components/shell/display-panel.tsx` (not touched — the rail's
contents are out of scope for this track).

## Intentional test changes

None. No test file references `MeasuringUnit`'s internals, `map-encoding-controls`,
`map-control-dock`, `map-layer-controls`, or the specific `showCloudLayer`/`activeChannel`/
`showPvLayer`/`satelliteError`/`isSatelliteLoading` global-state shape by name (checked with a
repo-wide grep before and after). The full suite is unchanged at 1085/45.

## Verification

From `apps/nowcasting-app`:

- `yarn tsc --noEmit` — clean bar the known pre-existing `jest.globalSetup.ts(14,1) TS1208`.
  (A second, unrelated error set in `use-gsp-region-data.ts` was present in the tree before I
  started — the coordinator's own concurrent, in-progress work in files I don't own — and was
  gone by the time I re-ran tsc after finishing; not mine to report on further.)
- `npx next lint` — **16 warnings, 0 errors**, the baseline exactly. None of the 16 are in
  files this track touched or created.
- `npx jest` — **1085 passed, 45 suites**, matching the baseline exactly.
- `npx next build` — **compiles successfully**, static pages generate, no errors. (The usual
  Sentry instrumentation-hook and Browserslist notices are pre-existing noise, not failures.)

## What Brad should check by eye

- **The panel, collapsed (default state).** Top-right, one bordered box: "Colour by", the unit
  buttons, the legend, then a "More map settings" row with a chevron. Confirm it reads as one
  panel, not several floating things.
- **Open "More map settings"** on the forecast map: aggregation level (GSP/DNO) and the
  Clouds/PV buttons appear inside the same box, below the disclosure row. Turn Clouds on and
  confirm the channel select appears and the spinner shows while a frame loads — this exercises
  the `isSatelliteLoading`/`satelliteError` move to global state, the riskiest mechanical change
  in this track.
- **Open "More map settings" on the delta (comparison) map**: aggregation level shows, but no
  Clouds/PV row — that's the `comparison === null` gate working, not a bug.
- **Expand the chart** with "more map settings" open. The chart should stop short of the panel
  in both its collapsed and expanded states, not just the collapsed one — this is
  `MAP_CONTROL_HEIGHT_RESERVE_PX` (350px) being sized to the panel's tallest state on purpose.
  If it looks like too much reserved space when the panel is collapsed, that's the tradeoff
  named above, worth a second opinion.
- **Narrow viewport** (below ~1024px width, e.g. resize the window or a tablet): panel still
  top-right, chart goes full-width bottom-anchored, and the two should not overlap even with
  the panel expanded.
- **Display rail open and closed**: the panel's right edge should track the rail's left edge
  exactly as before — open the rail and confirm the panel doesn't get clipped or hidden behind
  it.
