# Phase 6 followup, Track L — the floating chart becomes resizable

OPEN 5 from `docs/phase6-layout-contract.md`: "Floating chart mechanics. Movable, resizable,
dockable? Persisted per user? ... Not blocking: ship the mode-set default first and add the
override once there is something to override." The mode-set default shipped; this is the
override, and it replaces the expand handle rather than sitting alongside it.

## The state model — seed vs override, per mode

`CHART_SPLIT` in `geometry.ts` used to be *the* answer for a mode's size. It is now only the
**seed**: the size a mode renders the first time it is ever seen. `chartSplitOverrides` — a new
flat key in `globalState.tsx`, `Partial<Record<ChartMode, ChartSplitPercent>>` — holds what the
user has dragged a mode to since. `resolveChartSplit(mode, overrides)` is the whole of the
lookup: `overrides[mode] ?? CHART_SPLIT[mode]`. Once a mode has an entry, the seed is never
consulted for it again — that is the property Brad asked for: mode-based scaling must not keep
moving the panel under the user's hands once they've sized it themselves.

`chartModeFor(comparisonActive, regionSelected)` replaces the ternary ladder that used to live
inline in `floating-chart.tsx`, so mode selection and the override lookup are two testable pure
functions rather than logic folded into a component. Both are pinned in `geometry.test.ts`,
including the case that actually matters for "remembers per mode": size `plain`, size
`comparing` differently, switch back to `plain` — it must come back at `plain`'s stored size,
not `comparing`'s and not the seed.

There used to be a fifth entry in `CHART_SPLIT`, `expanded`, for the old expand-handle override
(50%/90% regardless of mode). It's gone — see "What replaced the expand handle" below.

## What replaced the expand handle

`components/shell/expand-button.tsx` is deleted, along with `isExpanded` state and the
`CHART_SPLIT.expanded` branch in `floating-chart.tsx`. In its place: a resize grip,
`chart-resize-handle.tsx`, sitting in the corner opposite the panel's fixed anchor. The panel is
positioned `left`/`bottom` (`floating-chart.tsx`, unchanged), so the handle sits **top-right** —
dragging it directly manipulates the two edges that actually move, rather than an abstract
"bigger/smaller" toggle.

The drag itself lives in `use-resizable-chart-split.ts`, following `scrub-track.tsx`'s pattern
for the reason it exists there: writing shared state on every `pointermove` re-renders the chart
(Recharts) and the map on every pixel of movement. So a drag runs at two rates. `dragSplit` is
set on pointerdown, updated on every `pointermove` in a render confined to `FloatingChart`, and
dropped on release; the committed value (`chartSplitOverrides`, via `setChartSplitOverride`) is
coalesced to at most one write per animation frame while dragging and written exactly once,
synchronously, on release — the same handoff `endDrag` uses in the scrub track, for the same
reason (a frame must never fire after the pointer is already gone).

Keyboard: the handle is `tabIndex={0}` with arrow keys resizing in 3%-of-container steps and
Enter/Space resetting. It deliberately does **not** use `role="slider"` — ARIA's slider role is
defined for one dimension and this drags two (width and height) independently, so there is no
single `aria-valuenow` to give it truthfully; `aria-label` plus the same keyboard contract a
slider offers is what's there instead. (`next lint`'s `jsx-a11y/role-has-required-aria-props`
would have flagged the dishonest version — that's what caught this, not a design read.)

## Clamping — and the live bug found mid-track

Three limits, in `geometry.ts`'s `clampChartSplit`, applied on every drag frame and on every
steady-state render (a `ResizeObserver` on the panel's `offsetParent`, so a window resize or the
display rail opening reclamps even with no drag in progress):

- **Minimum.** `MIN_CHART_WIDTH_PX` (320) / `MIN_CHART_HEIGHT_PX` (220) — a floor so a drag
  cannot shrink the chart to an unreadable sliver.
