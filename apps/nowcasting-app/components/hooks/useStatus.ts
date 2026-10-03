import useSWR from "swr";
import { ProductStatus, ProductsResponse, StatusLevel } from "../types";
import { fetchJson } from "../../lib/api/fetch-json";
import { apiV1SwrOptions } from "../../hooks/data/query";
import {
  KNOWN_LEVELS,
  SITES_STATUS_PRODUCT,
  StatusProductKey,
  isKnownProduct,
  productOrder,
  severityRank
} from "../../config/statusProducts";
import { getCountryConfig } from "../../config/countries";

/**
 * The status banner's one and only backend.
 *
 * Previously the banner read status off the *data* APIs — `${API_PREFIX}/solar/GB/status`
 * and `${SITES_API_PREFIX}/api_status` — which meant "is the service up" was answered by the
 * same service being asked about, and only ever for GB. Both are now replaced by the Status
 * API's product model at `NEXT_PUBLIC_STATUS_URL`.
 *
 * `GET /products` returns every product in one call, so there is exactly one request here
 * however many products exist — and one cache entry, which `useCountryStatus`
 * (hooks/data/use-country-status.ts) shares for the header lamps. It is unauthenticated and
 * sends `access-control-allow-origin: *`, hence the bare `fetchJson` rather than the v1
 * client or `axiosFetcherAuth`/`useLoadDataFromApi` — those attach a bearer token this API
 * does not want and append the `UI=true` flag that only the data APIs understand.
 */

/**
 * Read when the hook runs rather than once at import. Next inlines `NEXT_PUBLIC_*` at build
 * time wherever it is referenced, so this costs nothing in the browser, and it means a test
 * can set the variable in `beforeAll` instead of having to `require` this module after it.
 */
const statusUrl = (): string | undefined => process.env.NEXT_PUBLIC_STATUS_URL;

/**
 * Faster than the app's 5-minute data default: an incident is worth knowing about promptly.
 * No point going below the API's own `Cache-Control: public, max-age=15` — a tighter poll
 * would only re-read the same cached body.
 */
const STATUS_REFRESH_INTERVAL_MS = 60_000;

/**
 * Anything the API sends that we do not recognise becomes `unknown`.
 *
 * Not `info`: since spec v0.2.0 `info` has a meaning of its own — a deliberate, non-degraded
 * notice — so labelling an unrecognised value `info` would claim we had understood it.
 * `unknown` is the honest answer, and it ranks above `info` in severity, so a level we
 * cannot read fails loud rather than quiet. Either way the row still renders: silently
 * swallowing a level we do not know would hide a real incident.
 */
export const normaliseLevel = (level: unknown): StatusLevel => {
  if (typeof level !== "string") return "unknown";
  const trimmed = level.trim().toLowerCase();
  return (KNOWN_LEVELS as string[]).includes(trimmed) ? (trimmed as StatusLevel) : "unknown";
};

/**
 * Anything that is not a string becomes `""` — same reasoning as `normaliseLevel` above.
 *
 * `ProductStatus.message` is typed `string | null`, but that is an assertion about an HTTP
 * response, not a guarantee about one. A number or an object arriving here would make
 * `.trim()` throw, and this runs in a hook body, so the throw takes the whole render down —
 * a malformed field on one product would blank the app rather than drop one banner row.
 */
export const normaliseMessage = (message: unknown): string =>
  typeof message === "string" ? message.trim() : "";

const normaliseProduct = (product: ProductStatus): ProductStatus => ({
  ...product,
  status: normaliseLevel(product.status),
  message: normaliseMessage(product.message)
});

/**
 * Which products the banner reports on for the page in view.
 *
 * The sites page is about assets, so it shows `asset-solar` alone. Everywhere else it is
 * each enabled country's `product`, in enabled order; a country without one, or whose product
 * the status registry does not know (DE's `de-solar` today), or a code this build has no
 * config for, adds nothing. For a regular user the enabled set is
 * every country they are entitled to, so this is "all my countries' statuses".
 */
export const statusProductsFor = (
  isSitesChart: boolean,
  enabledCountries: string[]
): StatusProductKey[] =>
  isSitesChart
    ? [SITES_STATUS_PRODUCT]
    : enabledCountries.flatMap((code) => {
        const product = getCountryConfig(code)?.product;
        return product && isKnownProduct(product) ? [product] : [];
      });

/**
 * The statuses of `shownProducts` (see `statusProductsFor`), normalised. `ok` rows are
 * included — filtering them out is the banner's call, not the transport's.
 *
 * Returns `[]` when `NEXT_PUBLIC_STATUS_URL` is unset (the SWR key goes `null`, so nothing
 * is fetched), while the first request is in flight, and while the service is failing — the
 * banner then renders nothing rather than the app erroring.
 *
 * The SWR key is the bare URL, with no caller-specific part, so every consumer of this hook
 * on a page shares one entry whatever `shownProducts` it passes: the filter below runs on
 * the shared body, not in the request.
 */
export const useProductStatuses = (shownProducts: StatusProductKey[]): ProductStatus[] => {
  const url = statusUrl();
  const { data } = useSWR<ProductsResponse, Error>(
    url ? `${url}/products` : null,
    fetchJson<ProductsResponse>,
    {
      // The data hooks' retry policy: fast exponential backoff, then re-asked at the refresh
      // interval for as long as it keeps failing (hooks/data/query.ts). Previously
      // `shouldRetryOnError: false`, which left a status-service outage frozen as "all clear"
      // until a focus event or a reload.
      ...apiV1SwrOptions,
      refreshInterval: STATUS_REFRESH_INTERVAL_MS,
      dedupingInterval: STATUS_REFRESH_INTERVAL_MS,
      // The outage itself is never shown. A 503 "status store unavailable" — the API staying
      // up and answering honestly that its database is down — reads as silence, the same as
      // all-clear: a full-width banner is too shouty for "we cannot currently tell you", and
      // the lamps have no level for it either. Retrying quietly is the whole response.
      //
      // Nor is it reported. `_app.tsx` installs a global `onError` that sends reportable
      // failures to Sentry; this per-hook `onError` replaces it for this key (SWR merges
      // hook config over context config field by field), because a status service being
      // down is that service's incident, not this app's, and one event per retry per client
      // would drown the data-API failures that are.
      onError: () => {}
    }
  );

  const products = data?.products;
  if (!Array.isArray(products)) return [];

  // The one request still fetches every product; the page's list decides which are kept.
  // This is the only filter: nothing here reads the token's `products` claim.
  //
  // A product the API serves but config/statusProducts.ts does not know about is dropped.
  // We should never render a status we cannot attribute to a country or to the sites page,
  // and the cost is that a newly launched product needs one line of config before its
  // banner appears.
  const shown = shownProducts as string[];
  return products
    .filter((product) => isKnownProduct(product.key) && shown.includes(product.key))
    .map(normaliseProduct);
};

/**
 * The rows the banner should actually draw, worst first.
 *
 * `ok` never renders. The Status API always sends a message — every product currently reads
 * "Operating within normal parameters." — so keying off "is there a message" would pin a
 * permanent banner to the top of the app. The level is what decides, not the text.
 *
 * Lives here rather than in the component so it is a plain function the suite can call
 * directly.
 */
export const orderStatuses = (statuses: ProductStatus[]): ProductStatus[] =>
  statuses
    .filter((status) => status.status !== "ok" && (status.message ?? "").trim() !== "")
    .sort(
      (a, b) =>
        severityRank(a.status) - severityRank(b.status) || productOrder(a.key) - productOrder(b.key)
    );
