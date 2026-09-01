/**
 * The shell's edge space, in one place.
 *
 * Contract §6 names a hard constraint: the display controls and the floating chart compete for
 * edge space, and the chart must know they exist rather than being pushed behind them with
 * `z-index` afterwards. The shell answers that *structurally* — everything that floats over the
 * map is rendered inside one positioning layer (`DashboardShell`'s "chrome inset"), and the
 * chart's width is capped short of the right-hand control column (`maxChartWidthPx` below).
 * The display panel lives in that column too, so one cap covers both and the OPEN 5
 * drag/resize (`floating-chart.tsx`, `use-resizable-chart-split.ts`) is bounded by it.
 *
 * `RAIL_WIDTH_PX` used to live here, for when the display panel was a 256px rail down the
 * right edge that the inset was narrowed to meet. It shares the dock's column now, so the
 * inset is a fixed box and opening the panel resizes nothing.
 *
 * The numbers come from the settled prototype, `docs/prototypes/phase6-chrome.html`.
 */

/** Breathing room between a floating pane and the edges of the inset it lives in. */
export const STAGE_GUTTER_PX = 8;

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
 * gone — the dock anchors at `STAGE_GUTTER_PX` from the top like it does from the right.
 *
 * **Then the chart moved to the top edge too**, which turns the dock constraint from a vertical
 * one into a horizontal one.
 *
 * While the chart anchored bottom-left it only met the top-right dock when a *tall* chart grew
 * up into the dock's column, so the clamp reserved height (`MAP_CONTROL_HEIGHT_RESERVE_PX` /
 * `CHART_TOP_CLEARANCE_PX`, both now gone) and only when `overlapsControlDock` said the two
 * x-ranges intersected. Anchored top-left the chart shares the dock's row from its first pixel:
 * there is no height at which they miss each other, so no height reserve can express the rule.
 * What keeps them apart is the chart's *width* stopping short of the dock's column — see
 * `maxChartWidthPx` — after which height is free all the way to the bottom gutter.
 *
 * Guessing the dock's rendered height is also gone with it, which was the weakest part of the
 * old clamp (a constant sized by eye to the *expanded* panel, capping the chart even when the
 * panel was collapsed and much shorter). The dock's width is a real published constant
 * (`MAP_CONTROL_WIDTH_PX`, which `map-control-dock.tsx` actually renders at), so the new rule
 * needs no estimate at all.
 */

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
 * **Width does not vary by mode in practice.** All four entries still name one, because a mode
 * with no override has to render at *some* width, but `setChartSplitOverride` shares whatever
 * width the user drags across every mode: opening the regional chart changes what the panel
 * contains, not how much of the stage you want it to have. Only the heights below are really
 * per mode, and they are the reason the table exists.
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
 * The widest the chart may render before its right edge reaches the map control dock's column.
 *
 * The dock is pinned top-right, `STAGE_GUTTER_PX` in from both edges and `MAP_CONTROL_WIDTH_PX`
 * wide (`map-control-dock.tsx`); the chart is pinned top-*left*, `STAGE_GUTTER_PX` in from its
 * own two edges (`floating-chart.tsx`). They occupy the same band of the stage, so the only
 * thing separating them is horizontal: the chart may run from its left gutter up to a gutter's
 * clearance short of the dock's left edge.
 *
 * This can come out smaller than `MIN_CHART_WIDTH_PX` on a genuinely tiny stage. It is returned
 * as measured rather than floored here — `clampChartSplit` resolves that collision the same way
 * it resolves every other min/max inversion, by letting the minimum win.
 */
export function maxChartWidthPx(containerWidthPx: number): number {
  const dockLeftEdgePx = containerWidthPx - STAGE_GUTTER_PX - MAP_CONTROL_WIDTH_PX;
  return dockLeftEdgePx - STAGE_GUTTER_PX - STAGE_GUTTER_PX;
}

/**
 * Fit a proposed split inside the inset: never smaller than `MIN_CHART_*_PX`, never wider than
 * `maxChartWidthPx` allows (short of the map control dock's column), never taller than the
 * inset's own gutters allow.
 *
 * Height no longer depends on width. It did while the chart anchored bottom-left and could grow
 * up into the dock; top-anchored, width is the whole of the dock constraint and height only has
 * to clear the bottom gutter — see this file's note above `maxChartWidthPx`.
 *
 * Container dimensions of `0` (not yet measured — first paint, before a `ResizeObserver` has
 * reported) are treated as "unknown" and the split passes through unclamped, matching how
 * `scrub-track.tsx`'s `TrackTicks` leaves its first paint unmeasured rather than guessing.
 */
export function clampChartSplit(
  split: ChartSplitPercent,
  container: ChartContainerSizePx
): ChartSplitPercent {
  const { widthPx, heightPx } = container;
  if (widthPx <= 0 || heightPx <= 0) return split;

  const minWidthPercent = (MIN_CHART_WIDTH_PX / widthPx) * 100;
  const maxWidthPercent = (maxChartWidthPx(widthPx) / widthPx) * 100;
  const width = clampNumber(
    split.width,
    minWidthPercent,
    Math.max(minWidthPercent, maxWidthPercent)
  );

  const minHeightPercent = (MIN_CHART_HEIGHT_PX / heightPx) * 100;
  const maxHeightPercent = ((heightPx - STAGE_GUTTER_PX * 2) / heightPx) * 100;
  const height = clampNumber(
    split.height,
    minHeightPercent,
    Math.max(minHeightPercent, maxHeightPercent)
  );

  return { width, height };
}
