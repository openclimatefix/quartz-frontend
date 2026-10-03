/**
 * Whether a country's data pipeline is healthy, for the status lamp on the header's country
 * toggle.
 *
 * Read off the Status API's product model, the same source as the banner: `CountryConfig.
 * product` (config/countries.ts) names the country's product key, and `useProductStatuses`
 * (components/hooks/useStatus.ts) fetches `GET ${NEXT_PUBLIC_STATUS_URL}/products`. That
 * request returns every product and is keyed on the bare URL, so the banner and however many
 * lamps are mounted share one SWR cache entry: one request, one body — a lamp costs nothing
 * on the wire. Sharing the body is not the same as showing the same thing: the banner drops a
 * non-ok row whose message is empty (`orderStatuses`) where the lamp invents a fallback, and
 * a dismissed banner row leaves its lamp lit. Both are intended.
 *
 * Importing from `components/hooks` is a known layering wart, scheduled for the
 * hooks/app-state split; the shared cache entry is what makes it worth tolerating meanwhile.
 *
 * ## Level mapping
 *
 * The API's five levels are folded onto the lamp's three by `lampLevelFor`: `ok` -> ok,
 * `error` -> error, and everything else -> warning. `unknown` is a level we could not read,
 * and consistent with `severityRank` a level we cannot read fails loud rather than quiet;
 * `info` is a deliberate notice the operator chose to publish, so it is still worth a lamp
 * and a tooltip, even though nothing is degraded.
 *
 * ## ok = no lamp
 *
 * An ok country returns `message: null`, and the toggle keys its lamp and tooltip off the
 * message being present (country-toggle.tsx: `reportable`). That is a product decision — no
 * green disc, a quiet header when all is well — not an accident of the data. Every other
 * level always carries a message: the normalised product message when there is one, a
 * generic `"<label> status: <level>"` otherwise, so a lit lamp never has an empty tooltip.
 *
 * A country with no product, or whose product the status registry does not know (DE's
 * `de-solar` today), is ok with nothing to say and adds nothing to the request. So is every
 * country while the response is loading, while the service is failing, when
 * `NEXT_PUBLIC_STATUS_URL` is unset, and when the product is missing from the response:
 * "we cannot tell you" is not something the lamp has a colour for, and a lamp that lit on
 * every outage of the status service itself would cry wolf. This never throws.
 */
import type { StatusLevel } from "../../components/types";
import { useProductStatuses } from "../../components/hooks/useStatus";
import { getCountryConfig } from "../../config/countries";
import { isKnownProduct, productLabel } from "../../config/statusProducts";

/**
 * `warning` is "degraded but the numbers are still worth reading"; `error` is "do not trust
 * what this country is showing". Deliberately three levels rather than a boolean: the map
 * draws a country either way, so the lamp has to distinguish "late" from "wrong".
 */
export type CountryStatusLevel = "ok" | "warning" | "error";

export type CountryStatus = {
  level: CountryStatusLevel;
  /** Human-readable, and null whenever `level` is "ok" — an ok country has nothing to say. */
  message: string | null;
};

const OK: CountryStatus = { level: "ok", message: null };

/**
 * The Status API's five levels onto the lamp's three. Exhaustive by construction: a level
 * added to `StatusLevel` fails to compile here until it is given a lamp colour.
 */
const LAMP_LEVELS: Record<StatusLevel, CountryStatusLevel> = {
  ok: "ok",
  error: "error",
  warning: "warning",
  unknown: "warning",
  info: "warning"
};

export const lampLevelFor = (level: StatusLevel): CountryStatusLevel => LAMP_LEVELS[level];

/**
 * Unconditional hook call whatever the country: a country without a known product passes
 * an empty list, which `useProductStatuses` filters to `[]` — still one shared cache entry,
 * still no request of its own.
 */
export const useCountryStatus = (code: string): CountryStatus => {
  const product = getCountryConfig(code)?.product;
  const known = product !== undefined && isKnownProduct(product) ? product : null;
  const statuses = useProductStatuses(known ? [known] : []);
  if (!known) return OK;

  const status = statuses.find((row) => row.key === known);
  if (!status) return OK;

  const level = lampLevelFor(status.status);
  if (level === "ok") return OK;

  // `useProductStatuses` has already normalised `message` to a trimmed string.
  const message = status.message || `${productLabel(known, status.name)} status: ${status.status}`;
  return { level, message };
};
