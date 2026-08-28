import { FC, ReactNode, useEffect, useState } from "react";

import ChartResizeHandle from "./chart-resize-handle";
import useGlobalState, { setChartSplitOverride, useCountryState } from "../helpers/globalState";
import { CHART_SPLIT, chartModeFor, STAGE_GUTTER_PX } from "./geometry";
import { useResizableChartSplit } from "./use-resizable-chart-split";

/**
 * The chart, floating over the map.
 *
 * Contract §3: the map is the ground and the chart is a readout of it at the cursor instant —
 * one instrument in two panes, not two panels sharing a 50/50 split. The split it replaces was
 * already vestigial (both halves hardcoded to `"50%"`, the responsive widths commented out),
 * and a half-width map showing GB, NL and Germany at once would be mostly sea.
 *
 * **The mode sets the seed, the user's drag is the override.** A comparison asks *where* the
 * difference is, so it shrinks the chart and gives the map the room; the plain forecast asks
 * about the curve, so the chart takes more (`geometry.ts`'s `CHART_SPLIT`). That is read only
 * until the user resizes a mode — `chartModeFor`/`resolveChartSplit` prefer a stored
 * `chartSplitOverrides` entry over the seed, and `useResizableChartSplit` is what writes one.
 * This is OPEN 5, landing as a drag rather than the expand handle the layout contract shipped
 * with: Brad's call was that mode-based *live* rescaling feels uncontrolled, so once a mode is
 * sized it stays exactly where the user left it — the mode only ever supplies the seed a new
 * session (or a mode never touched before) starts from.
 *
 * A region selection also grows the seed — see `geometry.ts`'s `CHART_SPLIT.selected` /
 * `comparingSelected` — because selecting stacks the GSP sub-chart under the national one
 * inside the same panel. Read directly off `selectedMapRegionIds` rather than threaded down
 * as a prop, the same way `ChartLegend` used to, so the shell mounting this component does
 * not need to know why.
 *
 * It knows nothing about the display rail, and that is the point — see `geometry.ts`. It is
 * rendered inside the shell's chrome inset, whose right edge is the rail's left edge, so
 * "the chart cannot be dragged behind the rail" is a property of where it is mounted rather
 * than a rule enforced with `z-index` — and the drag handle below is bounded by the same
 * inset, via `clampChartSplit` measuring the panel's own `offsetParent`.
 *
 * **The panel hangs from the top edge.** It used to hang from the bottom; Brad moved it because
 * the countries the map now frames sit low in the viewport, so a chart growing downward from
 * the top eats empty sea rather than the landmass. Two things follow from the anchor, and they
 * are the only places the direction is encoded:
 *
 * - `top` rather than `bottom` below, so growth runs downward and the panel's fixed corner is
 *   top-left. The resize handle moves to the opposite corner with it (`chart-resize-handle.tsx`)
 *   and `use-resizable-chart-split.ts`'s vertical drag loses its sign flip.
 * - **The map control panel lives top-right** (Phase 6 followup, Track G moved it there; Track I
 *   consolidated the map's layer toggles into it), so chart and dock now share the top row from
 *   the chart's first pixel instead of only meeting when the chart grew tall. `clampChartSplit`
 *   caps the chart's *width* short of the dock's column rather than reserving height under it —
 *   see `geometry.ts`'s `maxChartWidthPx`.
 *
 * **Except when narrow**, where the chart is full width and a top anchor would simply cover the
 * dock — no width cap can save a panel that spans the whole stage. Below `lg` it keeps hanging
 * from the bottom, which is where it always was.
 *
 * That bottom anchor is a **holding position, not a design**. Brad's read is that the narrow
 * layout needs a broader change than an anchor: a full-width chart at 67% height leaves the map
 * — the thing the chart is a readout *of* — as a strip, and making that work needs rules about
 * how the chart, the map controls and the display rail give way to each other, plus a control
 * for the user to choose between them. None of that exists yet. All this branch does is stop
 * the chart sitting on top of the control dock in the meantime; see the phase 6 followup notes.
 */

const NARROW_QUERY = "(max-width: 1023px)";

const FloatingChart: FC<{ children: ReactNode; comparisonActive: boolean }> = ({
  children,
  comparisonActive
}) => {
  const [selectedMapRegionIds] = useCountryState("selectedMapRegionIds");
  const [chartSplitOverrides] = useGlobalState("chartSplitOverrides");
  const regionSelected = !!selectedMapRegionIds && selectedMapRegionIds.length > 0;

  // Below `lg` there is not enough width for map and chart side by side, so the chart takes
  // the whole inset — the same call `SideLayout` made, made continuously rather than once on
  // mount, so a rotated tablet lands in the right place.
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    const sync = () => setIsNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const mode = chartModeFor(comparisonActive, regionSelected);
  const seed = CHART_SPLIT[mode];
  const override = chartSplitOverrides[mode];

  const { split, isDragging, panelRef, handlePropsFor } = useResizableChartSplit({
    seed,
    override,
    // In-drag frames update state only; the cookie is written once, when the gesture ends.
    onCommit: (next, { transient }) => setChartSplitOverride(mode, next, { persist: !transient }),
    onReset: () => setChartSplitOverride(mode, null)
  });

  return (
    <div
      ref={panelRef}
      // The transition is for size changes the user did not make with their hand — a mode
      // change swapping one seed for another, the rail opening and reflowing the inset. During
      // a drag it is exactly wrong: the hook writes a new size every frame and a 300ms ease
      // makes the panel chase the pointer 300ms behind, which reads as a sluggish, rubbery
      // handle rather than a grabbed edge. Direct manipulation should be instant, so the
      // transition is off for as long as the pointer owns the size.
      className={`pointer-events-auto absolute z-20${
        isNarrow || isDragging ? "" : " transition-[width,height] duration-300"
      }`}
      style={{
        left: STAGE_GUTTER_PX,
        // Wide: hangs from the top, growing down. Narrow: full width, so a top anchor would sit
        // straight over the top-right control dock — it keeps the old bottom anchor instead.
        // A holding position until the narrow stage is designed properly — see above.
        ...(isNarrow ? { bottom: STAGE_GUTTER_PX } : { top: STAGE_GUTTER_PX }),
        width: isNarrow ? `calc(100% - ${STAGE_GUTTER_PX * 2}px)` : `${split.width}%`,
        height: `${split.height}%`
      }}
    >
      <section
        aria-label="Chart"
        className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-content/10 bg-surface-panel text-content shadow-2xl focus:outline-none"
      >
        {children}
      </section>

      {/* Resizing is a pointer/keyboard interaction that does not translate to touch-only
          layouts, and the narrow layout ignores the split entirely (full width, seed height) —
          so the handles only render at `lg` and up, alongside the transition they also skip.

          Three grips for the three edges that move: the right edge takes width, the bottom edge
          takes height, and the corner between them takes both. The corner alone forced anyone
          wanting one dimension to hold the other steady along a diagonal. */}
      {!isNarrow && (
        <>
          <ChartResizeHandle axis="x" {...handlePropsFor("x")} />
          <ChartResizeHandle axis="y" {...handlePropsFor("y")} />
          <ChartResizeHandle axis="both" {...handlePropsFor("both")} />
        </>
      )}
    </div>
  );
};

export default FloatingChart;
