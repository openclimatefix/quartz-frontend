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
 * The country -> product link lives on `CountryConfig` as `product`, so the enabled
 * countries decide which country rows show; the sites page shows `SITES_STATUS_PRODUCT`.
 * See `statusProductsFor` in components/hooks/useStatus.ts.
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

/** The one product the sites page reports on. */
export const SITES_STATUS_PRODUCT: StatusProductKey = "asset-solar";

export const isKnownProduct = (key: string): key is StatusProductKey =>
  Object.prototype.hasOwnProperty.call(STATUS_PRODUCTS, key);

/**
 * Which products this user is allowed to see the status of.
 *
 * Returns all of them today, deliberately — we would rather show a GB-only customer an NL
 * incident than hide a GB one through a half-built entitlement check. `readProductsClaim`
 * (lib/api/auth/entitlement.ts) is the mechanism, now deciding country entitlement but not
 * wired in here: this is the one function that changes when status is locked down too.
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
