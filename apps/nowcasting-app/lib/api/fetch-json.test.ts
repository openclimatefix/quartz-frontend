import { afterAll, afterEach, beforeAll, describe, expect, test } from "@jest/globals";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { FetchJsonError, fetchJson } from "./fetch-json";

const BASE = "https://status.test";

let lastRequest: Request | null = null;

const server = setupServer(
  http.get(`${BASE}/ok`, ({ request }) => {
    lastRequest = request;
    return HttpResponse.json({ products: [] });
  }),
  http.get(`${BASE}/json-error`, () =>
    HttpResponse.json({ detail: "status store unavailable" }, { status: 503 })
  ),
  http.get(`${BASE}/html-error`, () =>
    HttpResponse.text("<html>Bad Gateway</html>", { status: 502 })
  ),
  http.get(`${BASE}/empty-error`, () => new HttpResponse(null, { status: 500 })),
  http.get(`${BASE}/not-json`, () => HttpResponse.text("not json at all", { status: 200 })),
  http.get(`${BASE}/unreachable`, () => HttpResponse.error())
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  lastRequest = null;
});
afterAll(() => server.close());

describe("fetchJson", () => {
  test("returns the parsed JSON body of a 2xx", async () => {
    await expect(fetchJson(`${BASE}/ok`)).resolves.toEqual({ products: [] });
  });

  // The Status API is unauthenticated and CORS `*`. A bearer token here would be sent to a
  // service that has no business seeing it, and `UI=true` is a data-API flag.
  test("sends no Authorization header and does not add the UI flag", async () => {
    await fetchJson(`${BASE}/ok`);

    expect(lastRequest).not.toBeNull();
    expect(lastRequest!.headers.get("authorization")).toBeNull();
    expect(new URL(lastRequest!.url).searchParams.has("UI")).toBe(false);
  });

  test("a non-2xx throws a FetchJsonError carrying the status and the JSON body", async () => {
    const error = await fetchJson(`${BASE}/json-error`).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(FetchJsonError);
    expect((error as FetchJsonError).status).toBe(503);
    expect((error as FetchJsonError).body).toEqual({ detail: "status store unavailable" });
  });

  // A reverse proxy's 502 page is HTML. The failure reported must be the 502, not a
  // SyntaxError from trying to parse it.
  test("a non-JSON error body is carried as text, and an empty one as null", async () => {
    const html = (await fetchJson(`${BASE}/html-error`).catch((e: unknown) => e)) as FetchJsonError;
    expect(html.status).toBe(502);
    expect(html.body).toBe("<html>Bad Gateway</html>");

    const empty = (await fetchJson(`${BASE}/empty-error`).catch(
      (e: unknown) => e
    )) as FetchJsonError;
    expect(empty.status).toBe(500);
    expect(empty.body).toBeNull();
  });

  test("a 2xx that is not JSON rejects rather than resolving to nothing", async () => {
    await expect(fetchJson(`${BASE}/not-json`)).rejects.toBeInstanceOf(Error);
    await expect(fetchJson(`${BASE}/not-json`)).rejects.not.toBeInstanceOf(FetchJsonError);
  });

  test("a network failure is fetch's own TypeError, not a FetchJsonError", async () => {
    const error = await fetchJson(`${BASE}/unreachable`).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TypeError);
  });

  // The fetcher must look `fetch` up when called, not when the module loads: MSW patches
  // the global after import, and a captured binding would bypass it.
  test("uses whatever globalThis.fetch is at call time", async () => {
    const original = globalThis.fetch;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return HttpResponse.json({ swapped: true });
    }) as unknown as typeof fetch;
    try {
      await expect(fetchJson(`${BASE}/ok`)).resolves.toEqual({ swapped: true });
      expect(called).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});
