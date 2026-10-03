// Reads the Auth0 entitlement claims and decides which countries a user may use.
//
// `/countries` returns every country the API serves, entitled or not, by design — so
// prospects can see what exists and configure ahead of a subscription completing. The
// frontend intersects that manifest with the claim to decide what is *usable*. Nothing
// here filters the manifest; it only marks it.
//
// Entitlement is by *product* (`gb-solar`, `nl-solar`, `asset-solar`, ...): a product may be
// a country's forecast, the sites view, or something later, so it is the one unit Auth0 can
// grant for all of them. A country is entitled when the `products` claim contains that country's
// `product` (config/countries.ts). The older `countries` claim is still read, as a changeover
// fallback only — see `readEntitlementClaim`.
//
// Every read degrades safely: a missing or malformed claim means "nothing entitled, everything
// discoverable" and never throws, which is also what keeps claim-propagation lag from
// breaking a live session. (The temporary `NEXT_PUBLIC_DEV_ENTITLE_COUNTRIES` override that
// stood in before the claim shipped was removed on 2026-09-29.)

import { configuredCountryCodes, getCountryConfig } from "../../../config/countries";
import type { StatusProductKey } from "../../../config/statusProducts";

/**
 * Every product key a country can be entitled by.
 *
 * The Status API's products plus `de-solar`, which Auth0 can grant but the Status API does
 * not report on yet. Kept apart from `StatusProductKey` so the status registry lists only
 * products that exist there: the banner skips a country whose product it does not know.
 * Once the Status API serves `de-solar`, it moves into `STATUS_PRODUCTS` and out of here.
 */
export type ProductKey = StatusProductKey | "de-solar";

/**
 * Bare spelling, no namespace — what is actually set on the Auth0 dev tenant, following the
 * `trial_ends_at` precedent read straight off `session.user` in pages/api/get_token.ts.
 */
export const PRODUCTS_CLAIM_KEY = "products";

/**
 * Namespaced spelling, per Auth0's custom-claim convention.
 *
 * Both are read because the bare one may not survive. Auth0 silently drops non-namespaced
 * custom claims that an Action adds to a token; `trial_ends_at` works un-namespaced in
 * production, but most likely arrives by another route (a root profile attribute rather than
 * an Action-set claim), so it is not proof that `products` will. Reading both costs a line
 * and removes the question.
 *
 * Delete whichever spelling turns out to be unused once the Action ships.
 */
export const PRODUCTS_CLAIM_KEY_NAMESPACED = "https://quartz.solar/products";

/**
 * The claim's key, un-namespaced — as the Auth0 Action sets it, following the existing
 * `trial_ends_at` claim's precedent (the tenant does not enforce namespacing). A namespaced
 * `https://quartz.solar/countries` was also read until the Action shipped; it was never used.
 */
export const COUNTRY_CLAIM_KEY = "countries";

/**
 * `true` when the app is running against the local dev stub.
 *
 * `pages/api/get_token.ts` serves a literal `FAKE_TOKEN` with no session and therefore no
 * claims in dev mode, so without this branch local development renders every country
 * disabled and the app is unusable. Deliberately an explicit, tested branch rather than an
 * incidental fallthrough — it is the one place entitlement is bypassed, and it must be
 * obvious when reading the code that it cannot fire in a deployed build.
 */
export const isDevModeEntitlementBypass = (): boolean =>
  process.env.NEXT_PUBLIC_DEV_MODE === "true";

/**
 * Pulls the country claim off an Auth0 user/session object. Read only as the changeover
 * fallback in `readEntitlementClaim`; deleted with it.
 *
 * `user` is `unknown` on purpose: it arrives from `useUser()`, from `getSession()`, or from
 * the JSON `/api/get_token` returns, and at least one of those can be `null` mid-session.
 * Anything that is not an array of non-empty strings is treated as absent.
 *
 * Codes are upper-cased to match how the API and the registry spell them, so a claim
 * written `["gb"]` still entitles `GB`.
 */
export const readCountryClaim = (user: unknown): string[] => {
  if (user === null || typeof user !== "object") return [];

  const record = user as Record<string, unknown>;
  const raw = record[COUNTRY_CLAIM_KEY];
  if (!Array.isArray(raw)) return [];

  const codes = raw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => entry.length > 0);

  // A malformed claim can repeat a code; downstream this is a membership set, not a list.
  return Array.from(new Set(codes));
};

/**
 * Pulls the product claim off an Auth0 user/session object.
 *
 * `user` is `unknown` for the same reason as `readCountryClaim`. Anything that is not an
 * array of non-empty strings is treated as absent, so a missing or malformed claim degrades
 * to "nothing entitled" and never throws.
 *
 * Keys are lower-cased to match how the Status API and the country registry spell them, so a
 * claim written `["GB-Solar"]` still matches. Unknown keys are left in — intersecting against
 * the registry is the caller's job.
 */
