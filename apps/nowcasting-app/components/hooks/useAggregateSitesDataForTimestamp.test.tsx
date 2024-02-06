import { describe, expect, test } from "@jest/globals";
import {
  formatDNORegionName,
} from "./useAggregateSitesDataForTimestamp";

describe("check formatDNORegionName ", () => {
  test("Check we are getting the correct respsonse", () => {
    expect(formatDNORegionName("UKPN (East)")).toBe("East (UKPN)");
    expect(formatDNORegionName("SSE")).toBe("SSE");
  });
});