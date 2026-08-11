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
 * The chart's default split, as percentages of the inset.
 *
 * §3: the mode sets the default and the user overrides it. A comparison is a question about
 * *where* the difference is, so it shrinks the chart and gives the map the room; plain
 * forecast is a question about the curve, so the chart takes more. `expanded` is today's
 * override — the same expand handle `SideLayout` carried, which used to swap 50% for 90%.
 * The drag/resize override is OPEN 5 and deliberately not built.
 */
export const CHART_SPLIT = {
  plain: { width: 46, height: 62 },
  comparing: { width: 34, height: 46 },
  expanded: { width: 92, height: 80 }
} as const;
