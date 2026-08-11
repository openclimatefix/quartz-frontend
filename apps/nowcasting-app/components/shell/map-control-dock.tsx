import { FC, ReactNode } from "react";

import { MAP_CONTROL_WIDTH_PX, MAP_TOP_ROW_RESERVE_PX, STAGE_GUTTER_PX } from "./geometry";

/**
 * Where the map's own controls live. **This is Track E's mount point** — moved corner by the
 * Phase 6 followup (Track G), see `geometry.ts`'s `MAP_TOP_ROW_RESERVE_PX`.
 *
 * Contract §5 puts comparison and unit on the map rather than in the display panel, because
 * they answer "what does the colour mean?" — the colour guide's own subject — and turning a
 * comparison on changes the map's entire encoding while changing the chart by one series.
 * Wave 3 merges `color-guide-bar` and `delta-color-guide-bar` into one control that selects
 * the encoding and then explains it, with `measuringUnit` alongside; all of that happens
 * inside `map-encoding-controls.tsx`, which this dock renders and nothing else positions.
 *
 * The dock is the shell's half of that seam:
 *
 * - it is rendered inside the chrome inset, so it never collides with the display rail —
 *   true whichever corner it sits in, since the inset's right edge is the rail's left edge
 *   either way (`dashboard-shell.tsx`'s doc comment);
 * - **it now sits top-right**, not bottom-right — Brad's live-pass ask, to consolidate with
 *   the map's own Clouds/PV layer toggles (`map.tsx`, forecast map only), which already render
 *   top-right via `justify-end`. `MAP_TOP_ROW_RESERVE_PX` clears that row without this file
 *   reading `map.tsx`, which is not owned here; see that constant's doc comment for why the
 *   merge stops at "same corner, stacked" rather than one interleaved row;
 * - it keeps a fixed column width, which is what lets the floating chart cap itself short of
 *   the cluster — that cap moved from the chart's width to its height when the cluster moved
 *   corners (`CHART_TOP_CLEARANCE_PX`, `floating-chart.tsx`);
 * - it establishes the positioning context, so its contents lay out in normal flow. A control
 *   that positions itself absolutely against the *map* — as both guide bars still do — has
 *   not moved in here yet.
 *
 * §6a is worth knowing before adding to it: the cluster is already about as deep as the corner
 * takes, and one more control wants it to become a popover rather than an always-open panel.
 */
const MapControlDock: FC<{ children: ReactNode }> = ({ children }) => (
  <div
    className="pointer-events-auto absolute z-[15] flex flex-col gap-2"
    style={{
      right: STAGE_GUTTER_PX,
      top: MAP_TOP_ROW_RESERVE_PX,
      width: MAP_CONTROL_WIDTH_PX
    }}
  >
    {children}
  </div>
);

export default MapControlDock;
