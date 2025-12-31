import { getEarliestForecastTimestamp, getHistoryStartMode, getHistoryOffsetHours } from "./data";
import { DateTime } from "luxon";

describe("History Window Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("getHistoryStartMode", () => {
    it("should default to 'rolling' when env var is not set", () => {
      delete process.env.NEXT_PUBLIC_HISTORY_START_MODE;
      expect(getHistoryStartMode()).to.equal("rolling");
    });

    it("should return 'rolling' when explicitly set", () => {
      process.env.NEXT_PUBLIC_HISTORY_START_MODE = "rolling";
      expect(getHistoryStartMode()).to.equal("rolling");
    });

    it("should return 'fixed' when explicitly set", () => {
      process.env.NEXT_PUBLIC_HISTORY_START_MODE = "fixed";
      expect(getHistoryStartMode()).to.equal("fixed");
    });

    it("should default to 'rolling' for invalid values", () => {
      process.env.NEXT_PUBLIC_HISTORY_START_MODE = "invalid";
      expect(getHistoryStartMode()).to.equal("rolling");
    });
  });

  describe("getHistoryOffsetHours", () => {
    it("should default to 48 when env var is not set", () => {
      delete process.env.NEXT_PUBLIC_HISTORY_OFFSET_HOURS;
      expect(getHistoryOffsetHours()).to.equal(48);
    });

    it("should return custom offset when set", () => {
      process.env.NEXT_PUBLIC_HISTORY_OFFSET_HOURS = "72";
      expect(getHistoryOffsetHours()).to.equal(72);
    });

    it("should default to 48 for invalid values", () => {
      process.env.NEXT_PUBLIC_HISTORY_OFFSET_HOURS = "not-a-number";
      expect(getHistoryOffsetHours()).to.equal(48);
    });

    it("should default to 48 for negative values", () => {
      process.env.NEXT_PUBLIC_HISTORY_OFFSET_HOURS = "-10";
      expect(getHistoryOffsetHours()).to.equal(48);
    });
  });

  describe("getEarliestForecastTimestamp", () => {
    it("should return a valid ISO timestamp", () => {
      const result = getEarliestForecastTimestamp();
      expect(result).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should use rolling mode by default", () => {
      delete process.env.NEXT_PUBLIC_HISTORY_START_MODE;
      delete process.env.NEXT_PUBLIC_HISTORY_OFFSET_HOURS;

      const result = getEarliestForecastTimestamp();
      const resultDate = DateTime.fromISO(result);
      const now = DateTime.now();

      // Should be approximately 48 hours ago
      const hoursDiff = now.diff(resultDate, "hours").hours;
      expect(hoursDiff).greaterThan(46);
      expect(hoursDiff).lessThan(50);
    });

    it("should use fixed mode when configured", () => {
      process.env.NEXT_PUBLIC_HISTORY_START_MODE = "fixed";
      process.env.NEXT_PUBLIC_HISTORY_OFFSET_HOURS = "48";

      const result = getEarliestForecastTimestamp();
      const resultDate = DateTime.fromISO(result);

      // Should be at midnight (00:00:00)
      expect(resultDate.hour).to.equal(0);
      expect(resultDate.minute).to.equal(0);
      expect(resultDate.second).to.equal(0);

      // Should be approximately 2 days ago
      const now = DateTime.now();
      const daysDiff = now.diff(resultDate, "days").days;
      expect(daysDiff).greaterThan(1.9);
      expect(daysDiff).lessThan(2.1);
    });

    it("should respect custom offset hours in rolling mode", () => {
      process.env.NEXT_PUBLIC_HISTORY_START_MODE = "rolling";
      process.env.NEXT_PUBLIC_HISTORY_OFFSET_HOURS = "72";

      const result = getEarliestForecastTimestamp();
      const resultDate = DateTime.fromISO(result);
      const now = DateTime.now();

      // Should be approximately 72 hours ago
      const hoursDiff = now.diff(resultDate, "hours").hours;
      expect(hoursDiff).greaterThan(70);
      expect(hoursDiff).lessThan(74);
    });

    it("should round to 6-hour intervals in rolling mode", () => {
      process.env.NEXT_PUBLIC_HISTORY_START_MODE = "rolling";

      const result = getEarliestForecastTimestamp();
      const resultDate = DateTime.fromISO(result);

      // Hour should be divisible by 6 (0, 6, 12, or 18)
      expect(resultDate.hour % 6).to.equal(0);
      expect(resultDate.minute).to.equal(0);
    });
  });
});
