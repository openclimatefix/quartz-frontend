import { FC, ReactNode, useState } from "react";

import Header from "../layout/header";
import DeprecatedDomainNotice from "../layout/deprecated-domain-notice";
import CursorReadout from "./cursor-readout";
import DisplayPanel from "./display-panel";
import FloatingChart from "./floating-chart";
import MapControlDock from "./map-control-dock";
import MapEncodingControls from "./map-encoding-controls";
import { RAIL_WIDTH_PX } from "./geometry";

/**
 * The dashboard shell — the map is the ground, everything else floats on it.
 *
 * Phase 6 §3. What this replaces is the arrangement described in the contract's opening: three
 * maps mounted at once inside `#map-container`, three charts inside `SideLayout`, and views
 * toggled with a `hidden` class across a hardcoded 50/50 split. **One map and one chart are
 * mounted here**, chosen by the comparison state, which is what lets `use-map-chrome` lose two
 * of its three effects: nothing is hidden-but-alive any more.
 *
 * The layout is three rows and one overlay set:
 *
 * ```
 *  header            navigation — what you are looking at (§6)
 *  stage             the map, full bleed, with the chrome inset over it
 *    └ chrome inset  everything that floats: the chart, the map control dock
 *    └ display rail  how it is drawn (§6), overlaying the map's right edge
 *  cursor readout    the shared cursor, shell chrome rather than chart-internal (§4)
 * ```
 *
 * **The chrome inset is the whole answer to §6's first hard constraint.** The rail and the
 * floating chart compete for edge space; rather than letting them overlap and sorting it out
 * with `z-index`, the inset's right edge *is* the rail's left edge, so a floating pane has no
 * way to reach the rail's column. That holds for the drag override when it lands (OPEN 5) —
 * the drag is bounded by the same box — and it is why neither the chart nor the dock takes a
 * rail-width prop.
 *
 * §6's second constraint is derived rather than reacted to: dashboard mode collapses the rail
 * to nothing, and because `railOpen` is a `&&` and not an effect, there is no state to fall out
 * of step. What dashboard mode does *not* do here is hide the header — the account menu is the
 * only way back out of dashboard mode, and the prototype's separate exit affordance is out of
 * scope for this track.
 */
const DashboardShell: FC<{
  dashboardModeActive: boolean;
  comparisonActive: boolean;
  map: ReactNode;
  chart: ReactNode;
}> = ({ dashboardModeActive, comparisonActive, map, chart }) => {
  const [displayPanelOpen, setDisplayPanelOpen] = useState(false);
  const railOpen = displayPanelOpen && !dashboardModeActive;

  return (
    // `pt-16` reserves the header's height: `Header` positions itself absolutely, as it always
    // has, so that the pages which are not this one keep laying out unchanged.
    <div
      className={`relative flex min-h-0 flex-1 flex-col pt-16${
        dashboardModeActive ? " @container dashboard-mode" : ""
      }`}
    >
      <Header />

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">{map}</div>

        <div
          className="pointer-events-none absolute inset-y-0 left-0 transition-[right] duration-300"
          style={{ right: railOpen ? RAIL_WIDTH_PX : 0 }}
        >
          <FloatingChart comparisonActive={comparisonActive}>{chart}</FloatingChart>
          <MapControlDock>
            <MapEncodingControls />
          </MapControlDock>
        </div>

        <DisplayPanel open={railOpen} onToggle={() => setDisplayPanelOpen((open) => !open)} />
      </div>

      <CursorReadout />
      <DeprecatedDomainNotice />
    </div>
  );
};

export default DashboardShell;
