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

// 403 means the caller is not, and will not become, authorised for this request — retrying
// on the same token cannot succeed. Everything else (network blips, 429s, 5xxs, 422
// validation errors from a since-fixed caller bug) is worth a retry. Phase 4's SWR layer
// uses this to decide onErrorRetry behaviour.
export function isNonRetryableApiV1Error(error: unknown): error is ApiV1Error {
  return error instanceof ApiV1Error && error.status === 403;
}

// Attaches the shared cached access token to every v1 request. Read from
// node_modules/openapi-fetch@0.9.3's middleware API: `use()` takes objects with
// optional onRequest/onResponse hooks, and onRequest must return the (possibly mutated)
// Request.
const authMiddleware: Middleware = {
  async onRequest(req) {
    const token = await getAccessToken();
    req.headers.set("Authorization", `Bearer ${token}`);
    return req;
  }
};

export const apiV1Client = createClient<paths>({
  baseUrl: API_V1_PREFIX,
  // openapi-fetch resolves `globalThis.fetch` once, at client-creation time (which for a
  // module-level singleton like this one is import time). Wrapping it in a closure
  // instead defers the lookup to call time, so test setup (MSW) that patches
  // `globalThis.fetch` after this module loads still takes effect.
  fetch: (...args: Parameters<typeof fetch>) => fetch(...args)
});
apiV1Client.use(authMiddleware);
