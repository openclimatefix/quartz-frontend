/**
 * The header lamp's status, read off the Status API's `/products` payload via the same hook
 * the banner uses. MSW serves the payload; nothing here mocks `useProductStatuses`, so what
 * is pinned is the whole path from wire to lamp: product lookup, level folding, message
 * fallback, and the one-request-shared-by-all property that makes a lamp free.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { SWRConfig } from "swr";

import type { ProductStatus, ProductsResponse, StatusLevel } from "../../components/types";
import { useProductStatuses } from "../../components/hooks/useStatus";
import { FetchJsonError } from "../../lib/api/fetch-json";
import { lampLevelFor, useCountryStatus } from "./use-country-status";

const STATUS_URL = "https://status.test";
const PRODUCTS_URL = `${STATUS_URL}/products`;

const product = (key: string, status: StatusLevel, message: string | null): ProductStatus => ({
  key,
  name: key,
  status,
  message,
  source: "manual",
  updatedAt: "2026-10-03T09:00:00Z"
});

const payload = (...products: ProductStatus[]): ProductsResponse => ({
  status: "ok",
  products,
  lastUpdated: "2026-10-03T09:00:00Z"
});

/** A response the test holds open and releases by hand, for the loading-state test. */
type Gate = { promise: Promise<void>; resolve: () => void };
const deferred = (): Gate => {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

let requestCount = 0;
let served: ProductsResponse = payload();
let gate: Gate | null = null;

const server = setupServer(
  http.get(PRODUCTS_URL, async () => {
    requestCount++;
    if (gate) await gate.promise;
    return HttpResponse.json(served);
  })
);

const priorStatusUrl = process.env.NEXT_PUBLIC_STATUS_URL;

beforeAll(() => {
  process.env.NEXT_PUBLIC_STATUS_URL = STATUS_URL;
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
  requestCount = 0;
  // A failed assertion must not leave the handler, and so the test run, hanging.
  gate?.resolve();
  gate = null;
});
afterAll(() => {
  if (priorStatusUrl === undefined) delete process.env.NEXT_PUBLIC_STATUS_URL;
  else process.env.NEXT_PUBLIC_STATUS_URL = priorStatusUrl;
  server.close();
});

/**
 * The SWR cache, owned by the test. A fresh one per test because the hook's deduping
 * interval is a minute, so a shared cache would let the first payload answer every later
 * test — and owned rather than anonymous so a test can wait on the *settled* entry.
 * `requestCount` ticks when the MSW handler runs, which is before the response has reached
 * SWR, so waiting on it alone would assert against the initial state.
 */
let cache = new Map();
type CacheEntry = { data?: ProductsResponse; error?: unknown } | undefined;
const entry = (): CacheEntry => cache.get(PRODUCTS_URL);
const waitForData = () => waitFor(() => expect(entry()?.data).toBeDefined());
const waitForError = () => waitFor(() => expect(entry()?.error).toBeInstanceOf(FetchJsonError));

beforeEach(() => {
  served = payload();
  cache = new Map();
});

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(SWRConfig, { value: { provider: () => cache } }, children);

const renderStatus = (code: string) => renderHook(() => useCountryStatus(code), { wrapper });

describe("lampLevelFor", () => {
  test.each<[StatusLevel, string]>([
    ["ok", "ok"],
    ["error", "error"],
    ["warning", "warning"],
    // A level we could not read must fail loud, consistent with `severityRank`.
    ["unknown", "warning"],
    // A deliberate notice is still worth a lamp and a tooltip.
    ["info", "warning"]
  ])("%s -> %s", (level, lamp) => {
    expect(lampLevelFor(level)).toBe(lamp);
  });
});

describe("useCountryStatus", () => {
  test("GB on error reports error with the product's message", async () => {
    served = payload(product("gb-solar", "error", "  Forecast pipeline down  "));
    const { result } = renderStatus("GB");

    await waitFor(() => expect(result.current.level).toBe("error"));
    expect(result.current.message).toBe("Forecast pipeline down");
  });

  test("NL on warning reports warning", async () => {
    served = payload(product("gb-solar", "ok", "fine"), product("nl-solar", "warning", "Late"));
    const { result } = renderStatus("NL");

    await waitFor(() => expect(result.current).toEqual({ level: "warning", message: "Late" }));
  });

  // An ok country must carry no message at all: the toggle keys its lamp and tooltip off the
  // message being present, so an empty-string placeholder — or the API's own "Operating
  // within normal parameters." — would put a lamp on every country in the header.
  test("GB ok reports ok with a null message, even though the API sent one", async () => {
    served = payload(product("gb-solar", "ok", "Operating within normal parameters."));
    const { result } = renderStatus("GB");

    await waitForData();
    expect(requestCount).toBe(1);
    expect(result.current).toEqual({ level: "ok", message: null });
  });

  test("a non-ok product with no message gets a generic one, so the lamp has a tooltip", async () => {
    served = payload(product("nl-solar", "warning", null));
    const { result } = renderStatus("NL");

    await waitFor(() => expect(result.current.level).toBe("warning"));
    expect(result.current.message).toBe("NL Solar status: warning");
  });

  test("info folds to warning", async () => {
    served = payload(product("gb-solar", "info", "Planned maintenance 10:00-11:00"));
    const { result } = renderStatus("GB");

    await waitFor(() =>
      expect(result.current).toEqual({
        level: "warning",
        message: "Planned maintenance 10:00-11:00"
      })
    );
  });

  test("unknown folds to warning", async () => {
    served = payload(product("gb-solar", "unknown", null));
    const { result } = renderStatus("GB");

    await waitFor(() => expect(result.current.level).toBe("warning"));
    expect(result.current.message).toBe("GB Solar status: unknown");
  });

  // Unrecognised wire values normalise to `unknown` upstream, so they light the lamp too.
  test("a level the app does not recognise lights a warning lamp", async () => {
    served = payload(product("gb-solar", "degraded" as StatusLevel, "Hmm"));
    const { result } = renderStatus("GB");

    await waitFor(() => expect(result.current).toEqual({ level: "warning", message: "Hmm" }));
  });

  // DE's `de-solar` is a product Auth0 can grant but the status registry does not list, so
  // even an incident the API reports for it must not reach the lamp — the app has no row to
  // attribute it to. It also adds nothing to the (shared) request.
  test("a country whose product the registry does not know is ok with nothing to say", async () => {
    served = payload(product("de-solar", "error", "DE is on fire"));
    const { result } = renderStatus("DE");

    expect(result.current).toEqual({ level: "ok", message: null });
    // Once the shared body has landed, the answer must not have changed.
    await waitForData();
    expect(result.current).toEqual({ level: "ok", message: null });
  });

  test("a code this build has no config for is ok and does not throw", () => {
    const { result } = renderStatus("XX");

    expect(result.current).toEqual({ level: "ok", message: null });
  });

  test("a product missing from the response is ok", async () => {
    served = payload(product("nl-solar", "error", "NL down"));
    const { result } = renderStatus("GB");

    await waitForData();
    expect(result.current).toEqual({ level: "ok", message: null });
  });

  test("is ok while the response is loading, and never throws", async () => {
    served = payload(product("gb-solar", "error", "Down"));
    gate = deferred();
    const { result } = renderStatus("GB");

    await waitFor(() => expect(requestCount).toBe(1));
    expect(entry()?.data).toBeUndefined();
    expect(result.current).toEqual({ level: "ok", message: null });

    gate.resolve();
    await waitFor(() => expect(result.current.level).toBe("error"));
  });

  test("is ok when the status service is failing", async () => {
    server.use(
      http.get(PRODUCTS_URL, () => {
        requestCount++;
        return HttpResponse.json({}, { status: 503 });
      })
    );
    const { result } = renderStatus("GB");

    // Wait for the failure to reach SWR, not just for the handler to run. The retry backoff
    // starts at a second, so this is the steady state the test sees.
    await waitForError();
    expect((entry()?.error as FetchJsonError).status).toBe(503);
    expect(result.current).toEqual({ level: "ok", message: null });
  });

  test("is ok and fetches nothing when NEXT_PUBLIC_STATUS_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_STATUS_URL;
    try {
      const { result } = renderStatus("GB");

      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(result.current).toEqual({ level: "ok", message: null });
      expect(requestCount).toBe(0);
    } finally {
      process.env.NEXT_PUBLIC_STATUS_URL = STATUS_URL;
    }
  });

  // The whole point of reading the lamp off the banner's hook: a page with the banner and
  // a lamp per country must still cost one request, and the two must see the same body.
  test("the banner and every lamp share one request", async () => {
    served = payload(product("gb-solar", "error", "GB down"), product("nl-solar", "ok", "fine"));

    const { result } = renderHook(
      () => ({
        banner: useProductStatuses(["gb-solar", "nl-solar"]),
        gb: useCountryStatus("GB"),
        nl: useCountryStatus("NL"),
        de: useCountryStatus("DE")
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.banner).toHaveLength(2));
    expect(result.current.gb).toEqual({ level: "error", message: "GB down" });
    expect(result.current.nl).toEqual({ level: "ok", message: null });
    expect(result.current.de).toEqual({ level: "ok", message: null });
    expect(requestCount).toBe(1);
  });
});
