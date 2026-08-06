import useSWR, { type SWRConfiguration, type SWRResponse } from "swr";

import { ApiV1Error, apiV1Client, isNonRetryableApiV1Error } from "../../lib/api/v1/client";
import { queryKey, type RequestDescriptor } from "../../lib/api/v1/queries";
import type { components, paths } from "../../lib/api/v1/schema";

/**
 * The one place SWR is wired to the Phase 2 layers (`queries` -> `client` -> `normalise`).
 *
 * Every hook in `hooks/data/` is a three-line call to `useApiQuery`: build a descriptor from
 * an explicit `Scope`, name the normaliser, done. Nothing here composes several requests —
 * that is deliberate. The thing this layer replaces is `pages/index.tsx`'s ~14-fetch
 * `CombinedData` god-object, and the shape of the fix is one hook per query, each returning
 * SWR's own coherent `{ data, isLoading, isValidating, error }` record. Loading, validating
 * and error state are never shredded into parallel objects again.
 */

/**
 * What every data hook returns: SWR's record, unmodified.
 *
 * One record per query, never split apart. Splitting `data`, `isLoading`, `isValidating` and
 * `error` into four parallel objects is exactly the `CombinedData`/`CombinedLoading` shape
 * this layer exists to delete — it lets the four drift out of step and forces every consumer
 * to reassemble them.
 *
 * `error` is `unknown` rather than `ApiV1Error` because SWR's error channel carries anything
 * thrown, including a normaliser bug. Use `describeApiError` to branch on it safely.
 *
 * `mutate` is deliberately not part of the contract: the hooks that derive from a shared
 * request (`useRegionTypes` off the manifest) could not carry a correctly typed one, and a
 * caller that really needs to force a refresh can use SWR's global `mutate` with the key.
 */
export type DataResult<T> = Pick<
  SWRResponse<T, unknown>,
  "data" | "error" | "isLoading" | "isValidating"
>;

/**
 * The JSON body a path's 200 response carries, read straight off the generated spec.
 *
 * This is what lets `useApiQuery` type its `select` callback: the descriptor pins the path,
 * the path pins the wire type, so passing `normaliseForecast` to a generation endpoint fails
 * to compile rather than producing an empty chart.
 */
export type ResponseOf<P extends keyof paths> = paths[P]["get"] extends {
  responses: { 200: { content: { "application/json": infer R } } };
}
  ? R
  : never;

type ValidationError = components["schemas"]["ValidationError"];

// --- retry policy -----------------------------------------------------------------------

/** Matches the v0 `useLoadDataFromApi` cadence, so the migration is not also a polling change. */
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const TWO_MINUTES_MS = 2 * 60 * 1000;

/** Backoff doubles per attempt from this base, capped, up to `MAX_RETRIES` attempts. */
export const RETRY_BASE_MS = 1000;
export const RETRY_CAP_MS = 30_000;
export const MAX_RETRIES = 6;

/**
 * `period` and `snapshot` are served from a pre-warmed cache and answer **503** with
 * `Retry-After: 60` while it is cold. Confirmed with the API owner as a brief post-deploy
 * state, so it is retried silently with backoff and gets no "warming" UI state of its own —
 * to the user it is indistinguishable from a slow request.
 *
 * A **403** is the opposite: the token that produced it will not become authorised, so
 * retrying only produces a request loop against an endpoint that will keep refusing. That
 * distinction is the whole reason `ApiV1Error` carries a status.
 *
 * Everything else (network blips, 429, 5xx, a 422 from a since-fixed caller bug) retries.
 */
export const apiV1SwrOptions: SWRConfiguration = {
  refreshInterval: FIVE_MINUTES_MS,
  dedupingInterval: TWO_MINUTES_MS,
  keepPreviousData: true,
  shouldRetryOnError: true,
  onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
    if (isNonRetryableApiV1Error(error)) return;
    if (retryCount >= MAX_RETRIES) return;
    const delay = Math.min(RETRY_BASE_MS * 2 ** (retryCount - 1), RETRY_CAP_MS);
    setTimeout(() => revalidate({ retryCount }), delay);
  }
};

/**
 * The capability manifest (`GET /countries`) is near-static — capacity and model lists change
 * on deploys, not on minutes — so it is fetched once an hour and shared by every hook that
 * needs a slice of it (`useCountries`, `useRegionTypes`, `useGenerationSources`). They all
 * build the same descriptor, so they share one cache entry and one request.
 */
const ONE_HOUR_MS = 60 * 60 * 1000;

export const manifestSwrOptions: SWRConfiguration = {
  ...apiV1SwrOptions,
  dedupingInterval: ONE_HOUR_MS,
  refreshInterval: ONE_HOUR_MS,
  revalidateOnFocus: false,
  revalidateIfStale: false
};

