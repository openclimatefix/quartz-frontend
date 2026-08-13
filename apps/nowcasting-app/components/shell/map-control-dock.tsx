import { FC, ReactNode } from "react";

import { MAP_CONTROL_WIDTH_PX, STAGE_GUTTER_PX } from "./geometry";

/**
 * Where the map's own controls live — the whole of them, now. Track G moved this dock
 * top-right and stacked it below `map.tsx`'s own Clouds/PV layer-toggle row, because `map.tsx`
 * was off-limits to that track. The Phase 6 followup (Track I) finishes it: those buttons
 * moved out of `map.tsx` into `map-layer-controls.tsx`, which mounts *inside*
 * `map-encoding-controls.tsx` (behind a "more settings" disclosure — see that file). There is
 * one box in this corner now, not two stacked ones, which is what Brad asked for twice
 * ("consolidate ... into one panel").
 *
 * Contract §5 puts comparison and unit on the map rather than in the display panel, because
 * they answer "what does the colour mean?" — the colour guide's own subject — and turning a
 * comparison on changes the map's entire encoding while changing the chart by one series.
 * `color-guide-bar` and `delta-color-guide-bar` are one control that selects the encoding and
 * then explains it, with `measuringUnit` alongside; all of that happens inside
 * `map-encoding-controls.tsx`, which this dock renders and nothing else positions.
 *
 * The dock is the shell's half of that seam:
 *
 * - it is rendered inside the chrome inset, so it never collides with the display rail —
 *   true whichever corner it sits in, since the inset's right edge is the rail's left edge
 *   either way (`dashboard-shell.tsx`'s doc comment);
 * - it anchors top-right, `STAGE_GUTTER_PX` from both edges — now that the panel is the only
 *   thing in the corner, there is no second row above it to clear, so the old
 *   `MAP_TOP_ROW_RESERVE_PX` top offset is gone;
 * - it keeps a fixed column width, which is what lets the floating chart cap itself short of
 *   the panel — that cap is the panel's height, not its width, since the chart shares the
 *   panel's right-hand side rather than its bottom edge (`CHART_TOP_CLEARANCE_PX`,
 *   `floating-chart.tsx`);
 * - it establishes the positioning context, so its contents lay out in normal flow. A control
 *   that positions itself absolutely against the *map* — as both guide bars still do — has
 *   not moved in here yet.
 *
 * §6a is worth knowing before adding to it further: `map-encoding-controls.tsx`'s own
 * disclosure is the answer this track chose to "the corner is at its limit" rather than a
 * popover — see that file's doc comment for the always-visible/collapsible split and why.
 */
const MapControlDock: FC<{ children: ReactNode }> = ({ children }) => (
  <div
    className="pointer-events-auto absolute z-[15] flex flex-col gap-2"
    style={{
      right: STAGE_GUTTER_PX,
      top: STAGE_GUTTER_PX,
      width: MAP_CONTROL_WIDTH_PX
    }}
  >
    {children}
  </div>
);

export default MapControlDock;
