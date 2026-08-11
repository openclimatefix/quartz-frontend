import { FC, ReactNode } from "react";

import { MAP_CONTROL_WIDTH_PX, STAGE_GUTTER_PX } from "./geometry";

/**
 * Where the map's own controls live. **This is Track E's mount point.**
 *
 * Contract §5 puts comparison and unit on the map rather than in the display panel, because
 * they answer "what does the colour mean?" — the colour guide's own subject — and turning a
 * comparison on changes the map's entire encoding while changing the chart by one series.
 * Wave 3 merges `color-guide-bar` and `delta-color-guide-bar` into one control that selects
 * the encoding and then explains it, with `measuringUnit` alongside; all of that happens
 * inside `map-encoding-controls.tsx`, which this dock renders and nothing else positions.
 *
 * The dock is the shell's half of that seam and stays put:
 *
 * - it is rendered inside the chrome inset, so it never collides with the display rail;
 * - it sits bottom-right with a fixed column width, which is what lets the floating chart cap
 *   its own width and guarantee it can never cover the cluster (see `geometry.ts`);
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
      bottom: STAGE_GUTTER_PX,
      width: MAP_CONTROL_WIDTH_PX
    }}
  >
    {children}
  </div>
);

export default MapControlDock;
