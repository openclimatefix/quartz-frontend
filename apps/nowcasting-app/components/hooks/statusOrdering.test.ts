import { describe, expect, test } from "@jest/globals";
import { orderStatuses } from "./useStatus";
import { ProductStatus, StatusLevel } from "../types";

const status = (
  key: string,
  level: StatusLevel,
  message: string | null = "something happened",
  updatedAt: string | null = "2026-08-18T10:00:00.000Z"
): ProductStatus => ({
  key,
  name: key,
  status: level,
  message,
  source: "manual",
  updatedAt
});

describe("orderStatuses", () => {
  test("drops ok, whatever it says", () => {
    // The Status API always sends a message — every product reads "Operating within normal
    // parameters." today — so an ok row must be dropped on its level, not its text.
    // Without this the app carries a permanent banner.
    expect(
      orderStatuses([status("gb-solar", "ok", "Operating within normal parameters.")])
    ).toEqual([]);
  });

  test("drops a row with no message to show", () => {
    expect(orderStatuses([status("gb-solar", "error", "   ")])).toEqual([]);
    // `message` is nullable in the spec — a product can carry a status with nothing to say.
    expect(orderStatuses([status("gb-solar", "error", null)])).toEqual([]);
  });

  test("sorts worst first, matching the order the API rolls up with", () => {
    // The API's own severity order is ok < info < unknown < warning < error (spec v0.2.0);
    // this is that, reversed. A UI that disagreed would sort a product above the very
    // rollup value the API derived from it.
    const ordered = orderStatuses([
      status("gb-solar", "info"),
      status("nl-solar", "error"),
      status("asset-solar", "warning"),
      status("unregistered", "unknown")
    ]);
    expect(ordered.map((s) => s.status)).toEqual(["error", "warning", "unknown", "info"]);
  });

  test("breaks ties on the configured product order, not payload order", () => {
    const ordered = orderStatuses([
      status("asset-solar", "warning"),
      status("nl-solar", "warning"),
      status("gb-solar", "warning")
    ]);
    expect(ordered.map((s) => s.key)).toEqual(["gb-solar", "nl-solar", "asset-solar"]);
  });

  test("keeps unknown visible, ranked below warning", () => {
    const ordered = orderStatuses([status("gb-solar", "unknown"), status("nl-solar", "warning")]);
    expect(ordered.map((s) => s.status)).toEqual(["warning", "unknown"]);
  });
});
