import {
  getAvailablePLevels,
  getSettlementPeriodForDate,
  getTicks,
  getUtcHalfHourIndex,
  getZoomYMax
} from "./chartUtils";
import { ChartData } from "../charts/remix-line";
import { describe, expect, it, test } from "@jest/globals";
import { DateTime } from "luxon";

describe("getTicks", () => {
  it("should return ticks for a yMax divisible by 3", () => {
    const ticks = getTicks(270, []);
    expect(ticks).toEqual([90, 180, 270]);
  });

  it("should return ticks for a yMax divisible by 4", () => {
    const ticks = getTicks(400, []);
    expect(ticks).toEqual([100, 200, 300, 400]);
  });

  it("should return ticks for a yMax divisible by 5", () => {
    const ticks = getTicks(500, []);
    expect(ticks).toEqual([100, 200, 300, 400, 500]);
  });

  it("should return ticks for a yMax divisible by 6", () => {
    const ticks = getTicks(600, []);
    expect(ticks).toEqual([100, 200, 300, 400, 500, 600]);
  });

  it("should return ticks for a yMax divisible by 7", () => {
    const ticks = getTicks(700, []);
    expect(ticks).toEqual([100, 200, 300, 400, 500, 600, 700]);
  });

  it("should return the correct ticks for a yMax of 13000", () => {
    const ticks = getTicks(13000, []);
    expect(ticks).toEqual([3000, 6000, 9000, 12000]);
  });

  it("should return the correct ticks for a yMax of 14000", () => {
    const ticks = getTicks(14000, []);
    expect(ticks).toEqual([3000, 6000, 9000, 12000]);
  });

  it("should return the correct ticks for a yMax of 15000", () => {
    const ticks = getTicks(15000, []);
    expect(ticks).toEqual([3000, 6000, 9000, 12000, 15000]);
  });

  it("should return the correct ticks for a yMax of 50", () => {
    const ticks = getTicks(50, []);
    expect(ticks).toEqual([10, 20, 30, 40, 50]);
  });

  it("should return the correct ticks for a yMax of 100", () => {
    const ticks = getTicks(100, []);
    expect(ticks).toEqual([20, 40, 60, 80, 100]);
  });

  it("should return the correct ticks for a yMax of 150", () => {
    const ticks = getTicks(150, []);
    expect(ticks).toEqual([30, 60, 90, 120, 150]);
  });

  it("should return the correct ticks for a yMax of 200", () => {
    const ticks = getTicks(200, []);
    expect(ticks).toEqual([40, 80, 120, 160, 200]);
  });

  it("should return the correct ticks for a yMax of 250", () => {
    const ticks = getTicks(250, []);
    expect(ticks).toEqual([50, 100, 150, 200, 250]);
  });

  it("should return the correct ticks for a yMax of 300", () => {
    const ticks = getTicks(300, []);
    expect(ticks).toEqual([50, 100, 150, 200, 250, 300]);
  });

  it("should return the correct ticks for a yMax of 350", () => {
    const ticks = getTicks(350, []);
    expect(ticks).toEqual([50, 100, 150, 200, 250, 300, 350]);
  });

  it("should return the correct ticks for a yMax of 400", () => {
    const ticks = getTicks(400, []);
    expect(ticks).toEqual([100, 200, 300, 400]);
  });

  it("should return the correct ticks for a yMax of 450", () => {
    const ticks = getTicks(450, []);
    expect(ticks).toEqual([150, 300, 450]);
  });

  it("should return the correct ticks for a yMax of 500", () => {
    const ticks = getTicks(500, []);
    expect(ticks).toEqual([100, 200, 300, 400, 500]);
  });

  it("should return the correct ticks for a yMax of 600", () => {
    const ticks = getTicks(600, []);
    expect(ticks).toEqual([100, 200, 300, 400, 500, 600]);
  });

  it("should return the correct ticks for a yMax of 700", () => {
    const ticks = getTicks(700, []);
    expect(ticks).toEqual([100, 200, 300, 400, 500, 600, 700]);
  });

  it("should use fallback for non-round divisors", () => {
    const ticks = getTicks(37, []);
    // For yMax > 10, the fallback is 50
    // But since 50 > 37, there's only one tick
    expect(ticks).toEqual([]);
  });

  it("should use different fallbacks based on yMax size", () => {
    const smallTicks = getTicks(3, []);
    const mediumTicks = getTicks(15, []);
    const largeTicks = getTicks(600, []);

    expect(smallTicks.length).toBeGreaterThan(0);
    expect(mediumTicks.length).toBeGreaterThan(0);
    expect(largeTicks.length).toBeGreaterThan(0);
  });

  it("should handle decimal yMax values", () => {
    const ticks = getTicks(2.5, []);
    expect(ticks).toEqual([0.5, 1, 1.5, 2, 2.5]);
  });

  it("should handle zero and negative yMax", () => {
    expect(getTicks(0, [])).toEqual([]);
    expect(getTicks(-10, [])).toEqual([]);
  });
});

