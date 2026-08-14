import { describe, expect, it } from "@jest/globals";

import { formatRegionLabel } from "./region-label";

/**
 * The casing rule for region names the API serves without a `full_name`.
 *
 * The cases that matter are the ones where a naive implementation is wrong: hyphenated
 * compounds (half of NL's provinces), labels that already read correctly, and the default
 * doing nothing at all so no existing country is touched by this rule existing.
 */
describe("formatRegionLabel", () => {
  it("leaves a label alone by default, so a region type that has not opted in is untouched", () => {
    expect(formatRegionLabel("citr_1")).toBe("citr_1");
    expect(formatRegionLabel("City Road")).toBe("City Road");
  });

  it("capitalises a single-word province", () => {
    expect(formatRegionLabel("drenthe", "titleCase")).toBe("Drenthe");
    expect(formatRegionLabel("utrecht", "titleCase")).toBe("Utrecht");
  });

  it("capitalises across a hyphen, not just the first word", () => {
    // "Noord-brabant" reads as a typo; the hyphen is a word boundary in Dutch place names.
    expect(formatRegionLabel("noord-brabant", "titleCase")).toBe("Noord-Brabant");
    expect(formatRegionLabel("zuid-holland", "titleCase")).toBe("Zuid-Holland");
    expect(formatRegionLabel("noord-holland", "titleCase")).toBe("Noord-Holland");
  });

  it("capitalises across whitespace and preserves the separator", () => {
    expect(formatRegionLabel("north west england", "titleCase")).toBe("North West England");
  });

  it("leaves the rest of a word as it came, rather than lowercasing it", () => {
    // A general title-case would rewrite these to "Ukpn" and "Mcallister". The rule only ever
    // raises the first letter, because it cannot know which internal capitals are deliberate.
    expect(formatRegionLabel("UKPN", "titleCase")).toBe("UKPN");
    expect(formatRegionLabel("McAllister", "titleCase")).toBe("McAllister");
  });

  it("handles an absent label without producing 'undefined'", () => {
    expect(formatRegionLabel(undefined, "titleCase")).toBe("");
    expect(formatRegionLabel(null, "titleCase")).toBe("");
    expect(formatRegionLabel("", "titleCase")).toBe("");
  });
});
