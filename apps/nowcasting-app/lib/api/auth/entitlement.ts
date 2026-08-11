// Reads the Auth0 country entitlement claim.
//
// `/countries` returns every country the API serves, entitled or not, by design — so
// prospects can see what exists and configure ahead of a subscription completing. The
// frontend intersects that manifest with this claim to decide what is *usable*. Nothing
// here filters the manifest; it only marks it.
//
// The claim does not exist on the tenant yet — it is being added off the same
// `GB_ROLE_ID`/`NL_ROLE_ID` roles that already drive access. Every read is therefore
// written to be correct once it lands and harmless until then: a missing or malformed
// claim degrades to "nothing entitled, everything discoverable" and never throws. That is
// also what keeps claim-propagation lag from breaking a live session.

/**
 * Namespaced spelling, per Auth0's custom-claim convention.
 *
 * Both spellings are accepted because the Action has not landed and the tenant does not in
 * fact enforce namespacing: the existing `trial_ends_at` claim is set un-namespaced and is
 * read straight off `session.user` in `pages/api/get_token.ts`, in production. The Action
 * author may reasonably follow that precedent. Delete whichever one is not used once the
 * Action ships.
 */
export const COUNTRY_CLAIM_KEY = "https://quartz.solar/countries";

/** Un-namespaced fallback, matching the `trial_ends_at` precedent. */
export const COUNTRY_CLAIM_KEY_FALLBACK = "countries";

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
 * Pulls the country claim off an Auth0 user/session object.
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
  const raw = record[COUNTRY_CLAIM_KEY] ?? record[COUNTRY_CLAIM_KEY_FALLBACK];
  if (!Array.isArray(raw)) return [];

  const codes = raw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => entry.length > 0);

  // A malformed claim can repeat a code; downstream this is a membership set, not a list.
  return Array.from(new Set(codes));
};

// ===========================================================================================
// TEMPORARY — DELETE WHEN THE `countries` CLAIM LANDS ON THE AUTH0 DEV TENANT
// ===========================================================================================
//
// `NEXT_PUBLIC_DEV_MODE` conflates two unrelated things: it swaps the real Auth0 token for a
// literal `FAKE_TOKEN` (`pages/api/get_token.ts`) *and* it bypasses entitlement. That makes
// the one switch that would let you see NL also the switch that makes every API call 401,
// so there is currently no configuration in which an unentitled country is reviewable.
//
// This splits the second concern out: a real session against the real API, with entitlement
// forced. It exists so NL's national chart can be eyeballed before the claim ships, and it
// comes straight back out afterwards — this whole block and its two call sites below.
//
// Set it to a comma-separated list of country codes:
//
//     NEXT_PUBLIC_DEV_ENTITLE_COUNTRIES=GB,NL
//
// It does NOT accept a wildcard, on purpose: naming the countries keeps the blast radius
// visible in the env file, and means a stale value grants exactly what it says.

/**
 * Country codes force-entitled by the local override, upper-cased. Empty unless the env var
 * is set, and hard-disabled when `NODE_ENV === "production"` so a leaked value in a deployed
 * build (it is `NEXT_PUBLIC_`, so it *is* in the client bundle) cannot grant anything.
 */
export const devEntitlementOverride = (): string[] => {
  if (process.env.NODE_ENV === "production") return [];
  return (process.env.NEXT_PUBLIC_DEV_ENTITLE_COUNTRIES ?? "")
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code.length > 0);
};

// ===========================================================================================

/**
 * Whether `code` is entitled by `claim`.
 *
 * Dev mode entitles everything (see `isDevModeEntitlementBypass`). Otherwise this is a
 * plain case-insensitive membership test — an empty claim entitles nothing, which is the
 * intended degraded state rather than a failure.
 */
export const isEntitled = (code: string, claim: readonly string[]): boolean => {
  if (isDevModeEntitlementBypass()) return true;
  if (typeof code !== "string" || code.length === 0) return false;
  const wanted = code.toUpperCase();
  // TEMPORARY, see above.
  if (devEntitlementOverride().includes(wanted)) return true;
  return claim.some((entry) => entry.toUpperCase() === wanted);
};