const chartData = (data: Partial<ChartData>[]): ChartData[] =>
  data.map((d, i) => ({ formattedDate: `2024-01-01T00:${i}0`, ...d }));

describe("getZoomYMax", () => {
  it("should use generation/forecast max when there is no probabilistic bound", () => {
    const data = chartData([{ GENERATION: 5 }, { GENERATION_UPDATED: 10 }, { FORECAST: 7 }]);
    expect(getZoomYMax(data)).toBe(10);
  });

  it("should use the highest probabilistic upper bound when present", () => {
    const data = chartData([
      { PROBABILISTIC_UPPER_BOUND: 12, GENERATION: 1 },
      { PROBABILISTIC_UPPER_BOUND: 20, GENERATION: 2 }
    ]);
    expect(getZoomYMax(data)).toBe(20);
  });

  it("should fall back to GENERATION for a NaN probabilistic bound without breaking the max", () => {
    const data = chartData([
      { PROBABILISTIC_UPPER_BOUND: NaN, GENERATION: 2 },
      { PROBABILISTIC_UPPER_BOUND: 50, GENERATION: 3 },
      { PROBABILISTIC_UPPER_BOUND: 30, GENERATION: 4 }
    ]);
    expect(getZoomYMax(data)).toBe(50);
  });

  it("should fall back to the generation/forecast branch when every probabilistic bound is NaN", () => {
    const data = chartData([{ PROBABILISTIC_UPPER_BOUND: NaN, GENERATION: 7, FORECAST: 3 }]);
    expect(getZoomYMax(data)).toBe(7);
  });
});

describe("getAvailablePLevels", () => {
  const pLevels: [number, number][] = [
    [2, 98],
    [10, 90]
  ];

  it("should keep a pair when both bounds are in the payload", () => {
    const plevelValues = { plevel_2: 1, plevel_98: 9, plevel_10: 2, plevel_90: 8 };
    expect(getAvailablePLevels(plevelValues, pLevels)).toEqual(pLevels);
  });

  it("should drop a pair when its upper bound is missing (e.g. p2 present, p98 not)", () => {
    const plevelValues = { plevel_2: 1, plevel_10: 2, plevel_90: 8 };
    expect(getAvailablePLevels(plevelValues, pLevels)).toEqual([[10, 90]]);
  });

  it("should drop a pair when its lower bound is missing", () => {
    const plevelValues = { plevel_98: 9, plevel_10: 2, plevel_90: 8 };
    expect(getAvailablePLevels(plevelValues, pLevels)).toEqual([[10, 90]]);
  });

  it("should return an empty array when no pair has both bounds present", () => {
    expect(getAvailablePLevels({}, pLevels)).toEqual([]);
  });
});

