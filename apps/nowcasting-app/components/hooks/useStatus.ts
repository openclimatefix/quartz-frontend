import useSWR from "swr";
import { ProductStatus, ProductsResponse, StatusLevel } from "../types";
import { axiosFetcher } from "../helpers/utils";
import {
  entitledStatusProducts,
  isKnownProduct,
  productOrder,
  severityRank
} from "../../config/statusProducts";

/**
 * The status banner's one and only backend.
 *
 * Previously the banner read status off the *data* APIs — `${API_PREFIX}/solar/GB/status`
 * and `${SITES_API_PREFIX}/api_status` — which meant "is the service up" was answered by the
 * same service being asked about, and only ever for GB. Both are now replaced by the Status
 * API's product model at `NEXT_PUBLIC_STATUS_URL`.
 *
 * `GET /products` returns every product in one call, so there is exactly one request here
 * however many products exist. It is unauthenticated and sends `access-control-allow-origin: *`,
 * hence the plain `axiosFetcher` rather than `axiosFetcherAuth`/`useLoadDataFromApi` — the
 * latter would attach a bearer token this API does not want and append the `UI=true` flag
 * that only the data APIs understand.
 */

const STATUS_URL = process.env.NEXT_PUBLIC_STATUS_URL;

/**
 * Faster than the app's 5-minute data default: an incident is worth knowing about promptly.
 * No point going below the API's own `Cache-Control: public, max-age=15` — a tighter poll
 * would only re-read the same cached body.
 */
const STATUS_REFRESH_INTERVAL_MS = 60_000;

const KNOWN_LEVELS: StatusLevel[] = ["ok", "info", "warning", "error", "unknown"];

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

const normaliseProduct = (product: ProductStatus): ProductStatus => ({
  ...product,
  status: normaliseLevel(product.status),
  message: product.message?.trim() ?? ""
});

/**
 * Every product status this user is entitled to see, normalised. `ok` rows are included —
 * filtering them out is the banner's call, not the transport's.
 *
 * Returns `[]` when `NEXT_PUBLIC_STATUS_URL` is unset (the SWR key goes `null`, so nothing
 * is fetched) — the banner then renders nothing rather than the app erroring.
 */
export const useProductStatuses = (): ProductStatus[] => {
  const { data } = useSWR<ProductsResponse, Error>(
    STATUS_URL ? `${STATUS_URL}/products` : null,
    axiosFetcher,
    {
      refreshInterval: STATUS_REFRESH_INTERVAL_MS,
      keepPreviousData: true,
      // A status service that is itself down should not spam Sentry or the network log.
      //
      // This also means a 503 "status store unavailable" — the API staying up and answering
      // honestly that its database is down — shows as silence, indistinguishable from
      // all-clear. Deliberately left as-is for now: a full-width banner is too shouty for "we
      // cannot currently tell you". It gets proper handling with the Europe UI, which needs a
      // subtler way to show per-product status anyway.
      shouldRetryOnError: false
    }
  );

  const products = data?.products;
  if (!Array.isArray(products)) return [];

  // The entitlement filter has exactly one home. Today it lets every *registered* product
  // through; when the Europe UI locks it down to the token's `products` claim, this is the
  // only caller that has to change.
  //
  // A product the API serves but config/statusProducts.ts does not know about is dropped
  // rather than shown. That is the right way round once entitlement is real — we should
  // never render a status we cannot attribute an entitlement to — and the cost is that a
  // newly launched product needs one line of config before its banner appears.
  const entitled = entitledStatusProducts() as string[];
  return products
    .filter((product) => isKnownProduct(product.key) && entitled.includes(product.key))
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
 * directly: there is no jsdom in this project, so anything reachable only through a render
 * is untestable.
 */
export const orderStatuses = (statuses: ProductStatus[]): ProductStatus[] =>
  statuses
    .filter((status) => status.status !== "ok" && (status.message ?? "").trim() !== "")
    .sort(
      (a, b) =>
        severityRank(a.status) - severityRank(b.status) || productOrder(a.key) - productOrder(b.key)
    );
