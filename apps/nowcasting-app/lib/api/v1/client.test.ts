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

import { resetTokenCache } from "../auth/token";
import { apiV1Client, ApiV1Error, isNonRetryableApiV1Error } from "./client";

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