////////////////////////////////////////////////////
// getSettlementPeriodForDate / getUtcHalfHourIndex //
////////////////////////////////////////////////////
//
// Two genuinely different questions that happen to give the same answer in winter:
//
//   getSettlementPeriodForDate — the GB settlement period, 1–48 from midnight Europe/London.
//   getUtcHalfHourIndex        — a 0-based positional index into data bucketed by UTC
//                                time-of-day, which is how `data/national_metrics.json`
//                                (the seasonal norms) is generated.
//
// B9: `getSettlementPeriodForDate` used to count half-hours from midnight of whatever zone the
// caller's DateTime carried, so the answer depended on the caller rather than the definition.
// It now converts to Europe/London itself. `getUtcHalfHourIndex` is the new home for the
// UTC-slot question, so the seasonal-norm lookup does not have to borrow a settlement period
// and silently mean something else. The two disagree by two slots through BST — that gap is
// pinned below deliberately.
//
// Phase 3 note: the settlement-period zone becomes country config rather than a hardcoded
// Europe/London.
describe("getSettlementPeriodForDate", () => {
  const period = (iso: string, zone = "utc") =>
    getSettlementPeriodForDate(DateTime.fromISO(iso, { zone, setZone: true }) as DateTime);

  describe("GMT (no offset, so UTC and London agree)", () => {
    test.each([
      ["2025-01-15T00:00:00", 1],
      ["2025-01-15T00:29:59", 1],
      ["2025-01-15T00:30:00", 2],
      ["2025-01-15T01:00:00", 3],
      ["2025-01-15T12:00:00", 25],
      ["2025-01-15T23:00:00", 47],
      ["2025-01-15T23:30:00", 48],
      ["2025-01-15T23:59:59", 48]
    ])("%s is period %i", (iso, expected) => {
      expect(period(iso, "Europe/London")).toBe(expected);
      expect(period(iso, "utc")).toBe(expected);
    });
  });

  describe("BST — a UTC input must give the same period as the equivalent London input", () => {
    test.each([
      // [UTC instant, equivalent London wall clock, expected period]
      ["2025-07-15T00:00:00Z", "2025-07-15T01:00:00", 3],
      ["2025-07-15T11:00:00Z", "2025-07-15T12:00:00", 25],
      ["2025-07-15T12:00:00Z", "2025-07-15T13:00:00", 27],
      ["2025-07-15T22:30:00Z", "2025-07-15T23:30:00", 48],
      ["2025-07-14T23:00:00Z", "2025-07-15T00:00:00", 1]
    ])("%s == %s == period %i", (utcIso, londonIso, expected) => {
      expect(period(utcIso, "utc")).toBe(expected);
      expect(period(londonIso, "Europe/London")).toBe(expected);
    });

    test("a UTC noon in BST is period 27, not the 25 the old caller-zone maths gave", () => {
      expect(period("2025-07-15T12:00:00Z", "utc")).toBe(27);
    });
  });

  describe("a non-UK viewer's zone must not change the answer", () => {
    test.each(["America/Los_Angeles", "Australia/Sydney", "Asia/Kolkata"])(
      "same instant in %s",
      (zone) => {
        // 2025-07-15T12:00:00Z is 13:00 London == period 27, whatever zone the DateTime carries.
        const dt = DateTime.fromISO("2025-07-15T12:00:00Z").setZone(zone);
        expect(getSettlementPeriodForDate(dt as DateTime)).toBe(27);
      }
    );
  });

  describe("DST boundary days", () => {
    // 2025-03-30 is the short day: 01:00 GMT jumps to 02:00 BST, so 46 periods.
    test.each([
      ["2025-03-30T00:00:00", 1],
      ["2025-03-30T00:30:00", 2],
      ["2025-03-30T02:00:00", 3], // the hour 01:00–02:00 does not exist
      ["2025-03-30T02:30:00", 4],
      ["2025-03-30T23:30:00", 46] // last period of the short day
    ])("clocks forward: London %s is period %i", (iso, expected) => {
      expect(period(iso, "Europe/London")).toBe(expected);
    });

    // 2025-10-26 is the long day: 02:00 BST falls back to 01:00 GMT, so 50 periods and an
    // ambiguous 01:00–02:00. Luxon resolves the ambiguous wall clock to the *earlier* (BST)
    // offset, so pin the instants explicitly to cover both sides.
    test.each([
      ["2025-10-26T00:00:00+01:00", 1],
      ["2025-10-26T00:30:00+01:00", 2],
      ["2025-10-26T01:00:00+01:00", 3], // first (BST) pass through 01:00
      ["2025-10-26T01:30:00+01:00", 4],
      ["2025-10-26T01:00:00+00:00", 5], // second (GMT) pass through 01:00
      ["2025-10-26T01:30:00+00:00", 6],
      ["2025-10-26T02:00:00+00:00", 7],
      ["2025-10-26T23:30:00+00:00", 50] // last period of the long day
    ])("clocks back: %s is period %i", (iso, expected) => {
      expect(period(iso, "Europe/London")).toBe(expected);
      // and the same instant expressed in UTC agrees
      expect(period(iso, "utc")).toBe(expected);
    });

    test("the ambiguous London wall clock 01:30 resolves to the earlier (BST) offset", () => {
      expect(period("2025-10-26T01:30:00", "Europe/London")).toBe(4);
    });
  });

  describe("2026 DST boundaries", () => {
    test.each([
      ["2026-03-29T00:30:00+00:00", 2],
      ["2026-03-29T02:00:00+01:00", 3], // straight after the spring-forward gap
      ["2026-03-29T23:30:00+01:00", 46],
      ["2026-10-25T01:30:00+01:00", 4], // first pass
      ["2026-10-25T01:30:00+00:00", 6], // second pass
      ["2026-10-25T23:30:00+00:00", 50]
    ])("%s is period %i", (iso, expected) => {
      expect(period(iso, "utc")).toBe(expected);
    });
  });
});

