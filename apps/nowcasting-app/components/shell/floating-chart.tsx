import { FC, ReactNode, useEffect, useState } from "react";

import ExpandButton from "./expand-button";
import { ChartInfo } from "../../ChartInfo";
import { InfoIcon } from "../icons/icons";
import Tooltip from "../tooltip";
import { useCountryFormatting } from "../../hooks/data/use-country-format";
import { CHART_SPLIT, MAP_CONTROL_WIDTH_PX, STAGE_GUTTER_PX } from "./geometry";

/**
 * The chart, floating over the map.
 *
 * Contract §3: the map is the ground and the chart is a readout of it at the cursor instant —
 * one instrument in two panes, not two panels sharing a 50/50 split. The split it replaces was
 * already vestigial (both halves hardcoded to `"50%"`, the responsive widths commented out),
 * and a half-width map showing GB, NL and Germany at once would be mostly sea.
 *
 * **The mode sets the default size and the user overrides it.** A comparison asks *where* the
 * difference is, so it shrinks the chart and gives the map the room; the plain forecast asks
 * about the curve, so the chart takes more. The override is the expand handle inherited from
 * `SideLayout`, which used to swap 50% for 90%; the drag/resize version is OPEN 5 and
 * explicitly not blocking.
 *
 * It knows nothing about the display rail, and that is the point — see `geometry.ts`. It is
 * rendered inside the shell's chrome inset, whose right edge is the rail's left edge, so
 * "the chart cannot be dragged behind the rail" is a property of where it is mounted rather
 * than a rule enforced with `z-index`. The same reasoning caps its width short of the map
 * control cluster's column, so an expanded chart can never cover the control that explains
 * the map's colours.
 */

const NARROW_QUERY = "(max-width: 1023px)";

const FloatingChart: FC<{ children: ReactNode; comparisonActive: boolean }> = ({
  children,
  comparisonActive
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { timezone } = useCountryFormatting();

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

  const split = isExpanded
    ? CHART_SPLIT.expanded
    : comparisonActive
    ? CHART_SPLIT.comparing
    : CHART_SPLIT.plain;

  return (
    <div
      className="pointer-events-auto absolute z-20 transition-[width,height] duration-300"
      style={{
        left: STAGE_GUTTER_PX,
        bottom: STAGE_GUTTER_PX,
        width: isNarrow ? `calc(100% - ${STAGE_GUTTER_PX * 2}px)` : `${split.width}%`,
        height: `${split.height}%`,
        // Never over the map control cluster, whatever the split says.
        maxWidth: `calc(100% - ${MAP_CONTROL_WIDTH_PX + STAGE_GUTTER_PX * 3}px)`,
        maxHeight: `calc(100% - ${STAGE_GUTTER_PX * 2}px)`
      }}
    >
      <section
        aria-label="Chart"
        className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-mapbox-black-500 text-white shadow-2xl focus:outline-none"
      >
        {children}
      </section>

      {/* Hung off the right edge, as they were on `SideLayout` — the panel's own corners are
          spoken for by the chart header and the legend. */}
      <div className="absolute bottom-12 -right-4 z-20 h-10">
        <ExpandButton isOpen={isExpanded} onClick={() => setIsExpanded((open) => !open)} />
      </div>
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
