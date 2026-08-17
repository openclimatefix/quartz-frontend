/**
 * The camera framing's arithmetic — the half of it that can be tested without a live Mapbox
 * instance, which is the half that decides where the camera goes.
 *
 * This exists because framing is silent-plausible: a union computed slightly wrong still
 * produces a map centred on roughly the right part of Europe, and nobody notices until a country
 * sits half off-screen.
 */
import { describe, expect, test } from "@jest/globals";

import { COUNTRY_CONFIG } from "../../config/countries";
import {
  FRAME_PADDING_PX,
  MIN_FRAMED_WIDTH_PX,
  framePadding,
  unionBounds
} from "./frame-countries";

describe("unionBounds", () => {
  test("one country frames exactly its own bounds", () => {
    expect(unionBounds(["GB"])).toEqual(COUNTRY_CONFIG.GB.map.bounds);
  });

  test("two countries frame the smallest box holding both", () => {
    const gb = COUNTRY_CONFIG.GB.map.bounds;
    const nl = COUNTRY_CONFIG.NL.map.bounds;

    expect(unionBounds(["GB", "NL"])).toEqual([
      Math.min(gb[0], nl[0]),
      Math.min(gb[1], nl[1]),
      Math.max(gb[2], nl[2]),
      Math.max(gb[3], nl[3])
    ]);
  });

  test("order does not change the box", () => {
    expect(unionBounds(["NL", "GB"])).toEqual(unionBounds(["GB", "NL"]));
  });

  // The manifest serves every country the API knows, including ones this build has no registry
  // entry for. A missing entry has no boundaries to frame; contributing a degenerate box at
  // (0, 0) would drag the camera into the Atlantic and take the real countries with it.
  test("a country the registry does not know contributes nothing", () => {
    expect(unionBounds(["GB", "ZZ"])).toEqual(unionBounds(["GB"]));
  });

  test("no framable country at all is null, not a box at the origin", () => {
    expect(unionBounds([])).toBeNull();
    expect(unionBounds(["ZZ"])).toBeNull();
  });
});

describe("framePadding", () => {
  const CANVAS = 1200;

  // The chart is a wide opaque panel over the left of the stage. Framing on the whole canvas
  // centres the countries underneath it; padding by its width centres them in the gap it leaves.
  test("pads the left by the chart's width plus a gutter", () => {
    expect(framePadding(400, CANVAS)).toEqual({
      top: FRAME_PADDING_PX,
      bottom: FRAME_PADDING_PX,
      left: 400 + FRAME_PADDING_PX,
      right: FRAME_PADDING_PX
    });
  });

  // The control panel sits top-right, and nothing lands under it that pushing the fit would
  // rescue — paying for it in zoom made the countries smaller for no gain.
  test("does not compensate for the right-hand control panel", () => {
    expect(framePadding(400, CANVAS).right).toBe(FRAME_PADDING_PX);
  });

  // The sites route has no chart, and neither does an early frame before layout.
  test("no chart on the page means a plain gutter, not a guess", () => {
    expect(framePadding(0, CANVAS).left).toBe(FRAME_PADDING_PX);
  });

  // Mapbox throws outright if padding exceeds the canvas, and a narrow window with a full-width
  // chart genuinely asks for that. The countries keep a strip to be drawn in.
  test("never lets the chart's padding swallow the viewport", () => {
    const narrow = framePadding(900, 500);
    expect(narrow.left + narrow.right).toBeLessThanOrEqual(500 - MIN_FRAMED_WIDTH_PX);
    expect(narrow.left).toBeGreaterThanOrEqual(0);
  });

  test("a canvas narrower than the minimum strip still yields non-negative padding", () => {
    const tiny = framePadding(900, 100);
    expect(tiny.left).toBe(0);
    expect(tiny.right).toBe(FRAME_PADDING_PX);
  });
});