describe("getUtcHalfHourIndex", () => {
  const index = (iso: string, zone = "utc") =>
    getUtcHalfHourIndex(DateTime.fromISO(iso, { zone, setZone: true }) as DateTime);

  test.each([
    ["2025-01-15T00:00:00Z", 0],
    ["2025-01-15T00:29:59Z", 0],
    ["2025-01-15T00:30:00Z", 1],
    ["2025-01-15T12:00:00Z", 24],
    ["2025-01-15T12:30:00Z", 25], // the June peak slot in national_metrics.json
    ["2025-01-15T23:30:00Z", 47],
    ["2025-01-15T23:59:59Z", 47],
    // BST: still counted from UTC midnight, so the numbers do not move
    ["2025-07-15T00:00:00Z", 0],
    ["2025-07-15T12:30:00Z", 25],
    ["2025-07-15T23:30:00Z", 47]
  ])("%s is index %i", (iso, expected) => {
    expect(index(iso)).toBe(expected);
  });

  test("is 0..47 on both clock-change days — a UTC day is always 48 slots", () => {
    for (const day of ["2025-03-30", "2025-10-26", "2026-03-29", "2026-10-25"]) {
      expect(index(`${day}T00:00:00Z`)).toBe(0);
      expect(index(`${day}T23:30:00Z`)).toBe(47);
    }
  });

  test.each(["America/Los_Angeles", "Australia/Sydney", "Europe/London"])(
    "ignores the zone the caller's DateTime carries (%s)",
    (zone) => {
      const dt = DateTime.fromISO("2025-07-15T12:30:00Z").setZone(zone);
      expect(getUtcHalfHourIndex(dt as DateTime)).toBe(25);
    }
  );
});

describe("the two helpers must not be used interchangeably", () => {
  // The seasonal-norm lookup indexes a UTC-bucketed array; a settlement period is a London
  // clock concept. Compared like-for-like (period is 1-based, index 0-based) they agree in
  // GMT and are two slots apart in BST. That gap is the reason the two functions exist.
  const at = (iso: string) => {
    const dt = DateTime.fromISO(iso, { zone: "utc", setZone: true }) as DateTime;
    return {
      periodZeroBased: getSettlementPeriodForDate(dt) - 1,
      utcIndex: getUtcHalfHourIndex(dt)
    };
  };

  test.each(["2025-01-15T12:00:00Z", "2025-12-01T00:00:00Z", "2026-02-10T23:30:00Z"])(
    "agree during GMT (%s)",
    (iso) => {
      const { periodZeroBased, utcIndex } = at(iso);
      expect(periodZeroBased - utcIndex).toBe(0);
    }
  );

  test.each(["2025-07-15T12:00:00Z", "2025-05-01T00:00:00Z", "2026-08-20T21:30:00Z"])(
    "differ by exactly two slots during BST (%s)",
    (iso) => {
      const { periodZeroBased, utcIndex } = at(iso);
      expect(periodZeroBased - utcIndex).toBe(2);
    }
  );
});

describe("getSettlementPeriodForDate — timezone parameterisation", () => {
  // Phase 3: the zone is an argument, defaulting to Europe/London so every existing call site is
  // unchanged. `getUtcHalfHourIndex` deliberately stays UTC — see the note on it in chartUtils.ts.
  const utc = (iso: string) => DateTime.fromISO(iso, { zone: "utc" });

  test("the default is Europe/London", () => {
    expect(getSettlementPeriodForDate(utc("2025-07-15T12:00:00Z"))).toBe(
      getSettlementPeriodForDate(utc("2025-07-15T12:00:00Z"), "Europe/London")
    );
    expect(getSettlementPeriodForDate(utc("2025-07-15T12:00:00Z"))).toBe(27); // 13:00 BST
  });

  test.each([
    ["2025-01-15T12:00:00Z", "Europe/Amsterdam", 27], // 13:00 CET
    ["2025-07-15T12:00:00Z", "Europe/Amsterdam", 29], // 14:00 CEST
    ["2025-01-15T12:00:00Z", "Pacific/Auckland", 3], // 01:00 the next day, +13
    ["2025-01-15T12:00:00Z", "UTC", 25]
  ])("%s in %s -> period %i", (iso, zone, expected) => {
    expect(getSettlementPeriodForDate(utc(iso), zone)).toBe(expected);
  });

  test("the passed zone's own clock-change day still runs 46 and 50 periods", () => {
    // Amsterdam changes at 02:00 local, one hour after London, on the same instant.
    const lastOf = (dayStartUtc: string, zone: string, hours: number) =>
      getSettlementPeriodForDate(utc(dayStartUtc).plus({ hours }), zone);
    expect(lastOf("2025-03-29T23:00:00Z", "Europe/Amsterdam", 22.5)).toBe(46);
    expect(lastOf("2025-10-25T22:00:00Z", "Europe/Amsterdam", 24.5)).toBe(50);
  });
});
