import { describe, expect, test } from "@jest/globals";
import { normaliseLevel, normaliseMessage } from "./useStatus";

describe("normaliseLevel", () => {
  test("passes through every level the API spec publishes", () => {
    // ProductStatusValue, spec v0.2.0.
    expect(normaliseLevel("ok")).toBe("ok");
    expect(normaliseLevel("info")).toBe("info");
    expect(normaliseLevel("warning")).toBe("warning");
    expect(normaliseLevel("error")).toBe("error");
    expect(normaliseLevel("unknown")).toBe("unknown");
  });

  test("tolerates casing and whitespace", () => {
    expect(normaliseLevel(" Warning ")).toBe("warning");
    expect(normaliseLevel("ERROR")).toBe("error");
  });

  test("falls back to unknown, not info, for a level it cannot read", () => {
    // Failing towards visible is deliberate — silently swallowing a level we do not know
    // would hide a real incident. `unknown` rather than `info` because `info` now means a
    // deliberate non-degraded notice, and it ranks lower, so it would fail quiet.
    expect(normaliseLevel("degraded")).toBe("unknown");
    expect(normaliseLevel("")).toBe("unknown");
    expect(normaliseLevel(undefined)).toBe("unknown");
    expect(normaliseLevel(null)).toBe("unknown");
    expect(normaliseLevel(3)).toBe("unknown");
  });
});

describe("normaliseMessage", () => {
  test("trims a string message", () => {
    expect(normaliseMessage("  Forecast delayed  ")).toBe("Forecast delayed");
    expect(normaliseMessage("")).toBe("");
  });

  test("returns empty string for anything that is not a string", () => {
    // The point is that none of these throw. `.trim()` on a non-string would take down the
    // whole render, since this runs in a hook body — one malformed field would blank the app
    // rather than drop one banner row. An empty message means the row is not drawn.
    expect(normaliseMessage(null)).toBe("");
    expect(normaliseMessage(undefined)).toBe("");
    expect(normaliseMessage(42)).toBe("");
    expect(normaliseMessage({ text: "nope" })).toBe("");
    expect(normaliseMessage(["nope"])).toBe("");
  });
});