- **Maximum width.** The inset's own width minus `STAGE_GUTTER_PX` on both sides. Unconditional
  — width has no reason to ever need the map control dock's column, since the dock is a fixed
  260px-wide box and the chart is capped well short of the full inset regardless.
- **Maximum height — the one that had a live bug in it.** Brad reported that `selected`'s 90%
  height seed didn't render at 90% — screenshot showed the stacked sub-chart present (so the
  mode was right), but the panel visibly stopped short. Cause: the old maxHeight was
  `calc(100% - (MAP_CONTROL_HEIGHT_RESERVE_PX + STAGE_GUTTER_PX))`, applied **regardless of the
  chart's width**, so it capped height even when the chart's right edge never got anywhere near
  the dock. `overlapsControlDock(chartWidthPx, containerWidthPx)` is the fix: it computes the
  chart's rendered right edge and the dock's left edge (both pinned by `STAGE_GUTTER_PX`/
  `MAP_CONTROL_WIDTH_PX`, both already in `geometry.ts`) and the height reserve only applies
  when those two ranges actually intersect. `selected` is 54% width; on any container over
  ~626px wide (i.e. every real desktop) that never reaches the dock's column, so the height
  reserve should never have applied to it at all. `geometry.test.ts` pins this by name — the
  "the bug this fixes" test clamps `CHART_SPLIT.selected` against a normal-width container and
  asserts it comes back **unchanged**.

**On the live-height ask specifically:** I did not wire a measured height from
`map-control-dock.tsx` / `map-encoding-controls.tsx` into the clamp — both are outside this
track's files, and publishing a measurement from either (a ref, a `ResizeObserver`, a shared
value) is an edit to a file I don't own. The overlap fix above turned out to make that mostly
moot for the reported bug: on realistic screen widths the two panes' x-ranges essentially never
intersect at any of the four `CHART_SPLIT` seeds, so the 350px constant — sized for the dock's
*expanded* state — is now reached only in the genuinely-overlapping case (a large drag, or a
narrow viewport), where being conservative is the right default anyway. **Known limitation:** in
that overlapping case the reserve is still the constant, not the dock's real (usually much
shorter, collapsed) height, so a user who drags very wide on a narrow window can be capped a bit
short of where the dock's actual bottom edge is. If this is worth tightening further, the clean
fix is a `ResizeObserver` in `map-control-dock.tsx` writing its measured height to a small piece
of shared state (or a context) that `floating-chart.tsx` reads — a few lines in a file this
track doesn't own, flagging it rather than reaching in.

## The reset affordance

Removing the expand handle removes the only way back to a known state, so: **double-click the
resize handle, or Enter/Space with it focused, clears the current mode's override**
(`setChartSplitOverride(mode, null)`). It clears the entry rather than writing the seed's numbers
back as a stored override — so if `CHART_SPLIT`'s seed for a mode changes later, a user who has
reset still gets the new seed, not the old one frozen in their cookie.

## Persistence

`chartSplitOverrides`, cookie-backed the same way as `visibleLines`/`dashboardMode`: read once at
module init in `globalState.tsx` via `getSettingFromCookieStorage`, defaulting to `{}` when
nothing is stored (an empty overrides object *is* "every mode reads its seed" — no separate
seeding step needed). `setChartSplitOverride` is the only writer, and it writes state and cookie
together, matching the "state plus cookie, so the two can never be written apart" pattern the
enabled-countries writer already uses. New cookie key: `CookieStorageKeys.CHART_SPLIT_OVERRIDES`.

## Files

New: `components/shell/use-resizable-chart-split.ts`, `components/shell/chart-resize-handle.tsx`,
`components/shell/geometry.test.ts`, `components/helpers/chart-split-override.test.ts`.

Deleted: `components/shell/expand-button.tsx`.

