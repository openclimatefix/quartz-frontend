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

/**
 * Breathing room around the framed countries, every side equal.
 *
 * It used to be asymmetric: the left and right padding were *measured* from the floating chart
 * and the control panel, so the countries were centred in the visible gap between them rather
 * than on the canvas. That was correct in the general case and wrong for this one (Brad,
 * 2026-08-17) — GB and NL are tall relative to their width and sit side by side, so the union is
 * a portrait-ish box whose fit is limited by *height*, not width. Padding the sides therefore
 * bought nothing and cost zoom, and the countries ended up smaller than they needed to be while
 * the space above and below them went unused.
 *
 * Keeping this symmetric also removes the effect's DOM read, so framing no longer depends on the
 * chart and panel having been laid out first.
 */
export const FRAME_PADDING_PX = 40;

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
