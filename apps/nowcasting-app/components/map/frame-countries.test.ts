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
import { FRAME_PADDING_PX, unionBounds } from "./frame-countries";

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

  // Symmetric on purpose: the union of the countries in play is taller than it is wide, so the
  // fit is limited by height and side padding only costs zoom. See the note in the module.
  test("the padding is one number, so every side gets the same", () => {
    expect(typeof FRAME_PADDING_PX).toBe("number");
    expect(FRAME_PADDING_PX).toBeGreaterThan(0);
  });
});
