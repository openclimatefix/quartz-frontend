/**
 * Error handling in the v1 SWR layer: the retry policy after the fast retries are spent, and
 * which failures reach Sentry.
 *
 * SWR 2.2.5's polling loop skips revalidation while the cache entry holds an error
 * (swr/dist/core/index.mjs, `execute()`: `if (!getCache().error && ...)`), so an errored query
 * is only re-asked if `onErrorRetry` schedules it.
 */
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
import { SWRConfig, type SWRConfiguration } from "swr";

jest.mock("next/router", () => ({ __esModule: true, default: { push: jest.fn() } }));
jest.mock("@sentry/nextjs", () => ({ __esModule: true, captureException: jest.fn() }));

import countriesFixture from "../../lib/api/v1/__fixtures__/countries.json";
import { resetTokenCache } from "../../lib/api/auth/token";
import { ApiV1Error, ApiV1NetworkError } from "../../lib/api/v1/client";
import * as queries from "../../lib/api/v1/queries";
import { normaliseCountries } from "../../lib/domain/normalise";
import {
  MAX_RETRIES,
  apiV1SwrOptions,
  createErrorReporter,
  isReportableError,
  manifestSwrOptions,
  useApiQuery
} from "./query";

const V1 = "https://api.quartz.solar/v1";
const FIVE_MINUTES_MS = 5 * 60 * 1000;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

type OnErrorRetry = NonNullable<SWRConfiguration["onErrorRetry"]>;

/** The production `onErrorRetry` with `MAX_RETRIES` already used up. */
const exhausted =
  (options: SWRConfiguration): OnErrorRetry =>
  (error, key, config, revalidate, opts) =>
    options.onErrorRetry!(error, key, config, revalidate, {
      ...opts,
      retryCount: opts.retryCount + MAX_RETRIES
    });

describe("an errored query keeps trying", () => {
  let status = 500;
  let calls = 0;
  const server = setupServer(
    http.get("/api/get_token", () => HttpResponse.json({ accessToken: "t" })),
    http.get(`${V1}/countries`, () => {
      calls += 1;
      // One failure, then healthy for good.
      return calls === 1
        ? HttpResponse.json({ detail: "boom" }, { status })
        : HttpResponse.json(countriesFixture);
    })
  );
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterAll(() => server.close());
  beforeEach(() => {
    resetTokenCache();
    calls = 0;
    status = 500;
  });

  test("an errored manifest query recovers on the next poll once the API is healthy", async () => {
    const { result } = renderHook(
      () =>
        useApiQuery(queries.countries(), normaliseCountries, {
          ...manifestSwrOptions,
          refreshInterval: 100,
          dedupingInterval: 0,
          onErrorRetry: exhausted(manifestSwrOptions)
        }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.error).toBeTruthy());

    // Ten poll intervals later the API has been healthy the whole time.
    await new Promise((r) => setTimeout(r, 1000));

    expect(calls).toBeGreaterThan(1);
    expect(result.current.data).toBeDefined();
  });

  test("a 403 is re-asked at the refresh interval, since entitlement can change", async () => {
    status = 403;
    const { result } = renderHook(
      () =>
        useApiQuery(queries.countries(), normaliseCountries, {
          ...apiV1SwrOptions,
          refreshInterval: 100,
          dedupingInterval: 0
        }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.error).toBeTruthy());
    await waitFor(() => expect(result.current.data).toBeDefined(), { timeout: 1000 });
    expect(result.current.error).toBeUndefined();
  });
});

describe("onErrorRetry delays", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const delayOf = (
    options: SWRConfiguration,
    error: unknown,
    retryCount: number
  ): number | undefined => {
    const revalidate = jest.fn(() => Promise.resolve(true));
    options.onErrorRetry!(error, "k", options as Parameters<OnErrorRetry>[2], revalidate, {
      retryCount,
      dedupe: true
    });
    for (let elapsed = 0; elapsed <= 2 * 60 * 60 * 1000; elapsed += 1000) {
      jest.advanceTimersByTime(1000);
      if (revalidate.mock.calls.length > 0) return elapsed + 1000;
    }
    return undefined;
  };

  test("fast backoff while retries remain", () => {
    expect(delayOf(apiV1SwrOptions, new ApiV1Error(503, null), 1)).toBe(1000);
    expect(delayOf(apiV1SwrOptions, new ApiV1Error(503, null), 3)).toBe(4000);
  });

  test("the refresh interval once the fast retries are spent", () => {
    expect(delayOf(apiV1SwrOptions, new ApiV1Error(500, null), MAX_RETRIES)).toBe(FIVE_MINUTES_MS);
    expect(delayOf(apiV1SwrOptions, new ApiV1Error(500, null), MAX_RETRIES + 10)).toBe(
      FIVE_MINUTES_MS
    );
  });

  test("a 403 skips the fast retries and goes straight to the refresh interval", () => {
    expect(delayOf(apiV1SwrOptions, new ApiV1Error(403, null), 1)).toBe(FIVE_MINUTES_MS);
  });

  test("a failed manifest is re-asked after five minutes, not its hourly refresh", () => {
    expect(delayOf(manifestSwrOptions, new ApiV1Error(500, null), MAX_RETRIES)).toBe(
      FIVE_MINUTES_MS
    );
  });
});

describe("Sentry reporting", () => {
  const axiosError = (status?: number, code?: string) => ({
    isAxiosError: true,
    code,
    response: status === undefined ? undefined : { status }
  });

  test.each([
    [400, true],
    [401, false],
    [403, false],
    [404, false],
    [422, true],
    [500, true],
    [503, true]
  ])("v1 %i reported: %s", (status, reported) => {
    expect(isReportableError(new ApiV1Error(status, null))).toBe(reported);
  });

  test.each([
    [400, true],
    [401, false],
    [403, false],
    [404, false],
    [500, true]
  ])("v0 Axios %i reported: %s", (status, reported) => {
    expect(isReportableError(axiosError(status))).toBe(reported);
  });

  test("network failures are not reported, a thrown bug is", () => {
    expect(isReportableError(new ApiV1NetworkError(new TypeError("Failed to fetch")))).toBe(false);
    expect(isReportableError(axiosError(undefined, "ERR_NETWORK"))).toBe(false);
    expect(isReportableError(new TypeError("Cannot read properties of undefined"))).toBe(true);
  });

  test("one event per failing key per failure episode", () => {
    const capture = jest.fn();
    const reporter = createErrorReporter(capture);
    const error = new ApiV1Error(503, null);

    // First attempt and its retries: one event.
    for (let i = 0; i < 7; i++) reporter.onError(error, "a");
    reporter.onError(error, "b");
    expect(capture).toHaveBeenCalledTimes(2);

    // A success ends key a's episode; its next failure is a new one.
    reporter.onSuccess(null, "a");
    reporter.onError(error, "a");
    reporter.onError(error, "b");
    expect(capture).toHaveBeenCalledTimes(3);
  });

  test("an unreported failure does not open an episode", () => {
    const capture = jest.fn();
    const reporter = createErrorReporter(capture);
    reporter.onError(new ApiV1Error(403, null), "a");
    reporter.onError(new ApiV1Error(500, null), "a");
    expect(capture).toHaveBeenCalledTimes(1);
  });
});
