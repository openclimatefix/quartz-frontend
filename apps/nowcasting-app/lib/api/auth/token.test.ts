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

const push = jest.fn();
jest.mock("next/router", () => ({
  __esModule: true,
  default: { push: (...args: unknown[]) => push(...args) }
}));

const captureException = jest.fn();
jest.mock("@sentry/nextjs", () => ({
  __esModule: true,
  captureException: (...args: unknown[]) => captureException(...args)
}));

// Imported after the mocks above so the module under test picks them up.
import { getAccessToken, resetTokenCache } from "./token";
import { getGlobalState } from "../../../components/helpers/globalState";

let callCount = 0;
let tokenValue = "token-1";
let respondWith: (() => Response) | null = null;

const server = setupServer(
  http.get("/api/get_token", () => {
    callCount++;
    if (respondWith) return respondWith();
    return HttpResponse.json({ accessToken: tokenValue });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  callCount = 0;
  tokenValue = "token-1";
  respondWith = null;
  push.mockClear();
  captureException.mockClear();
});
afterAll(() => server.close());

beforeEach(() => resetTokenCache());

describe("getAccessToken", () => {
  test("concurrent callers share one in-flight request", async () => {
    const [a, b] = await Promise.all([getAccessToken(), getAccessToken()]);
    expect(a).toBe("token-1");
    expect(b).toBe("token-1");
    expect(callCount).toBe(1);
  });

  test("a call after TTL expiry refetches", async () => {
    const dateSpy = jest.spyOn(Date, "now");
    dateSpy.mockReturnValue(0);
    await getAccessToken();
    expect(callCount).toBe(1);

    tokenValue = "token-2";
    dateSpy.mockReturnValue(120_000); // well past the 60s TTL
    const second = await getAccessToken();
    expect(second).toBe("token-2");
    expect(callCount).toBe(2);

    dateSpy.mockRestore();
  });

  test("a rejection is not cached; the next call retries", async () => {
    respondWith = () => HttpResponse.json({ message: "boom" }, { status: 500 });
    await expect(getAccessToken()).rejects.toThrow("Failed to get access token (500): boom");
    expect(callCount).toBe(1);

    respondWith = null;
    const token = await getAccessToken();
    expect(token).toBe("token-1");
    expect(callCount).toBe(2);
  });

  test("an expired trial still resolves a token and records when it ended", async () => {
    respondWith = () =>
      HttpResponse.json({
        accessToken: "token-1",
        trialExpired: true,
        trialEndsAt: "2026-09-01T00:00:00Z"
      });
    await expect(getAccessToken()).resolves.toBe("token-1");
    expect(getGlobalState("trialExpiredAt")).toBe("2026-09-01T00:00:00Z");
    expect(push).not.toHaveBeenCalled();
  });

  test("access_denied redirects to /auth/denied and throws", async () => {
    respondWith = () =>
      HttpResponse.json({ error: "access_denied", message: "nope" }, { status: 403 });
    await expect(getAccessToken()).rejects.toThrow("access_denied");
    expect(push).toHaveBeenCalledWith("/auth/denied?error_description=nope");
  });

  test("a JSON parse failure of the error body reports to Sentry and falls through", async () => {
    respondWith = () => new Response("not json", { status: 500, statusText: "Server Error" });
    await expect(getAccessToken()).rejects.toThrow(/Failed to get access token \(500\)/);
    expect(captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: { error: "get_token_parse_failure" } })
    );
  });
});
