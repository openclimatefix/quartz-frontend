import { FC, ReactNode } from "react";

import useGlobalState, { useCountryState } from "../helpers/globalState";
import { ResetIcon } from "../icons/icons";

/**
 * Zoom and reset-framing, as dock children rather than as Mapbox controls.
 *
 * These were `map.current.addControl(…, "bottom-right")`. Mapbox puts anything added that way
 * into `.mapboxgl-ctrl-bottom-right` — `position: absolute` against the *map*, with each control
 * floated and carrying a hard-coded `margin: 0 10px 10px 0`. Nothing in the React tree lays that
 * out, which had two consequences worth recording, because they are the reason this file exists:
 *
 * - **Nothing in the shell could align with them.** The zone stack landed on top of the reset
 *   button, and the only fix available was to teach the shell Mapbox's geometry — a pair of
 *   constants in `geometry.ts` reproducing the 29px button and the 10px gutter, correct until
 *   Mapbox changes either. Moving one then moved only one, because the card and the buttons were
 *   in different coordinate systems.
 * - **The reset button was imperative DOM.** It was built once inside the map-init effect, so it
 *   was shown and hidden by writing `style.display` on a retained `div`, and its click handler
 *   had to read through a ref because everything it closed over was frozen at mount.
 *
 * In the dock both go away. These lay out in the same flex column as the zone stack and the
 * encoding panel, so they align by construction and the geometry constants are gone;
 * `mapFramingModified` is state, so reset appears and disappears by rendering.
 *
 * The attribution stays Mapbox's and stays in that corner — it is a terms requirement that it
 * sits on the map, and `geometry.ts` keeps the one reserve that survives for it.
 */

/**
 * The last map to have mounted.
 *
 * `maps` is append-only — `map.tsx` pushes on mount and nothing ever removes — so an earlier
 * entry can be a dead instance left by a remount. The newest is the live one. (Fixing the
 * accumulation properly is `map.tsx`'s business, not this file's.)
 */
const useActiveMap = () => {
  const [maps] = useGlobalState("maps");
  return maps.length ? maps[maps.length - 1] : undefined;
};

/**
 * `surface-panel` ground, `surface-raised` on hover — the one-step lift `tokens.css` defines for
 * every interactive control, and the same plane the dock's other cards sit on. `rounded-lg` to
 * match those cards; Mapbox's own 4px read as a different family of object beside them.
 */
const GROUP_CLASS =
  "ml-auto flex w-fit flex-col overflow-hidden rounded-lg border border-content/10 bg-surface-panel/95 shadow-2xl";

const BUTTON_CLASS =
  "flex h-8 w-8 items-center justify-center text-interactive transition-colors hover:bg-surface-raised hover:text-content disabled:cursor-not-allowed disabled:text-content-muted disabled:opacity-30 disabled:hover:bg-transparent";

const ControlButton: FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}> = ({ label, onClick, disabled, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={BUTTON_CLASS}
  >
    {children}
  </button>
);

const MapZoomControls: FC = () => {
  const map = useActiveMap();
  const [mapFramingModified] = useGlobalState("mapFramingModified");
  const [resetMapFraming] = useGlobalState("resetMapFraming");
  // Not read for its value — it is the render trigger. `map.tsx` writes it on `moveend`, which
  // is what re-evaluates the two limit checks below; reading the zoom off the map alone would
  // leave the buttons stuck enabled at the ends of the range.
  const [zoom] = useCountryState("zoom");

  if (!map) return null;

  const atMax = zoom >= map.getMaxZoom();
  const atMin = zoom <= map.getMinZoom();
  const canReset = mapFramingModified && !!resetMapFraming;

  return (
    // `mt-auto` bottom-aligns this *and* everything after it in the dock: the column is a
    // full-height flex, so the first bottom-anchored child absorbs the free space and the zone
    // stack below simply follows in the gap. That is the whole of "the buttons and the card move
    // together" — one auto margin, at the top of the group, instead of two sets of clearances.
    //
    // Reset sits beside the zoom pair, level with zoom out, where it used to stack above it:
    // the dock's height is the scarce thing. Zoom stays at the right edge whether or not reset is
    // showing, so its appearing never moves a button someone is reaching for.
    <div className="ml-auto mt-auto flex w-fit flex-row items-end gap-2">
      {canReset && (
        <div className={GROUP_CLASS}>
          <ControlButton label="Reset zoom" onClick={() => resetMapFraming!.run()}>
            <span className="h-3.5 w-3.5">
              <ResetIcon />
            </span>
          </ControlButton>
        </div>
      )}
      <div className={GROUP_CLASS}>
        <ControlButton label="Zoom in" onClick={() => map.zoomIn()} disabled={atMax}>
          {/* Drawn rather than imported. These were `background-image` data URIs with Mapbox's
              own fill baked in, which `globals.css` had to override with a hand-copied `#FFFBF5`
              literal — a data URI cannot read a CSS variable, so the oat had to be maintained in
              two places and nothing would report it missed. On `currentColor` it just follows
              `--interactive`. */}
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" fill="currentColor" />
          </svg>
        </ControlButton>
        <div className="h-px w-full bg-content/10" />
        <ControlButton label="Zoom out" onClick={() => map.zoomOut()} disabled={atMin}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path d="M5 11h14v2H5z" fill="currentColor" />
          </svg>
        </ControlButton>
      </div>
    </div>
  );
};

export default MapZoomControls;
