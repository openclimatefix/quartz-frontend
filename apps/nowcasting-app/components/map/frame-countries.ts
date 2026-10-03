import { getCountryConfig } from "../../config/countries";

/**
 * The camera framing shared by the two things that move the map on their own: the effect that
 * re-frames when a country is toggled, and the "Reset Zoom" button.
 *
 * They used to compute different views. The effect fitted the *union of the enabled countries'
 * bounds*; the button flew to `{ center: [lng, lat], zoom }` — country-scoped global state read
 * through the map-init closure, so in practice the registry defaults for whichever country was
 * focused when the map mounted. With one country enabled those two nearly agree, which is why it
 * read as a slight disagreement rather than an obvious bug; with two they are different views of
 * different extents, and the button's was frozen at mount besides.
 *
 * Reset now means "the view you were given", not "a remembered centre and zoom", so it is this
 * function in both places and the two cannot drift.
 */

/** `[west, south, east, north]`, the order `CountryConfig.map.bounds` and Mapbox both use. */
export type Bounds = readonly [number, number, number, number];

/** Breathing room between the framed countries and whatever bounds them. */
export const FRAME_PADDING_PX = 40;

/** The narrowest strip the countries may be squeezed into before padding is scaled back. */
export const MIN_FRAMED_WIDTH_PX = 240;

export type FramePadding = { top: number; bottom: number; left: number; right: number };

/**
 * Padding for the fit — asymmetric, because only one side is actually in the way.
 *
 * **The floating chart is compensated for.** It is a wide opaque panel over the left of the
 * stage, so framing on the whole canvas centres the countries underneath it: half the map is
 * behind the chart and the right of the stage sits empty. Padding by the chart's measured width
 * centres them in the gap it leaves instead.
 *
 * **The map control panel is not** (Brad, 2026-08-17). It occupies the top *right*, and given
 * the shape and position of the countries actually being forecast — tall relative to their
 * width, and sitting to the west of it — nothing lands under it that pushing the fit would
 * rescue. Paying for it in zoom made the countries smaller for no gain.
 *
 * Measured rather than derived from a constant: the chart's size has been the user's since
 * drag-resize landed, so there is no constant left to read. A missing element — the sites route,
 * an early frame before layout — contributes no padding rather than a guess.
 */
export const framePadding = (chartWidthPx: number, canvasWidthPx: number): FramePadding => {
  const wanted = chartWidthPx > 0 ? Math.round(chartWidthPx + FRAME_PADDING_PX) : FRAME_PADDING_PX;
  // Never let padding swallow the viewport: Mapbox throws outright if padding exceeds the
  // canvas, and a narrow window with a full-width chart can genuinely ask for that.
  const budget = Math.max(0, canvasWidthPx - MIN_FRAMED_WIDTH_PX - FRAME_PADDING_PX);

  return {
    top: FRAME_PADDING_PX,
    bottom: FRAME_PADDING_PX,
    left: Math.min(wanted, budget),
    right: FRAME_PADDING_PX
  };
};

/**
 * The smallest box containing every named country, or `null` if none of them is in the registry.
 *
 * Unconfigured codes are skipped rather than treated as empty: a country the manifest serves but
 * this build has no entry for has no boundaries to frame, and letting it contribute a degenerate
 * box at (0, 0) would drag the camera into the Atlantic.
 */
export const unionBounds = (codes: readonly string[]): Bounds | null => {
  const boxes = codes
    .map((code) => getCountryConfig(code)?.map.bounds)
    .filter((box): box is [number, number, number, number] => box !== undefined);

  if (boxes.length === 0) return null;

  return boxes.reduce<Bounds>(
    (acc, box) => [
      Math.min(acc[0], box[0]),
      Math.min(acc[1], box[1]),
      Math.max(acc[2], box[2]),
      Math.max(acc[3], box[3])
    ],
    boxes[0]
  );
};
