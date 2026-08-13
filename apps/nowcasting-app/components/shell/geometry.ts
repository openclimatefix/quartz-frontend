/**
 * The shell's edge space, in one place.
 *
 * Contract §6 names a hard constraint: the display rail and the floating chart compete for
 * edge space, and the chart must know the rail exists rather than being pushed behind it with
 * `z-index` afterwards. The shell answers that *structurally* — everything that floats over
 * the map is rendered inside a positioning layer whose right edge is the rail's left edge
 * (`DashboardShell`'s "chrome inset"), so a floating pane cannot reach the rail's space at
 * all. There is nothing to police, and the OPEN 5 drag/resize (`floating-chart.tsx`,
 * `use-resizable-chart-split.ts`) is bounded by the same box.
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
 * Typical maximum rendered height of the encoding panel (`map-encoding-controls.tsx`), sized
 * to its *expanded* state ("more map settings" open) rather than the collapsed default.
 *
 * Track L (this file's resize followup) narrowed where this constant actually applies: see
 * `overlapsControlDock` below. It used to cap the chart's height unconditionally, which is the
 * bug Brad filed against `CHART_SPLIT.selected` — a chart at 54% width never reaches under a
 * 260px dock pinned to the right edge on any normal-width screen, so there was nothing to clamp
 * against and the 90% height seed was being discarded for no reason. Reserving this much height
 * is only correct for the (still real, still worth guarding) case of a *wide* chart — a large
 * drag, or `comparingSelected`'s combination — whose right edge genuinely reaches the dock's
 * column. A live measurement of the dock's actual (usually collapsed, much shorter) height
 * would tighten this further, but `map-control-dock.tsx` is not owned by this track and
 * publishing a measurement from it is a change to that file — see the Track L followup notes
 * for what's needed if this is worth doing.
 */
export const MAP_CONTROL_HEIGHT_RESERVE_PX = 350;

/**
 * Vertical space the floating chart must clear at the top of the stage *when it overlaps the
 * dock's column* — the encoding panel's own height plus a gutter. Exported for anything that
 * wants the old unconditional figure (nothing in this codebase does any more); `clampChartSplit`
 * is what actually applies it, and only when `overlapsControlDock` says the two panes' x-ranges
 * intersect.
 */
export const CHART_TOP_CLEARANCE_PX = MAP_CONTROL_HEIGHT_RESERVE_PX + STAGE_GUTTER_PX;

/** Floor on the chart's rendered size, so a drag cannot shrink it to an unreadable sliver. */
export const MIN_CHART_WIDTH_PX = 320;
export const MIN_CHART_HEIGHT_PX = 220;

/**
 * The chart's default split, as percentages of the inset — the **seed** each mode starts from.
 *
 * §3: the mode sets the default and the user overrides it. A comparison is a question about
 * *where* the difference is, so it shrinks the chart and gives the map the room; plain
 * forecast is a question about the curve, so the chart takes more.
 *
 * `selected` and `comparingSelected` are the followup fix for the case Track D's live-pass
 * note flagged by name: selecting a region stacks the GSP sub-chart under the national one
 * (`GspPvRemixChart` inside `pv-remix-chart.tsx`) in the *same* panel `plain`/`comparing`
 * sized for one chart, "the arrangement most likely to feel cramped." A selection grows the
 * panel — mostly in height, since it's a second chart stacked vertically that needs the room
 * — and clearing the selection returns it. The combination with comparison is real (§3 does
 * not treat them as exclusive), so it gets its own smaller bump rather than being ignored or
 * summed unbounded.
 *
 * **This is a seed, not a live default.** Brad was explicit that mode-based scaling must not
 * keep resizing the panel under the user's hands once they have sized a mode themselves — "it
 * feels quite uncontrolled from a user perspective." So a mode's entry here is only ever read
 * the first time that mode is seen; `resolveChartSplit` below prefers a stored per-mode
 * override, and once one exists for a mode this table is never consulted for it again. There
 * used to be a fifth entry, `expanded`, for the old expand-handle override that swapped 50%
 * for 90% regardless of mode — removed with the handle itself now that dragging replaces it.
 */
export const CHART_SPLIT = {
  plain: { width: 46, height: 67 },
  comparing: { width: 40, height: 58 },
  selected: { width: 54, height: 90 },
  comparingSelected: { width: 46, height: 80 }
} as const;

/** The four states the chart's size can seed from — see `CHART_SPLIT`. */
export type ChartMode = keyof typeof CHART_SPLIT;

