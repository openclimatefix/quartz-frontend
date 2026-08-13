/**
 * The shell's edge space, in one place.
 *
 * Contract §6 names a hard constraint: the display rail and the floating chart compete for
 * edge space, and the chart must know the rail exists rather than being pushed behind it with
 * `z-index` afterwards. The shell answers that *structurally* — everything that floats over
 * the map is rendered inside a positioning layer whose right edge is the rail's left edge
 * (`DashboardShell`'s "chrome inset"), so a floating pane cannot reach the rail's space at
 * all. There is nothing to police, and nothing for a later drag handle (OPEN 5) to get wrong:
 * the drag will be bounded by the same box.
 *
 * The numbers come from the settled prototype, `docs/prototypes/phase6-chrome.html`.
 */

/** Width of the display rail when it is open. */
export const RAIL_WIDTH_PX = 256;

/** Breathing room between a floating pane and the edges of the inset it lives in. */
export const STAGE_GUTTER_PX = 14;

/** Width the map control cluster is laid out around — see `map-control-dock.tsx`. */
export const MAP_CONTROL_WIDTH_PX = 260;

/**
 * Phase 6 followup, Track G moved the cluster from bottom-right to top-right, to sit with the
 * Clouds/PV layer toggles `map.tsx` rendered there itself (forecast map only). `map.tsx` was
 * off-limits to that track (concurrent, unrelated work), so it stopped at "same corner,
 * stacked below that row" and reserved the row's height with a constant sized by eye rather
 * than measurement — `MAP_TOP_ROW_RESERVE_PX`, since removed.
 *
 * Phase 6 followup, Track I finishes the move Brad actually asked for ("consolidate ... into
 * one panel"): the Clouds/PV buttons and the satellite channel select moved out of `map.tsx`
 * into `map-layer-controls.tsx`, which now mounts *inside* `map-encoding-controls.tsx` behind
 * a "more settings" disclosure. There is only one top-right box now, not two stacked ones, so
 * the guess-another-file's-height problem `MAP_TOP_ROW_RESERVE_PX` existed to paper over is
 * gone — the dock anchors at `STAGE_GUTTER_PX` from the top like it does from the right, and
 * only its own height needs reserving.
 */

/**
 * Typical maximum rendered height of the encoding panel (`map-encoding-controls.tsx`): "Colour
 * by", the unit toggle, `ColorGuideBar` at its tallest (the "GB bands" attribution row present,
 * bands wrapped to two lines), the "more settings" disclosure row, and — when that disclosure
 * is open — the aggregation-level toggle and `MapLayerControls` with its satellite channel
 * select showing. Used only to cap the floating chart's height so a tall chart cannot grow up
 * underneath the panel — see `CHART_TOP_CLEARANCE_PX` below and `floating-chart.tsx`.
 *
 * Sized to the *expanded* state, not the collapsed default, because the chart must not overlap
 * the panel in whichever state the user leaves it — a user who opens "more settings" and then
 * expands the chart must still see the settings, not have the chart grow over them. A
 * judgement call in the same spirit as `MAP_CONTROL_WIDTH_PX` was for the old width cap:
 * re-tune by eye if the panel's real content grows past it.
 */
export const MAP_CONTROL_HEIGHT_RESERVE_PX = 350;

/**
 * Vertical space the floating chart must clear at the top of the stage: the encoding panel's
 * own height plus a gutter. Simpler than Track G's version now that the panel is the only
 * thing in the corner — no separate row above it to also clear.
 */
export const CHART_TOP_CLEARANCE_PX = MAP_CONTROL_HEIGHT_RESERVE_PX + STAGE_GUTTER_PX;

/**
 * The chart's default split, as percentages of the inset.
 *
 * §3: the mode sets the default and the user overrides it. A comparison is a question about
 * *where* the difference is, so it shrinks the chart and gives the map the room; plain
 * forecast is a question about the curve, so the chart takes more. `expanded` is today's
 * override — the same expand handle `SideLayout` carried, which used to swap 50% for 90%.
 * The drag/resize override is OPEN 5 and deliberately not built.
 *
 * `selected` and `comparingSelected` are the followup fix for the case Track D's live-pass
 * note flagged by name: selecting a region stacks the GSP sub-chart under the national one
 * (`GspPvRemixChart` inside `pv-remix-chart.tsx`) in the *same* panel `plain`/`comparing`
 * sized for one chart, "the arrangement most likely to feel cramped." A selection grows the
 * panel — mostly in height, since it's a second chart stacked vertically that needs the room
 * — and clearing the selection returns it. The combination with comparison is real (§3 does
 * not treat them as exclusive), so it gets its own smaller bump rather than being ignored or
 * summed unbounded. `expanded` still wins over all of it — the handle is an explicit
 * user override and must not be second-guessed by state the user didn't set.
 */
export const CHART_SPLIT = {
  plain: { width: 46, height: 67 },
  comparing: { width: 40, height: 58 },
  selected: { width: 54, height: 90 },
  comparingSelected: { width: 46, height: 80 },
  // Raised from 80 with `selected`: the expand handle is an explicit user override and must
  // always give *more* than a state the user did not ask for, or expanding a selected region
  // would shrink the panel.
  expanded: { width: 92, height: 92 }
} as const;
