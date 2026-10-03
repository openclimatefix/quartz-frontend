/**
 * A plain JSON `GET` for APIs that want nothing from us: no bearer token, no `UI=true`
 * flag, no login redirect on 401. Today that is the Status API alone (unauthenticated,
 * `access-control-allow-origin: *`). The v1 data APIs go through `lib/api/v1/client.ts`,
 * which carries all of the above; the v0 ones through `axiosFetcherAuth`. Reaching for this
 * for an authenticated endpoint would simply get a 401, so the choice is hard to get wrong.
 *
 * Replaces the old `axiosFetcher` (components/helpers/utils.ts), whose only caller was the
 * status hook. Dropping axios there means one HTTP stack for everything new, and MSW
 * intercepts `fetch` the same way in tests as it does for the v1 client.
 */

/**
 * Carries the HTTP status so the retry policy can branch on it rather than string-sniffing
 * the message: `isNonRetryableError` (hooks/data/query.ts) stops fast-retrying one of these
 * on a 4xx other than 408/429, since a 404 from a misconfigured URL will not become a 200.
 * Also carries the decoded body — JSON when it parsed, the raw text when it did not — for
 * whatever a caller wants to say about it.
 */
export class FetchJsonError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(url: string, status: number, body: unknown) {
    super(`GET ${url} failed (${status})`);
    this.name = "FetchJsonError";
    this.status = status;
    this.body = body;
  }
}

/**
 * The body as JSON if it is JSON, otherwise as text, otherwise `null`. Error bodies are the
 * reason this exists: a 503 from a reverse proxy is HTML, and a `.json()` that throws there
 * would replace the real failure with a SyntaxError.
 */
const readBody = async (response: Response): Promise<unknown> => {
  const text = await response.text().catch(() => "");
  if (text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/**
 * Resolves `globalThis.fetch` at call time, not at module load: test setup (MSW) patches the
 * global after modules are imported, so a `fetch` captured in a module-scope binding would
 * be the unpatched one. Same reasoning as the `fetch` wrapper in `lib/api/v1/client.ts`.
 *
 * Network failures (offline, DNS, CORS) are left as the `TypeError` `fetch` rejects with;
 * only an HTTP response that is not 2xx becomes a `FetchJsonError`. A 2xx whose body is not
 * JSON throws too — the caller asked for JSON, and a silent `undefined` would read as "no
 * data" rather than "the API is broken".
 */
export const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await globalThis.fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new FetchJsonError(url, response.status, await readBody(response));
  return (await response.json()) as T;
};
