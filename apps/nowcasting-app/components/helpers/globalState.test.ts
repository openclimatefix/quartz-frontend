import { describe, expect, test } from "@jest/globals";
import { roundISOTimeUpTo30Min } from "./globalState";

describe("roundISOTimeUpTo30Min", () => {
  test("leaves times already on a settlement period boundary untouched", () => {
    expect(roundISOTimeUpTo30Min("2024-06-01T10:00:00.000Z")).toBe("2024-06-01T10:00:00.000Z");
    expect(roundISOTimeUpTo30Min("2024-06-01T10:30:00.000Z")).toBe("2024-06-01T10:30:00.000Z");
  });

  test("rounds the NL 15-minute grain up to the GB period containing it", () => {
    expect(roundISOTimeUpTo30Min("2024-06-01T10:15:00.000Z")).toBe("2024-06-01T10:30:00.000Z");
    expect(roundISOTimeUpTo30Min("2024-06-01T10:45:00.000Z")).toBe("2024-06-01T11:00:00.000Z");
  });

  test("rounds up over a day boundary", () => {
    expect(roundISOTimeUpTo30Min("2024-06-01T23:45:00.000Z")).toBe("2024-06-02T00:00:00.000Z");
  });

  test("normalizes non-UTC input to UTC", () => {
    expect(roundISOTimeUpTo30Min("2024-06-01T11:15:00.000+01:00")).toBe("2024-06-01T10:30:00.000Z");
  });

  test("returns the input unchanged when it is not a valid date", () => {
    expect(roundISOTimeUpTo30Min("not-a-date")).toBe("not-a-date");
  });
});
