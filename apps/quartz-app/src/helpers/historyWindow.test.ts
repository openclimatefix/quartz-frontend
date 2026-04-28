import {
  getHistoryStart,
  getHistoryStartISO,
  getHistoryStartMode,
  getHistoryOffsetHours,
} from "./historyWindow";
import { DateTime } from "luxon";

describe("History Window Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("getHistoryStartMode", () => {
    it("should default to 'rolling' when env var is not set", () => {
      delete process.env.NEXT_PUBLIC_HISTORY_START_MODE;
      expect(getHistoryStartMode()).toBe("rolling");
    });

    it("should return 'fixed' when explicitly set", () => {
      process.env.NEXT_PUBLIC_HISTORY_START_MODE = "fixed";
      expect(getHistoryStartMode()).toBe("fixed");
    });
  });

  describe("getHistoryOffsetHours", () => {
    it("should default to 48 when env var is not set", () => {
      delete process.env.NEXT_PUBLIC_HISTORY_OFFSET_HOURS;
      expect(getHistoryOffsetHours()).toBe(48);
    });

    it("should return 72 when set", () => {
      process.env.NEXT_PUBLIC_HISTORY_OFFSET_HOURS = "72";
      expect(getHistoryOffsetHours()).toBe(72);
    });
  });

  describe("getHistoryStart", () => {
    it("should return rolling mode by default", () => {
      delete process.env.NEXT_PUBLIC_HISTORY_START_MODE;
      delete process.env.NEXT_PUBLIC_HISTORY_OFFSET_HOURS;

      const result = getHistoryStart();
      const now = DateTime.now().toUTC();

      const hoursDiff = now.diff(result, "hours").hours;
      expect(hoursDiff).toBeGreaterThan(47);
      expect(hoursDiff).toBeLessThan(49);
    });

    it("should use fixed mode when configured", () => {
      process.env.NEXT_PUBLIC_HISTORY_START_MODE = "fixed";
      process.env.NEXT_PUBLIC_HISTORY_OFFSET_HOURS = "48";

      const result = getHistoryStart();

      expect(result.hour).toBe(0);
      expect(result.minute).toBe(0);
      expect(result.second).toBe(0);
    });
  });

  describe("getHistoryStartISO", () => {
    it("should return valid ISO string", () => {
      const result = getHistoryStartISO();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});
