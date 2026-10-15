import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// Covers pages/api/get_token.ts. It lives here because a test file under pages/ would be
// served as an API route.

let mockSession: unknown = null;
jest.mock("@auth0/nextjs-auth0", () => ({
  __esModule: true,
  withApiAuthRequired: (handler: unknown) => handler,
  getAccessToken: () => Promise.resolve({ accessToken: "test-token" }),
  getSession: () => Promise.resolve(mockSession)
}));

// The route decides between its dev and deployed handlers when it is first loaded.
process.env.NEXT_PUBLIC_DEV_MODE = "false";
const handler = require("../../../pages/api/get_token").default;

const call = async () => {
  const json = jest.fn((_body: unknown) => undefined);
  const res = { status: jest.fn((_code: number) => ({ json, end: jest.fn() })) };
  await handler({}, res);
  return { status: res.status.mock.calls[0]?.[0], body: json.mock.calls[0]?.[0] };
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_DEV_MODE = "false";
  mockSession = null;
});

describe("/api/get_token entitlement fields", () => {
  test("returns the cleaned products claim and the countries it entitles", async () => {
    mockSession = { user: { products: ["GB-Solar", "asset-solar"], countries: ["NL"] } };
    expect(await call()).toEqual({
      status: 200,
      body: { accessToken: "test-token", products: ["gb-solar", "asset-solar"], countries: ["GB"] }
    });
  });

  test("with no products claim, `countries` comes from the countries claim", async () => {
    mockSession = { user: { countries: ["nl"] } };
    expect(await call()).toEqual({
      status: 200,
      body: { accessToken: "test-token", products: [], countries: ["NL"] }
    });
  });

  test("with no session, both are empty", async () => {
    expect(await call()).toEqual({
      status: 200,
      body: { accessToken: "test-token", products: [], countries: [] }
    });
  });
});