export const readProductsClaim = (user: unknown): string[] => {
  if (user === null || typeof user !== "object") return [];

  const record = user as Record<string, unknown>;
  const raw = record[PRODUCTS_CLAIM_KEY] ?? record[PRODUCTS_CLAIM_KEY_NAMESPACED];
  if (!Array.isArray(raw)) return [];

  const keys = raw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  // A malformed claim can repeat a key; downstream this is a membership set, not a list.
  return Array.from(new Set(keys));
};

/** Whichever claim decides entitlement for this user. See `readEntitlementClaim`. */
export type EntitlementClaim =
  | { source: "products"; products: string[] }
  | { source: "countries"; countries: string[] };

/**
 * The one place the changeover rule lives.
 *
 * The `products` claim decides whenever it is present and non-empty, even if a `countries`
 * claim is also present. Only a user with no usable products claim (absent, not an array, or
 * empty once cleaned) falls back to the `countries` claim, read as before. So a user whose
 * products claim contains only products no country has (say `["asset-solar"]`) has a
 * claim, gets no fallback, and is entitled to no country.
 *
 * Delete the fallback once the Auth0 Action sets `products` for every user: the
 * `source: "countries"` branch here and in `isEntitled`, `readCountryClaim` and
 * `COUNTRY_CLAIM_KEY`.
 */
export const readEntitlementClaim = (user: unknown): EntitlementClaim => {
  const products = readProductsClaim(user);
  if (products.length > 0) return { source: "products", products };
  return { source: "countries", countries: readCountryClaim(user) };
};

/**
 * Whether the country `code` is entitled by `claim`.
 *
 * Dev mode entitles everything (see `isDevModeEntitlementBypass`). Otherwise the country's
 * configured `product` must be in the products claim; a country with no `product`, or with
 * no registry entry, is never entitled by products. Under the changeover fallback it is a
 * case-insensitive membership test on the country codes. An empty claim entitles nothing,
 * which is the intended degraded state rather than a failure.
 */
export const isEntitled = (code: string, claim: EntitlementClaim): boolean => {
  if (isDevModeEntitlementBypass()) return true;
  if (typeof code !== "string" || code.length === 0) return false;
  if (claim.source === "countries") {
    const wanted = code.toUpperCase();
    return claim.countries.some((entry) => entry.toUpperCase() === wanted);
  }
  const product = getCountryConfig(code)?.product;
  if (product === undefined) return false;
  const wanted = product.toLowerCase();
  return claim.products.some((entry) => entry.toLowerCase() === wanted);
};

/**
 * The configured countries `user` is entitled to, in registry order.
 *
 * For callers that have a user but no manifest (`pages/api/get_token.ts`). Configured only:
 * the UI cannot use a country without a registry entry either, so this is the same set
 * `useEntitledCountries` ends up with.
 */
export const entitledCountryCodes = (user: unknown): string[] => {
  const claim = readEntitlementClaim(user);
  return configuredCountryCodes().filter((code) => isEntitled(code, claim));
};

/**
 * The product key that marks an OCF staff account. Not a country's product, so it entitles
 * nothing by itself (see `isOcfAdmin`).
 */
export const OCF_ADMIN_PRODUCT_KEY = "ocf-admin";

/**
 * Whether `user` is OCF staff: the `products` claim (either spelling, any case) contains
 * `ocf-admin`. Staff may switch countries on and off for demos; for everyone else the enabled
 * set is the entitled set (`hooks/data/use-sync-enabled-countries.ts`).
 *
 * Read from the ID-token claims like entitlement. The access token's `ocf:admin` permission
 * says the same thing, but the UI never decodes the access token. Dev mode counts as admin,
 * matching `isEntitled`. A missing or malformed claim is not admin.
 *
 * Note that `ocf-admin` makes the products claim non-empty, so the `countries` fallback in
 * `readEntitlementClaim` no longer applies: an admin needs the country products too.
 */
export const isOcfAdmin = (user: unknown): boolean => {
  if (isDevModeEntitlementBypass()) return true;
  return readProductsClaim(user).includes(OCF_ADMIN_PRODUCT_KEY);
};

/**
 * Whether the session user is on a trial: `trial_ends_at` present, read un-namespaced off the
 * user exactly as `pages/api/get_token.ts` does. Presence is the test; whether the trial has
 * expired is that endpoint's concern (it answers 403 `trial_expired`).
 */
export const isTrialUser = (user: unknown): boolean => {
  const trialEndsAt = (user as { trial_ends_at?: unknown } | null | undefined)?.trial_ends_at;
  return Boolean(trialEndsAt);
};
