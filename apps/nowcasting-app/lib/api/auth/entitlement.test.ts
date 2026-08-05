import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";

import {
  COUNTRY_CLAIM_KEY,
  COUNTRY_CLAIM_KEY_FALLBACK,
  isDevModeEntitlementBypass,
  isEntitled,
  readCountryClaim
} from "./entitlement";

const originalDevMode = process.env.NEXT_PUBLIC_DEV_MODE;

beforeEach(() => {
  // Every test but the dev-mode ones must run in the deployed configuration.
  process.env.NEXT_PUBLIC_DEV_MODE = "false";
});

afterEach(() => {
  process.env.NEXT_PUBLIC_DEV_MODE = originalDevMode;
});

describe("readCountryClaim", () => {
  test("reads the namespaced claim", () => {
    expect(readCountryClaim({ [COUNTRY_CLAIM_KEY]: ["GB", "NL"] })).toEqual(["GB", "NL"]);
  });

  // The tenant does not enforce namespacing — trial_ends_at is set un-namespaced and works
  // in production — so the Action may land either spelling. Both are read until it does.
  test("reads the un-namespaced claim", () => {
    expect(readCountryClaim({ [COUNTRY_CLAIM_KEY_FALLBACK]: ["GB"] })).toEqual(["GB"]);
  });

  test("prefers the namespaced claim when both are present", () => {
    expect(
      readCountryClaim({
        [COUNTRY_CLAIM_KEY]: ["NL"],
        [COUNTRY_CLAIM_KEY_FALLBACK]: ["GB"]
      })
    ).toEqual(["NL"]);
  });

  test("upper-cases and de-duplicates", () => {
    expect(readCountryClaim({ [COUNTRY_CLAIM_KEY]: ["gb", " nl ", "GB"] })).toEqual(["GB", "NL"]);
  });

  // The claim is not live on the tenant yet, so "absent" is today's normal case, and every
  // malformed shape has to degrade the same way rather than throw inside a render.
  test.each([
    ["neither key present", { trial_ends_at: "2030-01-01" }],
    ["null user", null],
    ["undefined user", undefined],
    ["a string user", "GB"],
    ["a string claim", { [COUNTRY_CLAIM_KEY]: "GB" }],
    ["an object claim", { [COUNTRY_CLAIM_KEY]: { GB: true } }],
    ["a null claim", { [COUNTRY_CLAIM_KEY]: null }],
    ["an empty array", { [COUNTRY_CLAIM_KEY]: [] }]
  ])("degrades to no entitlement for %s", (_label, user) => {
    expect(readCountryClaim(user)).toEqual([]);
  });

  test("drops non-string and empty entries but keeps the rest", () => {
    expect(readCountryClaim({ [COUNTRY_CLAIM_KEY]: ["GB", 42, null, "", "  ", "NL"] })).toEqual([
      "GB",
      "NL"
    ]);
  });
});

describe("isEntitled", () => {
  test.each([
    ["GB", ["GB", "NL"], true],
    ["NL", ["GB", "NL"], true],
    ["DE", ["GB", "NL"], false],
    ["gb", ["GB"], true],
    ["GB", ["gb"], true],
    ["GB", [], false],
    ["", ["GB"], false]
  ])("isEntitled(%p, %p) === %p", (code, claim, expected) => {
    expect(isEntitled(code, claim as string[])).toBe(expected);
  });
});

describe("dev mode", () => {
  // /api/get_token serves a literal FAKE_TOKEN with no session in dev mode, so without the
  // bypass local development shows every country disabled.
  test("entitles everything", () => {
    process.env.NEXT_PUBLIC_DEV_MODE = "true";
    expect(isDevModeEntitlementBypass()).toBe(true);
    expect(isEntitled("DE", [])).toBe(true);
    expect(isEntitled("GB", [])).toBe(true);
  });

  // The bypass must be inert in anything that is not literally "true", so a deployed build
  // with the var unset or misconfigured cannot accidentally entitle everyone.
  test.each([["false"], [""], ["TRUE"], ["1"], [undefined]])(
    "is inert when NEXT_PUBLIC_DEV_MODE is %p",
    (value) => {
      if (value === undefined) delete process.env.NEXT_PUBLIC_DEV_MODE;
      else process.env.NEXT_PUBLIC_DEV_MODE = value;
      expect(isDevModeEntitlementBypass()).toBe(false);
      expect(isEntitled("GB", [])).toBe(false);
    }
  );

  test("does not fabricate a claim — readCountryClaim stays honest", () => {
    process.env.NEXT_PUBLIC_DEV_MODE = "true";
    expect(readCountryClaim({})).toEqual([]);
  });
});
