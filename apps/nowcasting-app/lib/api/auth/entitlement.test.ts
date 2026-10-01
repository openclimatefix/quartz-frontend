import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

import * as countriesConfig from "../../../config/countries";
import {
  COUNTRY_CLAIM_KEY,
  EntitlementClaim,
  PRODUCTS_CLAIM_KEY,
  PRODUCTS_CLAIM_KEY_NAMESPACED,
  entitledCountryCodes,
  isDevModeEntitlementBypass,
  isEntitled,
  isOcfAdmin,
  OCF_ADMIN_PRODUCT_KEY,
  readCountryClaim,
  readEntitlementClaim,
  readProductsClaim
} from "./entitlement";

const byCountries = (countries: string[]): EntitlementClaim => ({ source: "countries", countries });
const byProducts = (products: string[]): EntitlementClaim => ({ source: "products", products });

const originalDevMode = process.env.NEXT_PUBLIC_DEV_MODE;

beforeEach(() => {
  // Every test but the dev-mode ones must run in the deployed configuration.
  process.env.NEXT_PUBLIC_DEV_MODE = "false";
});

afterEach(() => {
  process.env.NEXT_PUBLIC_DEV_MODE = originalDevMode;
});

describe("readCountryClaim", () => {
  test("reads the plain `countries` claim", () => {
    expect(readCountryClaim({ countries: ["GB", "NL"] })).toEqual(["GB", "NL"]);
  });

  test("ignores the namespaced spelling, which the Action does not set", () => {
    expect(readCountryClaim({ "https://quartz.solar/countries": ["GB"] })).toEqual([]);
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

// The changeover fallback: the `countries` rule unchanged, but for the claim now arriving
// wrapped as `{ source: "countries" }`.
describe("isEntitled by the countries claim", () => {
  test.each([
    ["GB", ["GB", "NL"], true],
    ["NL", ["GB", "NL"], true],
    ["DE", ["GB", "NL"], false],
    ["gb", ["GB"], true],
    ["GB", ["gb"], true],
    ["GB", [], false],
    ["", ["GB"], false]
  ])("isEntitled(%p, %p) === %p", (code, claim, expected) => {
    expect(isEntitled(code, byCountries(claim as string[]))).toBe(expected);
  });
});

describe("dev mode", () => {
  // /api/get_token serves a literal FAKE_TOKEN with no session in dev mode, so without the
  // bypass local development shows every country disabled.
  test("entitles everything", () => {
    process.env.NEXT_PUBLIC_DEV_MODE = "true";
    expect(isDevModeEntitlementBypass()).toBe(true);
    expect(isEntitled("DE", byCountries([]))).toBe(true);
    expect(isEntitled("GB", byProducts([]))).toBe(true);
    expect(entitledCountryCodes({})).toEqual(countriesConfig.configuredCountryCodes());
  });

  // The bypass must be inert in anything that is not literally "true", so a deployed build
  // with the var unset or misconfigured cannot accidentally entitle everyone.
  test.each([["false"], [""], ["TRUE"], ["1"], [undefined]])(
    "is inert when NEXT_PUBLIC_DEV_MODE is %p",
    (value) => {
      if (value === undefined) delete process.env.NEXT_PUBLIC_DEV_MODE;
      else process.env.NEXT_PUBLIC_DEV_MODE = value;
      expect(isDevModeEntitlementBypass()).toBe(false);
      expect(isEntitled("GB", byCountries([]))).toBe(false);
      expect(isEntitled("GB", byProducts([]))).toBe(false);
    }
  );

  test("does not fabricate a claim — readCountryClaim stays honest", () => {
    process.env.NEXT_PUBLIC_DEV_MODE = "true";
    expect(readCountryClaim({})).toEqual([]);
    expect(readProductsClaim({})).toEqual([]);
  });
});

// Moved from config/statusProducts.test.ts with the function.
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

describe("isEntitled by the products claim", () => {
  test.each([
    ["GB", ["gb-solar"], true],
    ["NL", ["gb-solar"], false],
    ["NL", ["gb-solar", "nl-solar"], true],
    ["DE", ["de-solar"], true],
    ["gb", ["gb-solar"], true],
    ["GB", ["GB-SOLAR"], true],
    ["GB", [], false],
    ["", ["gb-solar"], false],
    // No registry entry, so no product to match, whatever the claim says.
    ["FR", ["fr-solar"], false]
  ])("isEntitled(%p, %p) === %p", (code, products, expected) => {
    expect(isEntitled(code, byProducts(products as string[]))).toBe(expected);
  });

  test("a configured country with no product is not entitled", () => {
    const gb = countriesConfig.getCountryConfig("GB");
    const spy = jest
      .spyOn(countriesConfig, "getCountryConfig")
      .mockImplementation((code) => (code === "GB" && gb ? { ...gb, product: undefined } : gb));
    try {
      expect(isEntitled("GB", byProducts(["gb-solar"]))).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("readEntitlementClaim and entitledCountryCodes", () => {
  test("entitle each configured country whose product the claim contains", () => {
    expect(entitledCountryCodes({ [PRODUCTS_CLAIM_KEY]: ["nl-solar"] })).toEqual(["NL"]);
    expect(
      entitledCountryCodes({ [PRODUCTS_CLAIM_KEY]: ["gb-solar", "nl-solar", "de-solar"] })
    ).toEqual(["GB", "NL", "DE"]);
  });

  test("match product keys regardless of case", () => {
    expect(entitledCountryCodes({ [PRODUCTS_CLAIM_KEY]: [" NL-Solar "] })).toEqual(["NL"]);
  });

  test("read the namespaced products key", () => {
    expect(entitledCountryCodes({ [PRODUCTS_CLAIM_KEY_NAMESPACED]: ["gb-solar"] })).toEqual(["GB"]);
  });

  test("a non-empty products claim decides alone, ignoring the countries claim", () => {
    const user = { [PRODUCTS_CLAIM_KEY]: ["nl-solar"], [COUNTRY_CLAIM_KEY]: ["GB", "DE"] };
    expect(readEntitlementClaim(user)).toEqual(byProducts(["nl-solar"]));
    expect(entitledCountryCodes(user)).toEqual(["NL"]);
  });

  test("no products claim falls back to the countries claim", () => {
    expect(readEntitlementClaim({ [COUNTRY_CLAIM_KEY]: ["gb"] })).toEqual(byCountries(["GB"]));
    expect(entitledCountryCodes({ [COUNTRY_CLAIM_KEY]: ["GB", "NL"] })).toEqual(["GB", "NL"]);
  });

  test("an empty products claim falls back to the countries claim", () => {
    const user = { [PRODUCTS_CLAIM_KEY]: [], [COUNTRY_CLAIM_KEY]: ["NL"] };
    expect(readEntitlementClaim(user)).toEqual(byCountries(["NL"]));
    expect(entitledCountryCodes(user)).toEqual(["NL"]);
  });

  // The owner needs to know this before configuring Auth0: a user granted only non-country
  // products has a products claim, so the countries claim is not consulted.
  test("a products claim of only products no country has entitles nothing, with no fallback", () => {
    const user = { [PRODUCTS_CLAIM_KEY]: ["asset-solar"], [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    expect(readEntitlementClaim(user)).toEqual(byProducts(["asset-solar"]));
    expect(entitledCountryCodes(user)).toEqual([]);
  });

  test.each([
    ["a null user", null],
    ["an undefined user", undefined],
    ["a string user", "gb-solar"],
    ["a string products claim", { [PRODUCTS_CLAIM_KEY]: "gb-solar" }],
    ["an object products claim", { [PRODUCTS_CLAIM_KEY]: { "gb-solar": true } }],
    ["a products claim of non-strings", { [PRODUCTS_CLAIM_KEY]: [1, null, {}] }],
    ["a null products claim", { [PRODUCTS_CLAIM_KEY]: null }],
    ["an object countries claim", { [COUNTRY_CLAIM_KEY]: { GB: true } }]
  ])("%s entitles nothing and does not throw", (_label, user) => {
    expect(() => entitledCountryCodes(user)).not.toThrow();
    expect(entitledCountryCodes(user)).toEqual([]);
  });

  // Malformed counts as absent, so the countries claim is still read: only a usable products
  // claim switches the fallback off.
  test("a malformed products claim falls back to the countries claim", () => {
    const user = { [PRODUCTS_CLAIM_KEY]: "gb-solar", [COUNTRY_CLAIM_KEY]: ["NL"] };
    expect(entitledCountryCodes(user)).toEqual(["NL"]);
  });
});

describe("isOcfAdmin", () => {
  test("is true when the products claim contains ocf-admin, in either spelling and any case", () => {
    expect(OCF_ADMIN_PRODUCT_KEY).toBe("ocf-admin");
    expect(isOcfAdmin({ [PRODUCTS_CLAIM_KEY]: ["gb-solar", "ocf-admin"] })).toBe(true);
    expect(isOcfAdmin({ [PRODUCTS_CLAIM_KEY_NAMESPACED]: [" OCF-Admin "] })).toBe(true);
  });

  test("is false for a user without it, and for no user", () => {
    expect(isOcfAdmin({ [PRODUCTS_CLAIM_KEY]: ["gb-solar", "nl-solar"] })).toBe(false);
    expect(isOcfAdmin({ [COUNTRY_CLAIM_KEY]: ["ocf-admin"] })).toBe(false);
    expect(isOcfAdmin(null)).toBe(false);
    expect(isOcfAdmin(undefined)).toBe(false);
  });

  test.each([["ocf-admin"], [{ 0: "ocf-admin" }], [[1, null, {}]], [null]])(
    "a malformed products claim (%p) is not admin",
    (claim) => {
      expect(isOcfAdmin({ [PRODUCTS_CLAIM_KEY]: claim })).toBe(false);
    }
  );

  test("dev mode counts as admin, as it counts as entitled", () => {
    process.env.NEXT_PUBLIC_DEV_MODE = "true";
    expect(isOcfAdmin(null)).toBe(true);
  });

  test("ocf-admin alone entitles no country, and stops the countries fallback", () => {
    const user = { [PRODUCTS_CLAIM_KEY]: ["ocf-admin"], [COUNTRY_CLAIM_KEY]: ["GB"] };
    expect(entitledCountryCodes(user)).toEqual([]);
  });
});
