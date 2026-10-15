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
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

jest.mock("next/router", () => ({ __esModule: true, default: { push: jest.fn() } }));
jest.mock("@sentry/nextjs", () => ({ __esModule: true, captureException: jest.fn() }));

import Router from "next/router";

import { resetTokenCache } from "../auth/token";
import {
  apiV1Client,
  ApiV1Error,
  ApiV1NetworkError,
  isNonRetryableApiV1Error,
  resetLoginRedirectState
} from "./client";

let tokenCallCount = 0;

const server = setupServer(
  http.get("/api/get_token", () => {
    tokenCallCount++;
    return HttpResponse.json({ accessToken: "shared-token" });
  }),
  http.get("https://api.quartz.solar/v1/countries", ({ request }) => {
    return HttpResponse.json([{ authHeader: request.headers.get("authorization"), country: "GB" }]);
  }),
  http.get("https://api.quartz.solar/v1/forbidden", () =>
    HttpResponse.json({ detail: "not allowed" }, { status: 403 })
  ),
  http.get("https://api.quartz.solar/v1/unauthorised", () =>
    HttpResponse.json({ detail: "bad token" }, { status: 401 })
  ),
  http.get("https://api.quartz.solar/v1/unreachable", () => HttpResponse.error()),
  http.get("https://api.quartz.solar/v1/validation-error", () =>
    HttpResponse.json(
      { detail: [{ loc: ["query", "country"], msg: "field required", type: "value_error" }] },
      { status: 422 }
    )
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  tokenCallCount = 0;
});
afterAll(() => server.close());

beforeEach(() => resetTokenCache());

describe("apiV1Client", () => {
  test("attaches the shared bearer token to requests", async () => {
    const { data } = await apiV1Client.GET("/countries");
    expect((data as any)[0].authHeader).toBe("Bearer shared-token");
  });

  test("multiple client calls share one token fetch", async () => {
    await Promise.all([apiV1Client.GET("/countries"), apiV1Client.GET("/countries")]);
    expect(tokenCallCount).toBe(1);
  });

  test("a 403 response surfaces with status and body intact", async () => {
    const { error, response } = await apiV1Client.GET("/forbidden" as any);
    expect(response.status).toBe(403);
    const apiError = new ApiV1Error(response.status, error);
    expect(apiError.status).toBe(403);
    expect(apiError.body).toEqual({ detail: "not allowed" });
    expect(isNonRetryableApiV1Error(apiError)).toBe(true);
  });

  test("a 422 validation error surfaces with status and body intact, and is retryable", async () => {
    const { error, response } = await apiV1Client.GET("/validation-error" as any);
    expect(response.status).toBe(422);
    const apiError = new ApiV1Error(response.status, error);
    expect(apiError.status).toBe(422);
    expect((apiError.body as any).detail[0].msg).toBe("field required");
    expect(isNonRetryableApiV1Error(apiError)).toBe(false);
  });
});

describe("apiV1Client on 401", () => {
  const push = jest.mocked(Router.push);
  const LOGIN = "/api/auth/logout?redirectToLogin=true";
  const devMode = process.env.NEXT_PUBLIC_DEV_MODE;

  beforeEach(() => {
    push.mockClear();
    resetLoginRedirectState();
    window.sessionStorage.clear();
    window.history.pushState({}, "", "/");
    delete process.env.NEXT_PUBLIC_DEV_MODE;
  });
  afterAll(() => {
    if (devMode !== undefined) process.env.NEXT_PUBLIC_DEV_MODE = devMode;
  });

  test("sends the user to log in again, once for a burst of 401s", async () => {
    await Promise.all([
      apiV1Client.GET("/unauthorised" as any),
      apiV1Client.GET("/unauthorised" as any)
    ]);
    await apiV1Client.GET("/unauthorised" as any);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(LOGIN);
  });

  test("a 403 does not redirect: it means not entitled to this country", async () => {
    await apiV1Client.GET("/forbidden" as any);
    expect(push).not.toHaveBeenCalled();
  });

  test("no redirect loop when the API still answers 401 after logging in again", async () => {
    await apiV1Client.GET("/unauthorised" as any);
    expect(push).toHaveBeenCalledTimes(1);

    // The login round trip reloads the app: module state is fresh, the tab's session is not.
    resetLoginRedirectState();
    await apiV1Client.GET("/unauthorised" as any);
    expect(push).toHaveBeenCalledTimes(1);

    // A successful response ends the episode, so a later expiry redirects again.
    await apiV1Client.GET("/countries");
    resetLoginRedirectState();
    await apiV1Client.GET("/unauthorised" as any);
    expect(push).toHaveBeenCalledTimes(2);
  });

  test("no redirect from a logged-out page", async () => {
    for (const path of ["/logout", "/expired", "/auth/denied"]) {
      window.history.pushState({}, "", path);
      resetLoginRedirectState();
      await apiV1Client.GET("/unauthorised" as any);
    }
    expect(push).not.toHaveBeenCalled();
  });

  test("no redirect in dev mode", async () => {
    process.env.NEXT_PUBLIC_DEV_MODE = "true";
    await apiV1Client.GET("/unauthorised" as any);
    expect(push).not.toHaveBeenCalled();
  });
});

describe("apiV1Client network failure", () => {
  test("rejects with ApiV1NetworkError, so it can be told apart from a thrown bug", async () => {
    await expect(apiV1Client.GET("/unreachable" as any)).rejects.toBeInstanceOf(ApiV1NetworkError);
  });
});
