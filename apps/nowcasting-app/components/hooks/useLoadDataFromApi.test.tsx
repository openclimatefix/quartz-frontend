import { describe, expect, jest, test } from "@jest/globals";
import type { Scope } from "../../lib/domain/types";

const mockUseSWR = jest.fn((..._args: unknown[]) => ({ data: undefined, error: undefined }));
jest.mock("swr", () => ({
  __esModule: true,
  default: (key: unknown, fetcher: unknown, config: unknown) => mockUseSWR(key, fetcher, config)
}));

// Imported after the mock so the hook picks up the mocked useSWR.
import { useLoadDataFromApi } from "./useLoadDataFromApi";

describe("useLoadDataFromApi", () => {
  test("a passed-through Scope never reaches useSWR's config", () => {
    const scope: Scope = { country: "GB", source: "solar", regionType: "site" };

    useLoadDataFromApi("https://example.test/sites", { scope });

    const swrConfig = (mockUseSWR.mock.calls[0] as unknown[])[2] as Record<string, unknown>;
    expect(swrConfig).not.toHaveProperty("scope");
    // The rest of the config is still forwarded, unaffected by stripping `scope` out.
    expect(swrConfig.keepPreviousData).toBe(true);
  });

  test("no scope at all still works, matching current call sites with no Scope yet", () => {
    expect(() => useLoadDataFromApi("https://example.test/sites")).not.toThrow();
  });
});