Edited: `components/shell/geometry.ts` (seed/override lookup, `chartModeFor`, `clampChartSplit`,
`overlapsControlDock`, dropped `CHART_SPLIT.expanded`), `components/shell/floating-chart.tsx`
(wires the hook, drops `isExpanded`), `components/helpers/globalState.tsx`
(`chartSplitOverrides` + `setChartSplitOverride`), `components/helpers/cookieStorage.ts` (one new
key). `dashboard-shell.tsx` and `map-control-dock.tsx` were **not** touched — the container
measurement the resize needs comes from the panel's own `offsetParent`, which is the existing
chrome-inset div `dashboard-shell.tsx` already renders, so nothing about the mount needed to
change.

## Verification

`yarn tsc --noEmit`, run from `apps/nowcasting-app`: clean on every file this track touched. The
only errors reported are in `components/map/map-value-join.test.ts`, which is Track K's
concurrent, uncommitted work (confirmed via `git status` — that file, plus `feature-state.ts`,
`color-guide-bar.tsx` and `config/countries.ts`, all show modified and are Track K's named
files), and the known pre-existing `jest.globalSetup.ts(14,1) TS1208`.

`npx next lint`: **16 warnings, 0 errors** on this track's files — baseline exactly. The two
`prettier/prettier` errors reported against `components/map/feature-state.ts` are Track K's
in-progress file, not mine (confirmed the same way).

Jest: **1127 passed** (baseline 1095) across **48 passed suites** + 1 failing
(`color-guide-bar.test.tsx`, 4 failures — Track K's file, mid-edit; not touched by this track).
Two new suites, 20 new tests: `geometry.test.ts` (mode selection, seed/override lookup, per-mode
isolation, mode-switch restoring a remembered size, clamping — min, max, the overlap-aware
control-dock reserve and the regression test for the bug above) and
`chart-split-override.test.ts` (the global-state write path: per-mode isolation again at the
storage layer, and reset-clears-rather-than-freezes). Drag feel and frame timing are not tested,
per the brief — nothing in `use-resizable-chart-split.ts` is a pure function of its inputs.

`next build`: does **not** reach a clean compile right now, but the only lint errors it surfaces
are the same two Track K files (`color-guide-bar.test.tsx` — a
`@typescript-eslint/no-var-requires` rule-definition error, `feature-state.ts` — the same two
prettier errors as above). Nothing from this track's files appears anywhere in the build output;
`grep`-ing it for `shell/`, `floating-chart`, `geometry.ts`, `chart-resize`, `use-resizable`,
`globalState.tsx` and `cookieStorage` returns nothing. This should go green once Track K's work
lands or is stashed — it isn't something I can fix without touching files I don't own.

## What Brad should check by feel

- **Drag the corner on each of the four modes** (plain / comparing / select a region / select +
  compare) and confirm the panel tracks the pointer smoothly with no visible lag or map/chart
  stutter during the drag — that's the two-rate commit doing its job.
- **The bug you filed**: select a region with nothing dragged yet, and confirm the panel actually
  reaches something close to 90% height rather than stopping short. Then drag it wider — near the
  control dock's column — and confirm it does get capped once it's genuinely under the dock,
  rather than reaching over it.
- **Resize `plain`, switch to `comparing`, resize that differently, switch back to `plain`** —
  it should come back exactly where you left it, not at the `comparing` size and not at the seed.
- **Double-click the handle** (or focus it and press Enter) — confirm it snaps back to that
  mode's default rather than to some other mode's or a fixed size.
- **Keyboard-only**: tab to the handle, resize with arrow keys, reset with Enter/Space, with no
  mouse at all.
- **Narrow the window below the `lg` breakpoint** (or a phone/tablet) — the handle should
  disappear and the chart should go back to full-width/seed-height, matching the old narrow
  behaviour exactly (this path wasn't changed, only re-verified not to regress).
- **The min size** — try to drag the panel down to nothing; it should stop at a size that's
  still comfortably readable, not visually collapse.
