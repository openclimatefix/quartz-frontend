import Router from "next/router";
import createClient, { type Middleware } from "openapi-fetch";

import { API_V1_PREFIX } from "../../../constant";
import { getAccessToken } from "../auth/token";
import type { paths } from "./schema";

// Carries the HTTP status and the parsed error body (an HTTPValidationError on 422,
// otherwise whatever JSON — or text, if the body isn't JSON — the API sent) so callers
// can branch on `error.status === 403` instead of the old `error.toString().includes("403")`
// string-sniffing (see components/hooks/useLoadDataFromApi.tsx).
export class ApiV1Error extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`v1 API request failed (${status}): ${JSON.stringify(body)}`);
    this.name = "ApiV1Error";
    this.status = status;
    this.body = body;
  }
}

// The request never reached the API or got no answer (offline, DNS, CORS, a dropped
// connection): `fetch` rejects with a TypeError. Wrapped so the error reporter can tell it
// apart from a TypeError thrown by a bug further up, which must still be reported.
export class ApiV1NetworkError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super(`v1 API request failed to reach the server: ${String(cause)}`);
    this.name = "ApiV1NetworkError";
    this.cause = cause;
  }
}

const asNetworkError = (error: unknown): unknown =>
  error instanceof TypeError ? new ApiV1NetworkError(error) : error;

// 403 means the caller is not, and will not become, authorised for this request — retrying
// on the same token cannot succeed. Everything else (network blips, 429s, 5xxs, 422
// validation errors from a since-fixed caller bug) is worth a retry. Phase 4's SWR layer
// uses this to decide onErrorRetry behaviour.
export function isNonRetryableApiV1Error(error: unknown): error is ApiV1Error {
  return error instanceof ApiV1Error && error.status === 403;
}

// A 401 means the API rejected the token (expired, or the wrong audience): send the user
// to log in again, to the same place v0's `axiosFetcherAuth` does. A 403 does not redirect;
// in v1 it means "not entitled to this country", and logging in again cannot change that.
//
// Once only. The module flag covers a burst of 401s from one page load; the sessionStorage
// marker covers the page load after the login round trip, so if the API still answers 401
// the user stays put with an error instead of looping through login. Any successful v1
// response clears the marker, so a later expiry redirects again.
const LOGIN_REDIRECT = "/api/auth/logout?redirectToLogin=true";
const LOGIN_REDIRECT_MARKER = "apiV1LoginRedirect";
const LOGGED_OUT_PATH = /^\/(logout|expired|auth)(\/|$)/;
let loginRedirected = false;

function redirectToLoginOnce(): void {
  if (process.env.NEXT_PUBLIC_DEV_MODE === "true") return;
  if (loginRedirected || typeof window === "undefined") return;
  if (LOGGED_OUT_PATH.test(window.location.pathname)) return;
  loginRedirected = true;
  try {
    if (window.sessionStorage.getItem(LOGIN_REDIRECT_MARKER) !== null) return;
    window.sessionStorage.setItem(LOGIN_REDIRECT_MARKER, String(Date.now()));
  } catch {
    // Storage unavailable (private mode, blocked): the module flag alone still stops a burst.
  }
  Router.push(LOGIN_REDIRECT);
}

function clearLoginRedirectMarker(): void {
  try {
    window.sessionStorage.removeItem(LOGIN_REDIRECT_MARKER);
  } catch {
    // Nothing to clear.
  }
}

// Test-only: a fresh page load's module state. The sessionStorage marker is left alone.
export function resetLoginRedirectState(): void {
  loginRedirected = false;
}

// Attaches the shared cached access token to every v1 request, and handles a 401 on the
// way back. Read from node_modules/openapi-fetch@0.9.3's middleware API: `use()` takes
// objects with optional onRequest/onResponse hooks; onRequest must return the (possibly
// mutated) Request, onResponse may return undefined to leave the Response as it is.
const authMiddleware: Middleware = {
  async onRequest(req) {
    const token = await getAccessToken().catch((error: unknown) => {
      throw asNetworkError(error);
    });
    req.headers.set("Authorization", `Bearer ${token}`);
    return req;
  },
  onResponse(res) {
    if (res.status === 401) redirectToLoginOnce();
    else if (res.ok && typeof window !== "undefined") clearLoginRedirectMarker();
    return undefined;
  }
};

export const apiV1Client = createClient<paths>({
  baseUrl: API_V1_PREFIX,
  // openapi-fetch resolves `globalThis.fetch` once, at client-creation time (which for a
  // module-level singleton like this one is import time). Wrapping it in a closure
  // instead defers the lookup to call time, so test setup (MSW) that patches
  // `globalThis.fetch` after this module loads still takes effect.
  fetch: (...args: Parameters<typeof fetch>) =>
    fetch(...args).catch((error: unknown) => {
      throw asNetworkError(error);
    })
});
apiV1Client.use(authMiddleware);
