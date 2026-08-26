import { StatusLevel } from "../components/types";

/**
 * The Status API's product registry.
 *
 * The status service models everything as a "product" — `gb-solar`, `nl-solar`,
 * `asset-solar` (formerly "sites") — deliberately agnostic about whether a product is a
 * country, a data source, or a whole separate app. This file is the only place that knows
 * those keys, so the app never spells a product string inline.
 *
 * Declared data, no branching. Adding a product is one entry here.
 *
 * When the Europe UI lands, the country -> product link belongs on `CountryConfig` as a
 * `statusProduct` field rather than here, so `enabledCountries` can drive which rows show.
 * Until then nothing filters by country or view: every product's status is shown to
 * everyone (see `entitledStatusProducts`).
 */

export type StatusProductKey = "gb-solar" | "nl-solar" | "asset-solar";

type StatusProductConfig = {
  /** Shown as the row's label when more than one product is reporting at once. */
  label: string;
  /** Tie-break ordering within a severity band. Lower sorts first. */
  order: number;
};

export const STATUS_PRODUCTS: Record<StatusProductKey, StatusProductConfig> = {
  "gb-solar": { label: "GB Solar", order: 0 },
  "nl-solar": { label: "NL Solar", order: 1 },
  // The status API's name for what this app still calls "sites" throughout. The rename
  // lives here at the boundary and nowhere else.
  "asset-solar": { label: "Asset Solar", order: 2 }
};

export const isKnownProduct = (key: string): key is StatusProductKey =>
  Object.prototype.hasOwnProperty.call(STATUS_PRODUCTS, key);

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
 * and removes the question. lib/api/auth/entitlement.ts does the same for `countries`.
 *
 * Delete whichever spelling turns out to be unused once the Action ships.
 */
export const PRODUCTS_CLAIM_KEY_NAMESPACED = "https://quartz.solar/products";

/**
 * Pulls the product claim off an Auth0 user/session object.
 *
 * `user` is `unknown` on purpose: it arrives from `useUser()`, from `getSession()`, or from
 * the JSON `/api/get_token` returns, and at least one of those can be null mid-session.
 * Anything that is not an array of non-empty strings is treated as absent, so a missing or
 * malformed claim degrades to "nothing entitled" and never throws.
 *
 * Keys are lower-cased to match how the status API spells them, so a claim written
 * `["GB-Solar"]` still matches. Unknown keys are left in — intersecting against the registry
 * is the caller's job.
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

/**
 * Which products this user is allowed to see the status of.
 *
 * Returns all of them today, deliberately — we would rather show a GB-only customer an NL
 * incident than hide a GB one through a half-built entitlement check. `readProductsClaim`
 * above is the mechanism, built and tested but not yet wired in: the lock-down ships with
 * the Europe UI, and this is the one function that changes when it does. `useProductStatuses`
 * is the single place entitlement is applied.
 *
 * It reads a **`products`** claim, not the `countries` claim the Europe UI epic currently
 * builds against. That is a settled decision, not a preference: `asset-solar` is not a
 * country, so no arrangement of country roles can ever entitle it. The epic will be amended
 * to match, and the claim is already on the Auth0 dev tenant.
 *
 * Before switching this over, decode a real dev token and confirm the claim actually
 * survives — a dropped claim fails silently, and once this stops returning everything it
 * degrades to "nothing entitled" for every user at once. Note also that dev mode serves a
 * literal `FAKE_TOKEN` with no claims (pages/api/get_token.ts), so this will need the same
 * explicit bypass the epic's entitlement module has, or local development renders no
 * statuses at all.
 */
export const entitledStatusProducts = (): StatusProductKey[] =>
  Object.keys(STATUS_PRODUCTS) as StatusProductKey[];

/**
 * Worst first. `ok` never reaches the banner, but is ordered here for completeness.
 *
 * This is the exact reverse of the severity order the Status API uses for its own worst-of
 * rollup (`ok < info < unknown < warning < error`, spec v0.2.0). Keep it that way — a UI that
 * ranked these differently from the API would sort a product above the very rollup value it
 * produced.
 */
const SEVERITY_ORDER: Record<StatusLevel, number> = {
  error: 0,
  warning: 1,
  unknown: 2,
  info: 3,
  ok: 4
};

export const severityRank = (level: StatusLevel): number => SEVERITY_ORDER[level];

/**
 * The runtime list of levels, derived rather than spelled out a second time.
 *
 * `StatusLevel` is a type, so there is nothing in types.d.ts to read at runtime. But
 * `SEVERITY_ORDER` above is typed `Record<StatusLevel, number>`, which the compiler already
 * refuses to let you leave incomplete — so its keys are a list that cannot go stale. A
 * hand-maintained array could: add a level to `StatusLevel`, forget the array, and every
 * product on the new level normalises to `unknown` with nothing failing to warn you.
 */
export const KNOWN_LEVELS = Object.keys(SEVERITY_ORDER) as StatusLevel[];

export const productOrder = (key: string): number =>
  isKnownProduct(key) ? STATUS_PRODUCTS[key].order : Number.MAX_SAFE_INTEGER;

/**
 * `fallback` is defence in depth, not a live path: `useProductStatuses` drops products the
 * registry does not know, so every key reaching the banner is registered and the fallback
 * never fires today. It stays so a future caller that does not filter still renders a name.
 */
export const productLabel = (key: string, fallback: string): string =>
  isKnownProduct(key) ? STATUS_PRODUCTS[key].label : fallback;
