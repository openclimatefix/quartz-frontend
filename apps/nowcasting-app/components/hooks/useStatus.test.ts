import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test
} from "@jest/globals";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { SWRConfig } from "swr";

import type { ProductsResponse } from "../types";
import { FetchJsonError } from "../../lib/api/fetch-json";
import { normaliseLevel, normaliseMessage, useProductStatuses } from "./useStatus";

describe("normaliseLevel", () => {
  test("passes through every level the API spec publishes", () => {
    // ProductStatusValue, spec v0.2.0.
    expect(normaliseLevel("ok")).toBe("ok");
    expect(normaliseLevel("info")).toBe("info");
    expect(normaliseLevel("warning")).toBe("warning");
    expect(normaliseLevel("error")).toBe("error");
    expect(normaliseLevel("unknown")).toBe("unknown");
  });

  test("tolerates casing and whitespace", () => {
    expect(normaliseLevel(" Warning ")).toBe("warning");
    expect(normaliseLevel("ERROR")).toBe("error");
  });

  test("falls back to unknown, not info, for a level it cannot read", () => {
    // Failing towards visible is deliberate — silently swallowing a level we do not know
    // would hide a real incident. `unknown` rather than `info` because `info` now means a
    // deliberate non-degraded notice, and it ranks lower, so it would fail quiet.
    expect(normaliseLevel("degraded")).toBe("unknown");
    expect(normaliseLevel("")).toBe("unknown");
    expect(normaliseLevel(undefined)).toBe("unknown");
    expect(normaliseLevel(null)).toBe("unknown");
    expect(normaliseLevel(3)).toBe("unknown");
  });
});

describe("normaliseMessage", () => {
  test("trims a string message", () => {
    expect(normaliseMessage("  Forecast delayed  ")).toBe("Forecast delayed");
    expect(normaliseMessage("")).toBe("");
  });

  test("returns empty string for anything that is not a string", () => {
    // The point is that none of these throw. `.trim()` on a non-string would take down the
    // whole render, since this runs in a hook body — one malformed field would blank the app
    // rather than drop one banner row. An empty message means the row is not drawn.
    expect(normaliseMessage(null)).toBe("");
    expect(normaliseMessage(undefined)).toBe("");
    expect(normaliseMessage(42)).toBe("");
    expect(normaliseMessage({ text: "nope" })).toBe("");
    expect(normaliseMessage(["nope"])).toBe("");
  });
});

/**
 * The transport: the real `fetchJson` over MSW, so the hook is tested the way it runs —
 * no bearer token, no `UI=true`, one shared `/products` request, and an outage that stays
 * quiet rather than throwing, reporting or freezing.
 */
describe("useProductStatuses", () => {
  const STATUS_URL = "https://status.test";
  const PRODUCTS_URL = `${STATUS_URL}/products`;

  const PAYLOAD: ProductsResponse = {
    status: "warning",
    products: [
      {
        key: "gb-solar",
        name: "GB Solar",
        status: "WARNING " as "warning",
        message: "  Late  ",
        source: "manual",
        updatedAt: "2026-10-03T09:00:00Z"
      },
      {
        key: "nl-solar",
        name: "NL Solar",
        status: "ok",
        message: "Operating within normal parameters.",
        source: "manual",
        updatedAt: "2026-10-03T09:00:00Z"
      },
      // Served by the API, unknown to the registry: must be dropped, not rendered.
      {
        key: "de-solar",
        name: "DE Solar",
        status: "error",
        message: "Down",
        source: "manual",
        updatedAt: "2026-10-03T09:00:00Z"
      }
    ],
    lastUpdated: "2026-10-03T09:00:00Z"
  };

  let requestCount = 0;
  let lastRequest: Request | null = null;

  const server = setupServer(
    http.get(PRODUCTS_URL, ({ request }) => {
      requestCount++;
      lastRequest = request;
      return HttpResponse.json(PAYLOAD);
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
    lastRequest = null;
    onError.mockClear();
  });
  afterAll(() => {
    if (priorStatusUrl === undefined) delete process.env.NEXT_PUBLIC_STATUS_URL;
    else process.env.NEXT_PUBLIC_STATUS_URL = priorStatusUrl;
    server.close();
  });

  // The SWR cache, owned by the test: fresh per test so the minute-long deduping interval
  // cannot let one payload answer the next test, and owned so a test can wait on the
  // *settled* entry — `requestCount` ticks when the handler runs, before the response has
  // reached SWR. `_app.tsx`'s global `onError` is modelled so the test can show the hook
  // keeps a status-service outage out of it.
  let cache = new Map();
  type CacheEntry = { data?: ProductsResponse; error?: unknown } | undefined;
  const entry = (): CacheEntry => cache.get(PRODUCTS_URL);
  const onError = jest.fn();
  beforeEach(() => {
    cache = new Map();
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(SWRConfig, { value: { provider: () => cache, onError } }, children);

  test("fetches every product once, unauthenticated, and keeps the shown known ones normalised", async () => {
    const { result } = renderHook(() => useProductStatuses(["gb-solar", "nl-solar"]), {
      wrapper
    });

    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(result.current.map((p) => [p.key, p.status, p.message])).toEqual([
      ["gb-solar", "warning", "Late"],
      ["nl-solar", "ok", "Operating within normal parameters."]
    ]);
    expect(requestCount).toBe(1);
    expect(lastRequest!.headers.get("authorization")).toBeNull();
    expect(new URL(lastRequest!.url).searchParams.has("UI")).toBe(false);
  });

  test("drops a product the registry does not know even when asked for it", async () => {
    const { result } = renderHook(
      () => useProductStatuses(["gb-solar", "de-solar" as "gb-solar"]),
      { wrapper }
    );

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].key).toBe("gb-solar");
  });

  test("an empty shown list still shares the request and yields []", async () => {
    const { result } = renderHook(() => useProductStatuses([]), { wrapper });

    await waitFor(() => expect(entry()?.data).toBeDefined());
    expect(requestCount).toBe(1);
    expect(result.current).toEqual([]);
  });

  test("a body whose products is not an array yields []", async () => {
    server.use(
      http.get(PRODUCTS_URL, () => {
        requestCount++;
        return HttpResponse.json({ products: "nope" });
      })
    );
    const { result } = renderHook(() => useProductStatuses(["gb-solar"]), { wrapper });

    await waitFor(() => expect(entry()?.data).toEqual({ products: "nope" }));
    expect(result.current).toEqual([]);
  });

  // The decision: retry quietly, never surface the status service's own outage — not as a
  // banner, not as a Sentry event. The global reporter must not hear about it.
  test("an outage yields [] and is not passed to the global onError", async () => {
    server.use(
      http.get(PRODUCTS_URL, () => {
        requestCount++;
        return HttpResponse.json({ detail: "status store unavailable" }, { status: 503 });
      })
    );
    const { result } = renderHook(() => useProductStatuses(["gb-solar"]), { wrapper });

    await waitFor(() => expect(entry()?.error).toBeInstanceOf(FetchJsonError));
    expect((entry()?.error as FetchJsonError).status).toBe(503);
    expect(result.current).toEqual([]);
    expect(onError).not.toHaveBeenCalled();
  });

  test("fetches nothing when NEXT_PUBLIC_STATUS_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_STATUS_URL;
    try {
      const { result } = renderHook(() => useProductStatuses(["gb-solar"]), { wrapper });

      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(result.current).toEqual([]);
      expect(requestCount).toBe(0);
    } finally {
      process.env.NEXT_PUBLIC_STATUS_URL = STATUS_URL;
    }
  });
});
