import { FC, ReactNode, useState } from "react";

import Header from "../layout/header";
import DeprecatedDomainNotice from "../layout/deprecated-domain-notice";
import CursorReadout from "./cursor-readout";
import DisplayPanel from "./display-panel";
import FloatingChart from "./floating-chart";
import MapControlDock from "./map-control-dock";
import MapEncodingControls from "./map-encoding-controls";
import { STAGE_GUTTER_PX } from "./geometry";
import { useCursorRange } from "./use-cursor-range";
import useCursorHotkeys from "../hooks/use-cursor-hotkeys";

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
 *    └ chrome inset  everything that floats: the chart, and the right-hand control column
 *                    (map controls, then the display panel — see `map-control-dock.tsx`)
 *  cursor readout    the shared cursor, shell chrome rather than chart-internal (§4)
 * ```
 *
 * **§6's first hard constraint — the display panel and the chart competing for edge space — is
 * now answered by one rule instead of two.** The panel used to be a 256px rail down the right
 * edge, and the inset's right edge was pulled in to meet it so that a floating pane could not
 * reach its column. That worked, and it meant opening the panel resized the chart. The panel
 * has moved into the control dock's column, which the chart was already capped short of
 * (`geometry.ts`'s `maxChartWidthPx`), so the inset is a fixed box again and opening the panel
 * moves nothing.
 *
 * §6's second constraint is derived rather than reacted to: dashboard mode renders no display
 * panel at all, and because that is a `&&` and not an effect, there is no state to fall out of
 * step. What dashboard mode does *not* do here is hide the header — the account menu is the
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

  // Left/Right walk the shared cursor. Mounted here rather than inside a chart, which is where
  // it used to live (`pv-remix-chart.tsx`): the shortcut writes `selectedISOTime`, which is the
  // whole shell's state, and hanging it off a pane meant the comparison swap took it away — the
  // arrow keys worked in the forecast view and did nothing in the delta view. The shell is
  // mounted for both, so this is the level the binding's lifetime should match.
  //
  // Limits come from `useCursorRange`, not from the chart's own first/last forecast point. That
  // is the range `ScrubTrack` is drawn against, so the keyboard and the drag handle now agree
  // about where the ends are; they could differ before. It costs no request — `CursorReadout`'s
  // track already calls this hook and the two share the SWR entry.
  useCursorHotkeys(useCursorRange()?.range);

  return (
    // No `pt-14` any more: the header carries no fill, so the map runs edge to edge behind it
    // and the header's four controls float over the floor the way the control dock does. The
    // things that must NOT go under it inset themselves instead — the floating layer and the
    // display rail, both `top-14` below. `Header` still positions itself absolutely, so the
    // pages which are not this one keep laying out unchanged.
    <div
      className={`relative flex min-h-0 flex-1 flex-col${
        dashboardModeActive ? " @container dashboard-mode" : ""
      }`}
    >
      <Header />

      {/* `overflow-hidden` is structural, not cosmetic: the chart's resize handle hangs
          outside its own box, which widens the document and gives the page a horizontal
          scrollbar unless the stage clips it. Clipping here rather than on `body` keeps the
          fix next to the thing that overflows. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0">{map}</div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{ top: `calc(3.5rem - ${STAGE_GUTTER_PX}px)` }}
        >
          <FloatingChart comparisonActive={comparisonActive}>{chart}</FloatingChart>
          <MapControlDock>
            <MapEncodingControls />
            {!dashboardModeActive && (
              <DisplayPanel
                open={displayPanelOpen}
                onToggle={() => setDisplayPanelOpen((open) => !open)}
              />
            )}
          </MapControlDock>
        </div>
      </div>

      <CursorReadout />
      <DeprecatedDomainNotice />
    </div>
  );
};

export default DashboardShell;
