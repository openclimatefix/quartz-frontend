import { describe, expect, test } from "@jest/globals";
import { statusDismissalId } from "./useDismissedStatuses";
import { ProductStatus } from "../types";

const incident = (updatedAt: string | null, message: string): ProductStatus => ({
  key: "gb-solar",
  name: "GB Solar",
  status: "error",
  message,
  source: "manual",
  updatedAt
});

describe("statusDismissalId", () => {
  test("is stable across re-polls of the same incident", () => {
    const a = incident("2026-08-18T10:00:00.000Z", "Forecast delayed");
    const b = incident("2026-08-18T10:00:00.000Z", "Forecast delayed");
    expect(statusDismissalId(a)).toBe(statusDismissalId(b));
  });

  test("changes when the incident is updated, so a dismissed row returns", () => {
    // This is the whole reason the id is `key:updatedAt` rather than just `key`: dismissing
    // means "I have read this", not "hide this product forever".
    const before = incident("2026-08-18T10:00:00.000Z", "Forecast delayed");
    const after = incident("2026-08-18T11:30:00.000Z", "Forecast delayed by 2 hours");
    expect(statusDismissalId(before)).not.toBe(statusDismissalId(after));
  });

  test("still separates incidents when updatedAt is null", () => {
    // `updatedAt` is nullable in the spec. Keying on it raw would give every unstamped
    // incident on a product the same id, so dismissing one would swallow the next.
    const before = incident(null, "Forecast delayed");
    const after = incident(null, "Forecast delayed by 2 hours");
    expect(statusDismissalId(before)).not.toBe(statusDismissalId(after));
    expect(statusDismissalId(before)).toBe(statusDismissalId(incident(null, "Forecast delayed")));
  });

  test("is scoped per product", () => {
    const gb = incident("2026-08-18T10:00:00.000Z", "Forecast delayed");
    const nl = { ...gb, key: "nl-solar" };
    expect(statusDismissalId(gb)).not.toBe(statusDismissalId(nl));
  });
});
