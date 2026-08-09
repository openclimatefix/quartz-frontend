import { describe, expect, jest, test } from "@jest/globals";
import { API_PREFIX, SITES_API_PREFIX } from "../../constant";
import type { Scope } from "../../lib/domain/types";

const mockUseLoadDataFromApi = jest.fn();
jest.mock("./useLoadDataFromApi", () => ({
  useLoadDataFromApi: (...args: unknown[]) => mockUseLoadDataFromApi(...args)
}));

// Imported after the mock so useStatus picks up the mocked useLoadDataFromApi.
import { useSitesStatus, useSolarStatus } from "./useStatus";

describe("useStatus", () => {
  const scope: Scope = { country: "GB", source: "solar", regionType: "national" };

  test("useSolarStatus hits the GB status URL regardless of scope.country, carrying scope", () => {
    useSolarStatus({ ...scope, country: "NL" });
    expect(mockUseLoadDataFromApi).toHaveBeenCalledWith(`${API_PREFIX}/solar/GB/status`, {
      scope: { ...scope, country: "NL" }
    });
  });

  test("useSitesStatus hits the scope-less sites status URL, carrying scope", () => {
    useSitesStatus(scope);
    expect(mockUseLoadDataFromApi).toHaveBeenCalledWith(`${SITES_API_PREFIX}/api_status`, {
      scope
    });
  });
});
