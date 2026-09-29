import { describe, expect, test } from "@jest/globals";
import {
  PRODUCTS_CLAIM_KEY,
  PRODUCTS_CLAIM_KEY_NAMESPACED,
  readProductsClaim
} from "./statusProducts";

describe("readProductsClaim", () => {
  test("reads the bare spelling that is set on the dev tenant", () => {
    expect(readProductsClaim({ [PRODUCTS_CLAIM_KEY]: ["gb-solar", "nl-solar"] })).toEqual([
      "gb-solar",
      "nl-solar"
    ]);
  });

  test("reads the namespaced spelling too", () => {
    // The whole point of the dual read: Auth0 silently drops non-namespaced custom claims
    // added by an Action, so the bare spelling may not survive and we cannot tell from here.
    expect(readProductsClaim({ [PRODUCTS_CLAIM_KEY_NAMESPACED]: ["asset-solar"] })).toEqual([
      "asset-solar"
    ]);
  });

  test("prefers the bare spelling when a token somehow carries both", () => {
    expect(
      readProductsClaim({
        [PRODUCTS_CLAIM_KEY]: ["gb-solar"],
        [PRODUCTS_CLAIM_KEY_NAMESPACED]: ["nl-solar"]
      })
    ).toEqual(["gb-solar"]);
  });

  test("normalises casing and whitespace, and drops empties", () => {
    expect(readProductsClaim({ products: [" GB-Solar ", "", "   "] })).toEqual(["gb-solar"]);
  });

  test("de-duplicates, since downstream this is a membership set", () => {
    expect(readProductsClaim({ products: ["gb-solar", "GB-SOLAR"] })).toEqual(["gb-solar"]);
  });

  test("degrades to nothing entitled rather than throwing", () => {
    // A missing or malformed claim must never crash a session. It fails closed, which is why
    // the switch-over needs a real token decoded first — this is silent by design.
    expect(readProductsClaim(null)).toEqual([]);
    expect(readProductsClaim(undefined)).toEqual([]);
    expect(readProductsClaim("gb-solar")).toEqual([]);
    expect(readProductsClaim({})).toEqual([]);
    expect(readProductsClaim({ products: "gb-solar" })).toEqual([]);
    expect(readProductsClaim({ products: [1, null, {}] })).toEqual([]);
  });

  test("leaves unregistered keys in — intersecting is the caller's job", () => {
    expect(readProductsClaim({ products: ["de-solar"] })).toEqual(["de-solar"]);
  });
});