/** A chart size, as percentages of the inset — what `CHART_SPLIT` entries and overrides hold. */
export interface ChartSplitPercent {
  width: number;
  height: number;
}

/** The inset's measured pixel size — what a split's percentages are relative to. */
export interface ChartContainerSizePx {
  widthPx: number;
  heightPx: number;
}

/**
 * Which mode the chart is in, off the same two booleans `floating-chart.tsx` already read
 * (`comparisonActive`, whether a region is selected). Pulled out to a pure function so the
 * mode-selection ladder has one place to test — mode switching restoring the right remembered
 * size depends on this and `resolveChartSplit` agreeing on what "the mode" means.
 */
export function chartModeFor(comparisonActive: boolean, regionSelected: boolean): ChartMode {
  if (comparisonActive && regionSelected) return "comparingSelected";
  if (regionSelected) return "selected";
  if (comparisonActive) return "comparing";
  return "plain";
}

/**
 * A mode's current size: the user's stored override if there is one, `CHART_SPLIT`'s seed if
 * there is not yet. This is the whole of "seed vs override" as a lookup — nothing here decides
 * *when* an override is written, that's `floating-chart.tsx` committing a drag.
 */
export function resolveChartSplit(
  mode: ChartMode,
  overrides: Partial<Record<ChartMode, ChartSplitPercent>>
): ChartSplitPercent {
  return overrides[mode] ?? CHART_SPLIT[mode];
}

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Whether a chart of the given rendered width would reach under the map control dock's column.
 *
 * The dock is pinned top-right, `STAGE_GUTTER_PX` in from both edges and `MAP_CONTROL_WIDTH_PX`
 * wide (`map-control-dock.tsx`); the chart grows from the opposite corner (`floating-chart.tsx`
 * anchors it `left`/`bottom`). Their vertical ranges only matter to each other when their
 * horizontal ranges also overlap — a narrow chart can grow to the very top of the stage without
 * ever passing under the dock, whatever its height. This is what `clampChartSplit` uses to
 * decide whether `MAP_CONTROL_HEIGHT_RESERVE_PX` applies at all.
 */
export function overlapsControlDock(chartWidthPx: number, containerWidthPx: number): boolean {
  const chartRightEdgePx = STAGE_GUTTER_PX + chartWidthPx;
  const dockLeftEdgePx = containerWidthPx - STAGE_GUTTER_PX - MAP_CONTROL_WIDTH_PX;
  return chartRightEdgePx > dockLeftEdgePx;
}

/**
 * Fit a proposed split inside the inset: never smaller than `MIN_CHART_*_PX`, never wider than
 * the inset's own gutters allow, and never taller than the space above the map control dock
 * *when the two would actually overlap* (`overlapsControlDock`) — otherwise only the gutter.
 *
 * Width is clamped first and height second, off the clamped width, so a diagonal drag that
 * crosses the overlap boundary mid-gesture reads the correct regime rather than the one it
 * started in.
 *
 * Container dimensions of `0` (not yet measured — first paint, before a `ResizeObserver` has
 * reported) are treated as "unknown" and the split passes through unclamped, matching how
 * `scrub-track.tsx`'s `TrackTicks` leaves its first paint unmeasured rather than guessing.
 */
export function clampChartSplit(
  split: ChartSplitPercent,
  container: ChartContainerSizePx,
  controlPanelReservePx: number = MAP_CONTROL_HEIGHT_RESERVE_PX
): ChartSplitPercent {
  const { widthPx, heightPx } = container;
  if (widthPx <= 0 || heightPx <= 0) return split;

  const minWidthPercent = (MIN_CHART_WIDTH_PX / widthPx) * 100;
  const maxWidthPercent = ((widthPx - STAGE_GUTTER_PX * 2) / widthPx) * 100;
  const width = clampNumber(
    split.width,
    minWidthPercent,
    Math.max(minWidthPercent, maxWidthPercent)
  );

  const chartWidthPx = (width / 100) * widthPx;
  const topReservePx = overlapsControlDock(chartWidthPx, widthPx)
    ? controlPanelReservePx + STAGE_GUTTER_PX
    : STAGE_GUTTER_PX;

  const minHeightPercent = (MIN_CHART_HEIGHT_PX / heightPx) * 100;
  const maxHeightPercent = ((heightPx - topReservePx) / heightPx) * 100;
  const height = clampNumber(
    split.height,
    minHeightPercent,
    Math.max(minHeightPercent, maxHeightPercent)
  );

  return { width, height };
}
