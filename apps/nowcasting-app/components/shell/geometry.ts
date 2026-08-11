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
 * Phase 6 followup, Track G: **the cluster moved corners.** It was bottom-right, sharing
 * nothing vertically with the chart (also bottom-anchored, so only their widths could ever
 * collide — `MAP_CONTROL_WIDTH_PX` capped the chart's). Brad's live pass asked for it to move
 * top-right instead, to sit with the Clouds/PV layer toggles `map.tsx` already renders there
 * (`justify-end` inside a full-width top row, forecast map only) — one corner for "what does
 * the map show", rather than two.
 *
 * **This move is partial, on purpose.** `map.tsx` (and `pvLatestMap.tsx`/`deltaMap.tsx`, which
 * mount it) are not owned by this track, and were under concurrent investigation for an
 * unrelated delta-map bug while this change was made — moving the Clouds/PV buttons' own JSX
 * out of `map.tsx` to genuinely interleave them with this cluster risked colliding with that
 * work and was explicitly out of bounds. So the cluster now sits in the *same corner*, stacked
 * below that row, rather than merged into one row with it. Flagged as a followup once `map.tsx`
 * is free.
 *
 * `MAP_TOP_ROW_RESERVE_PX` is what makes the stacking possible without reading `map.tsx`: the
 * vertical space to clear before the cluster starts, sized to the Clouds/PV row's rendered
 * height (a `p-4` container, `mt-3` above the row, one line of buttons/select ~28-32px tall).
 * Generous rather than tight, since that row's exact height is not this track's to guarantee —
 * on the delta map, which renders no such row, the cluster just sits with extra headroom above
 * it, which is a cosmetic asymmetry, not a bug. **Worth Brad's eye specifically**: this number
 * cannot be verified by a green build, only by looking.
 */
export const MAP_TOP_ROW_RESERVE_PX = 64;

/**
 * Typical maximum rendered height of the encoding cluster itself (`map-encoding-controls.tsx`:
 * the "Colour by" toggle, the unit control, and `ColorGuideBar` at its tallest — the "GB bands"
 * attribution row present, bands wrapped to two lines). Used only to cap the floating chart's
 * height so a tall chart cannot grow up underneath the cluster now that both are on the same
 * (right) side — see `CHART_TOP_CLEARANCE_PX` below and `floating-chart.tsx`. A judgement call
 * in the same spirit as `MAP_CONTROL_WIDTH_PX` was for the old width cap: re-tune by eye if the
 * cluster's real content grows past it.
 */
export const MAP_CONTROL_HEIGHT_RESERVE_PX = 230;

/**
 * Combined vertical space the floating chart must clear at the top of the stage: the Clouds/PV
 * row, the cluster stacked beneath it, and a gutter. Replaces the old `MAP_CONTROL_WIDTH_PX`
 * width cap on the chart now that the cluster is no longer in the chart's own bottom-right
 * corner — the coupling didn't disappear, it changed axis, from "don't reach right into the
 * cluster's column" to "don't grow up into the cluster's row."
 */
export const CHART_TOP_CLEARANCE_PX =
  MAP_TOP_ROW_RESERVE_PX + MAP_CONTROL_HEIGHT_RESERVE_PX + STAGE_GUTTER_PX;

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
  plain: { width: 46, height: 62 },
  comparing: { width: 34, height: 46 },
  selected: { width: 54, height: 78 },
  comparingSelected: { width: 40, height: 60 },
  expanded: { width: 92, height: 80 }
} as const;
