import { FC, ReactNode, useEffect, useState } from "react";

import ChartResizeHandle from "./chart-resize-handle";
import { ChartInfo } from "../../ChartInfo";
import { InfoIcon } from "../icons/icons";
import Tooltip from "../tooltip";
import { useCountryFormatting } from "../../hooks/data/use-country-format";
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
 * **The map control panel lives top-right** (Phase 6 followup, Track G moved it there; Track I
 * consolidated the map's layer toggles into it). `clampChartSplit` only reserves height for it
 * when the chart's *width* would actually reach that column (`overlapsControlDock`) — a narrow
 * chart can grow tall without needing to know the dock is there at all.
 */

const NARROW_QUERY = "(max-width: 1023px)";

const FloatingChart: FC<{ children: ReactNode; comparisonActive: boolean }> = ({
  children,
  comparisonActive
}) => {
  const { timezone } = useCountryFormatting();
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

  const { split, panelRef, handleProps } = useResizableChartSplit({
    seed,
    override,
    onCommit: (next) => setChartSplitOverride(mode, next),
    onReset: () => setChartSplitOverride(mode, null)
  });

  return (
    <div
      ref={panelRef}
      className={`pointer-events-auto absolute z-20${
        isNarrow ? "" : " transition-[width,height] duration-300"
      }`}
      style={{
        left: STAGE_GUTTER_PX,
        bottom: STAGE_GUTTER_PX,
        width: isNarrow ? `calc(100% - ${STAGE_GUTTER_PX * 2}px)` : `${split.width}%`,
        height: `${split.height}%`
      }}
    >
      <section
        aria-label="Chart"
        className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-mapbox-black-500 text-white shadow-2xl focus:outline-none"
      >
        {children}
      </section>

      {/* Resizing is a pointer/keyboard interaction that does not translate to touch-only
          layouts, and the narrow layout ignores the split entirely (full width, seed height) —
          so the handle only renders at `lg` and up, alongside the transition it also skips. */}
      {!isNarrow && <ChartResizeHandle {...handleProps} />}

      {/* Hung off the right edge, as they were on `SideLayout` — the panel's own corners are
          spoken for by the chart header and the legend. */}
      <div className="absolute bottom-3 -right-4 z-20 rounded-full bg-mapbox-black-500 p-1.5">
        <Tooltip
          tip={
            <div className="w-64 rounded-md">
              <ChartInfo timezone={timezone} />
            </div>
          }
          position="top"
          className="text-right"
          fullWidth
        >
          <InfoIcon />
        </Tooltip>
      </div>
    </div>
  );
};

export default FloatingChart;
