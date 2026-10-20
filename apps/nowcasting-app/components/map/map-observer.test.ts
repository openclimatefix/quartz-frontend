import { describe, expect, test } from "@jest/globals";
import { resolveMapObserver } from "./map-observer";
import type { GenerationSourceCapability } from "../../lib/domain/types";

const IN_DAY: GenerationSourceCapability = {
  source: "solar",
  name: "pvlive_in_day",
  label: "PV Live Estimated"
};
const DAY_AFTER: GenerationSourceCapability = {
  source: "solar",
  name: "pvlive_day_after",
  label: "PV Live Updated"
};
const NED: GenerationSourceCapability = { source: "solar", name: "ned_nl", label: "NED" };

describe("resolveMapObserver", () => {
  test("takes the country's configured observer, not the manifest's first entry", () => {
    // The assertion that separates "chosen" from "whatever came back first": GB's configured
    // observer is served first today, so ordering alone cannot distinguish the two
    // implementations. Reversing the manifest is what does — the old `[0]` returns Updated
    // here and repaints every delta on the map, with nothing in any diff to explain it.
    expect(resolveMapObserver("GB", [DAY_AFTER, IN_DAY])).toBe(IN_DAY);
  });

  test("GB is PV Live Estimated in manifest order too — the pre-existing behaviour", () => {
    expect(resolveMapObserver("GB", [IN_DAY, DAY_AFTER])).toBe(IN_DAY);
  });

  test("NL resolves its single observer", () => {
    expect(resolveMapObserver("NL", [NED])).toBe(NED);
  });

  test("falls back to the first entry when the configured observer is not served", () => {
    // Never return the configured name unmatched: `useMapRegionValues` passes whatever comes
    // back straight to `/generation/period`, and an observer the country does not have is a
    // 400 ("Observer 'pvlive_in_day' is not available for NL solar"), i.e. a blank map. The
    // label travels with the fallback, so the popup and legend name what was really used.
    expect(resolveMapObserver("NL", [NED, DAY_AFTER])).toBe(NED);
    expect(resolveMapObserver("GB", [NED])).toBe(NED);
  });

  test("an unconfigured country still gets the manifest's first entry", () => {
    expect(resolveMapObserver("DE", [DAY_AFTER, IN_DAY])).toBe(DAY_AFTER);
  });

  test("is undefined until the manifest lands, so the fetch can be held", () => {
    // `undefined` and `[]` are both "not known yet" — the caller passes no `observer` and
    // makes no request, rather than letting the API default fire (which is GB's in-day
    // observer, and 400s for every other country).
    expect(resolveMapObserver("GB", undefined)).toBeUndefined();
    expect(resolveMapObserver("GB", [])).toBeUndefined();
  });
});