// --- error inspection -------------------------------------------------------------------

/**
 * The two error bodies v1 actually returns, flattened into one shape a caller can render.
 *
 * 400s carry `{"detail": string}`; 422s carry `HTTPValidationError`'s
 * `{"detail": ValidationError[]}`. Code that assumes one shape crashes on the other, so
 * this is the only sanctioned way to read `error`.
 *
 * Returns `null` for anything that is not an `ApiV1Error` — a thrown normaliser bug is not
 * an API error and must not be reported as one.
 */
export type ApiErrorInfo = {
  status: number;
  /** Human-readable, always populated. Falls back to the status when the body says nothing. */
  message: string;
  /** Populated only for `HTTPValidationError` (422). Empty otherwise. */
  validationErrors: ValidationError[];
  /** True for a cold `period`/`snapshot` cache: retried silently, not surfaced. */
  isColdCache: boolean;
  /** True when retrying can never succeed (403). */
  isFatal: boolean;
};

const isValidationErrorList = (detail: unknown): detail is ValidationError[] =>
  Array.isArray(detail) && detail.every((item) => typeof item === "object" && item !== null);

export const describeApiError = (error: unknown): ApiErrorInfo | null => {
  if (!(error instanceof ApiV1Error)) return null;

  const detail =
    typeof error.body === "object" && error.body !== null
      ? (error.body as { detail?: unknown }).detail
      : undefined;

  let message = `Request failed (${error.status})`;
  let validationErrors: ValidationError[] = [];

  if (typeof detail === "string" && detail.length > 0) {
    message = detail;
  } else if (isValidationErrorList(detail)) {
    validationErrors = detail;
    const summary = detail.map((item) => item.msg).filter(Boolean);
    if (summary.length > 0) message = summary.join("; ");
  }

  return {
    status: error.status,
    message,
    validationErrors,
    isColdCache: error.status === 503,
    isFatal: isNonRetryableApiV1Error(error)
  };
};

// --- the fetcher ------------------------------------------------------------------------

/**
 * `openapi-fetch`'s `GET` is generic over a *literal* path, and its `params` type is derived
 * from that literal. A `RequestDescriptor<P>` carries the path in a type variable instead,
 * which the generic cannot consume, so the call is made through a narrowed structural view
 * of the client. Nothing is given up by doing so: `queries.ts` already types every
 * descriptor against `paths`, so a wrong path or a misnamed param still fails `tsc` there —
 * this cast only relaxes the second, redundant check at the call site.
 */
type StructuralClient = {
  GET: (
    path: string,
    init: { params: unknown }
  ) => Promise<{ data?: unknown; error?: unknown; response: Response }>;
};

/**
 * `apiV1Client` reports failures in its return value rather than throwing, but SWR needs a
 * rejection to enter its error state — and `onErrorRetry` needs the status to decide whether
 * retrying can ever help. Converting to `ApiV1Error` here is what makes the retry policy
 * above possible.
 */
export const fetchDescriptor = async <P extends keyof paths>(
  descriptor: RequestDescriptor<P>
): Promise<ResponseOf<P>> => {
  const client = apiV1Client as unknown as StructuralClient;
  const { data, error, response } = await client.GET(descriptor.path, {
    params: descriptor.params
  });
  if (error !== undefined || !response.ok) throw new ApiV1Error(response.status, error);
  return data as ResponseOf<P>;
};

// --- the hook ---------------------------------------------------------------------------

/**
 * One request, one SWR record.
 *
 * `descriptor === null` disables the query: SWR is given a `null` key, so it does not fetch
 * and reports `isLoading: false` with no data. That is how a hook whose scope is not ready
 * (no region selected yet, a country with no second generation observer) stays a plain
 * unconditional hook call rather than a conditional one — the rules of hooks require the
 * call count to be constant.
 *
 * The cache key is `queryKey(descriptor)`, which key-sorts the params, so two components
 * that build the same request in a different property order share one entry. SWR dedupes on
 * it, which is what makes "every component calls the hooks it needs" cost one request per
 * distinct query rather than one per consumer — and what makes N-country fanout free, since
 * the country is part of the key.
 */
export const useApiQuery = <P extends keyof paths, T>(
  descriptor: RequestDescriptor<P> | null,
  select: (wire: ResponseOf<P>) => T,
  options: SWRConfiguration = {}
): DataResult<T> =>
  useSWR<T, unknown>(
    descriptor === null ? null : queryKey(descriptor),
    descriptor === null ? null : async () => select(await fetchDescriptor(descriptor)),
    { ...apiV1SwrOptions, ...options }
  );
