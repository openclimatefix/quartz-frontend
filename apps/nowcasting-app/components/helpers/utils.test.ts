import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { Settings } from "luxon";
import {
  convertISODateStringToLondonTime,
  getOpacityValueFromPVNormalized,
  prettyPrintChartAxisLabelDate
} from "./utils";
import * as utils from "./utils";
import { MAX_NATIONAL_GENERATION_MW } from "../../constant";
import { ChartData } from "../charts/remix-line";

describe("check getOpacityValueFromPVNormalized with valid values", () => {
  test("check rounding to [0, 0.1, 0.2, 0.35, 0.5, 0.7, 1.0] and then selecting the correct opacity from [0.03, 0.2, 0.4, 0.6, 0.8, 1, 1]", () => {
    expect(getOpacityValueFromPVNormalized(0.9)).toBe(1);
    expect(getOpacityValueFromPVNormalized(0.55)).toBe(0.8);
    expect(getOpacityValueFromPVNormalized(0.44)).toBe(0.6);
    expect(getOpacityValueFromPVNormalized(0.45)).toBe(0.6);
    expect(getOpacityValueFromPVNormalized(0.46)).toBe(0.6);
    expect(getOpacityValueFromPVNormalized(0.333333)).toBe(0.4);
    expect(getOpacityValueFromPVNormalized(4.5)).toBe(1.0);
    expect(getOpacityValueFromPVNormalized(0.09)).toBe(0.03);
    expect(getOpacityValueFromPVNormalized(0.11)).toBe(0.2);
    expect(getOpacityValueFromPVNormalized(-0.35)).toBe(0.03);
    expect(getOpacityValueFromPVNormalized(-0.3)).toBe(0.03);
  });
});

describe("check convertISODateStringToLondonTime", () => {
  test("check convertISODateStringToLondonTime with valid date strings", () => {
    expect(convertISODateStringToLondonTime("2021-01-01T03:00:00.000Z")).toBe("03:00");
    expect(convertISODateStringToLondonTime("2021-01-01T03:21:00.000Z")).toBe("03:21");
    expect(convertISODateStringToLondonTime("2021-01-01T03:50:11Z")).toBe("03:50");
  });

  it("should handle an empty date string", () => {
    const londonTime = convertISODateStringToLondonTime("");
    expect(londonTime).toBe("00:00");
  });

  it('should handle the edge case date string ":00.000Z"', () => {
    const londonTime = convertISODateStringToLondonTime(":00.000Z");
    expect(londonTime).toBe("00:00");
  });

  it("should throw an error for an invalid date string", () => {
    const invalidDateFunc = () => {
      convertISODateStringToLondonTime("invalid-date");
    };
    // expect(invalidDateFunc).toBe("03:00");
    expect(invalidDateFunc).toThrow(new Error("Invalid date: invalid-date"));
  });
});

describe("prettyPrintChartAxisLabelDate", () => {
  it("should handle a valid UNIX timestamp", () => {
    const convertISODateStringToLondonTimeSpy = jest.spyOn(
      utils,
      "convertISODateStringToLondonTime"
    );
    convertISODateStringToLondonTimeSpy.mockImplementation((date) => date);
    const result = prettyPrintChartAxisLabelDate(1634045699000); // October 12, 2021 14:34
    expect(result).toBe("2021-10-12T13:34:59.000Z");
    convertISODateStringToLondonTimeSpy.mockRestore();
  });

  it("should handle an empty value", () => {
    const result = prettyPrintChartAxisLabelDate("");
    expect(result).toBe("Invalid datetime input: string – ");
  });

  it("should handle an invalid UNIX timestamp", () => {
    const result = prettyPrintChartAxisLabelDate("invalid-timestamp");
    expect(result).toBe("Invalid datetime input: string – invalid-timestamp");
  });

  it("should pretty print a valid UNIX timestamp", () => {
    const result = prettyPrintChartAxisLabelDate(1634045699000); // October 12, 2021 14:34
    expect(result).toBe("14:34");
  });

  it("should pretty print an ISO date string with timezone", () => {
    // Correct for London time
    const result = prettyPrintChartAxisLabelDate("2023-10-12");
    expect(result).toBe("Invalid datetime input: string – 2023-10-12");
  });

  it("should pretty print an ISO datetime string with timezone, no seconds", () => {
    // Correct for London time
    const result = prettyPrintChartAxisLabelDate("2023-10-12T12:34+00:00");
    expect(result).toBe("13:34");
  });

  it("should pretty print an ISO datetime string with timezone, with seconds", () => {
    // Correct for London time
    const result = prettyPrintChartAxisLabelDate("2023-10-12T12:34:56+00:00");
    expect(result).toBe("13:34");
  });

  it("should pretty print an ISO datetime string with timezone, with milliseconds", () => {
    // Correct for London time
    const result = prettyPrintChartAxisLabelDate("2023-10-12T12:34:56.789+00:00");
    expect(result).toBe("13:34");
  });

  it("should pretty print an ISO datetime string without timezone, no seconds", () => {
    // Correct for London time
    const result = prettyPrintChartAxisLabelDate("2023-10-12T12:34");
    expect(result).toBe("13:34");
  });

  it("should pretty print an ISO datetime string without timezone, with seconds", () => {
    // Correct for London time
    const result = prettyPrintChartAxisLabelDate("2023-10-12T12:34:56");
    expect(result).toBe("13:34");
  });

  it("should pretty print an ISO datetime string without timezone, with milliseconds", () => {
    // Correct for London time
    const result = prettyPrintChartAxisLabelDate("2023-10-12T12:34:56.789");
    expect(result).toBe("13:34");
  });
});

describe("prettyPrintDayLabelWithDate", () => {
  it("should handle an empty value", () => {
    const result = utils.prettyPrintDayLabelWithDate("");
    expect(result).toBe("Invalid date");
  });

  it("should handle an invalid UNIX timestamp", () => {
    const result = utils.prettyPrintDayLabelWithDate("invalid-timestamp");
    expect(result).toBe("Invalid date");
  });

  it("should pretty print a valid UNIX timestamp", () => {
    const result = utils.prettyPrintDayLabelWithDate(1697117640000); // October 12, 2023 14:34
    expect(result).toBe("Thu 12");
  });

  it("should pretty print an ISO date string with timezone", () => {
    // Correct for London time
    const result = utils.prettyPrintDayLabelWithDate("2023-10-12");
    expect(result).toBe("Thu 12");
  });

  it("should pretty print an ISO datetime string with timezone, no seconds", () => {
    // Correct for London time
    const result = utils.prettyPrintDayLabelWithDate("2023-10-12T12:34+00:00");
    expect(result).toBe("Thu 12");
  });

  it("should pretty print an ISO datetime string with timezone, with seconds", () => {
    // Correct for London time
    const result = utils.prettyPrintDayLabelWithDate("2023-10-12T12:34:56+00:00");
    expect(result).toBe("Thu 12");
  });

  it("should pretty print an ISO datetime string with timezone, with milliseconds", () => {
    // Correct for London time
    const result = utils.prettyPrintDayLabelWithDate("2023-10-12T12:34:56.789+00:00");
    expect(result).toBe("Thu 12");
  });

  it("should pretty print an ISO datetime string without timezone, no seconds", () => {
    // Correct for London time
    const result = utils.prettyPrintDayLabelWithDate("2023-10-12T12:34");
    expect(result).toBe("Thu 12");
  });

  it("should pretty print an ISO datetime string without timezone, with seconds", () => {
    // Correct for London time
    const result = utils.prettyPrintDayLabelWithDate("2023-10-12T12:34:56");
    expect(result).toBe("Thu 12");
  });

  it("should pretty print an ISO datetime string without timezone, with milliseconds", () => {
    // Correct for London time
    const result = utils.prettyPrintDayLabelWithDate("2023-10-12T12:34:56.789");
    expect(result).toBe("Thu 12");
  });

  it("should print 'Today' for today's date", () => {
    const result = utils.prettyPrintDayLabelWithDate(new Date().toISOString());
    expect(result).toBe("Today");
  });
});

describe("check y-axis max value calculation", () => {
  test("should return MAX_NATIONAL_GENERATION_MW when chart data is empty array", () => {
    const result = utils.calculateChartYMax([]);
    expect(result).toBe(MAX_NATIONAL_GENERATION_MW);
  });

  test("should round up to nearest 500 with buffer of 100, and return MAX_NATIONAL if lower", () => {
    const chartData: ChartData[] = [{ GENERATION: 10500, formattedDate: "2022-05-16T15:00" }];
    const result = utils.calculateChartYMax(chartData);
    expect(result).toBe(MAX_NATIONAL_GENERATION_MW); // 10500 + 100 = 10600 rounded to nearest 500 is 11000, which is less than MAX_NATIONAL_GENERATION_MW
  });

  test("should round up to next nearest 500 with buffer of 100", () => {
    const chartData: ChartData[] = [{ GENERATION: 14450, formattedDate: "2022-05-16T15:00" }];
    const result = utils.calculateChartYMax(chartData);
    expect(result).toBe(15000); // 12500 + 1000 = 13500 rounded to nearest 1000 is 14000, which is more than MAX_NATIONAL_GENERATION_MW
  });

  test("should round up to nearest 500 with buffer of 100", () => {
    const chartData: ChartData[] = [{ GENERATION: 14350, formattedDate: "2022-05-16T15:00" }];
    const result = utils.calculateChartYMax(chartData);
    expect(result).toBe(14500); // 14350 + 100 = 14450 rounded to nearest 500 is 14500, which is more than MAX_NATIONAL_GENERATION_MW
  });

  test("should handle multiple numeric values", () => {
    const chartData: ChartData[] = [
      { GENERATION: 5000, FORECAST: 8000, formattedDate: "2022-05-16T15:00" },
      { GENERATION: 3000, FORECAST: 7000, formattedDate: "2022-05-16T16:00" }
    ];
    const result = utils.calculateChartYMax(chartData, 0); // the MAX_NATIONAL_GENERATION_MW is not considered for this test
    expect(result).toBe(8500); // (8000 + 100) rounded up to nearest 500 is 8500
  });

  test("should ignore formattedDate fields", () => {
    const chartData: ChartData[] = [{ GENERATION: 15500, formattedDate: "2023-10-12" }];
    const result = utils.calculateChartYMax(chartData, 0); // the MAX_NATIONAL_GENERATION_MW is not considered for this test
    expect(result).toBe(16000); // (15500 + 100) rounded up to nearest 500 is 16000
  });

  test("should handle edge case where value is just under rounding threshold", () => {
    const chartData: ChartData[] = [{ GENERATION: 14990, formattedDate: "2022-05-16T15:00" }];
    const result = utils.calculateChartYMax(chartData);
    expect(result).toBe(15500); // (14990 + 100) rounded up to next 500
  });

  test("should handle edge case where values exactly match rounding threshold", () => {
    const chartData: ChartData[] = [{ GENERATION: 15000, formattedDate: "2022-05-16T15:00" }];
    const result = utils.calculateChartYMax(chartData);
    expect(result).toBe(15500); // (15000 + 100) rounded up to next 500
  });

  test("should consider yMax if the value of yMax is greater than the Max National Generation", () => {
    const chartData: ChartData[] = [{ GENERATION: 15000, formattedDate: "2022-05-16T15:00" }];
    const result = Math.max(utils.calculateChartYMax(chartData), MAX_NATIONAL_GENERATION_MW);
    expect(result).toBe(utils.calculateChartYMax(chartData));
  });

  test("should consider Max National Generation if the value of yMax is less than the Max National Generation", () => {
    const chartData: ChartData[] = [{ GENERATION: 10000, formattedDate: "2022-05-16T15:00" }];
    const result = Math.max(utils.calculateChartYMax(chartData), MAX_NATIONAL_GENERATION_MW);
    expect(result).toBe(MAX_NATIONAL_GENERATION_MW);
  });
});

/////////////////////////////////////////////////////////////////////////////////
// Date / time helpers — characterisation tests ahead of the multi-country work //
/////////////////////////////////////////////////////////////////////////////////
//
// These pin CURRENT behaviour, warts included, so the Phase 3 change from "hardcoded
// Europe/London" to "timezone from the country registry" has something to diff against.
// Where the current behaviour is wrong rather than merely arbitrary, the test says so in a
// comment rather than asserting an aspiration.
//
// Two things about the environment, because they shape what can be asserted here:
//
//  * Every one of these helpers uses the native `Date`, not Luxon. Luxon's
//    `Settings.defaultZone` therefore does nothing to them — there is a test below pinning
//    exactly that, because it is a trap for anyone writing the Phase 3 tests.
//  * The helpers that read the *viewer's* zone read it from the process zone, which
//    `jest.globalSetup.ts` pins to UTC before the workers fork. Assigning `process.env.TZ`
//    inside a test does not move it (verified: `Intl.DateTimeFormat().resolvedOptions()`
//    stays UTC), so a genuine non-UK-viewer run needs a second jest project with its own TZ.
//    Until then, the viewer-zone-dependent helpers are called out by name below and their
//    UTC-viewer output is what is pinned.
//
// Fixture instants, all expressed in UTC:
//   GMT             2025-01-15T12:00Z == 12:00 London
//   BST             2025-07-15T12:00Z == 13:00 London
//   BST midnight    2025-07-14T23:00Z == 00:00 London on the 15th
//   BST 23:30       2025-07-15T22:30Z == 23:30 London
//   spring 2025     2025-03-30T00:59Z == 00:59 GMT, 2025-03-30T01:00Z == 02:00 BST (01:00 gone)
//   autumn 2025     2025-10-26T00:30Z == 01:30 BST, 2025-10-26T01:30Z == 01:30 GMT (repeated)
//   spring 2026     2026-03-29T00:59Z / 2026-03-29T01:00Z
//   autumn 2026     2026-10-25T00:30Z / 2026-10-25T01:30Z

const GMT_NOON = "2025-01-15T12:00:00.000Z";
const BST_NOON = "2025-07-15T12:00:00.000Z";
const GMT_MIDNIGHT = "2025-01-15T00:00:00.000Z";
const GMT_2330 = "2025-01-15T23:30:00.000Z";
const BST_MIDNIGHT = "2025-07-14T23:00:00.000Z";
const BST_2330 = "2025-07-15T22:30:00.000Z";
const SPRING_25_BEFORE = "2025-03-30T00:59:00.000Z";
const SPRING_25_AFTER = "2025-03-30T01:00:00.000Z";
const AUTUMN_25_FIRST_0130 = "2025-10-26T00:30:00.000Z";
const AUTUMN_25_SECOND_0130 = "2025-10-26T01:30:00.000Z";
const SPRING_26_BEFORE = "2026-03-29T00:59:00.000Z";
const SPRING_26_AFTER = "2026-03-29T01:00:00.000Z";
const AUTUMN_26_FIRST_0130 = "2026-10-25T00:30:00.000Z";
const AUTUMN_26_SECOND_0130 = "2026-10-25T01:30:00.000Z";

describe("getTimeFromDate", () => {
  // Viewer-zone dependent: reads `Date.toTimeString`, i.e. the process zone (UTC here).
  test.each([
    [GMT_NOON, "12:00"],
    [BST_NOON, "12:00"], // NB: 12:00 UTC, not the 13:00 a London viewer's clock shows
    [GMT_MIDNIGHT, "00:00"],
    [GMT_2330, "23:30"],
    [BST_MIDNIGHT, "23:00"],
    [BST_2330, "22:30"],
    [SPRING_25_BEFORE, "00:59"],
    [SPRING_25_AFTER, "01:00"],
    [AUTUMN_25_FIRST_0130, "00:30"],
    [AUTUMN_25_SECOND_0130, "01:30"]
  ])("%s -> %s", (iso, expected) => {
    expect(utils.getTimeFromDate(new Date(iso))).toBe(expected);
  });
});

describe("formatISODateString", () => {
  // Pure string slicing to 16 chars — no parsing, no timezone, no validation.
  test.each([
    [GMT_NOON, "2025-01-15T12:00"],
    [BST_NOON, "2025-07-15T12:00"],
    [GMT_MIDNIGHT, "2025-01-15T00:00"],
    [GMT_2330, "2025-01-15T23:30"],
    ["2025-07-15T12:00:00+01:00", "2025-07-15T12:00"], // offset silently discarded
    ["", ""],
    ["invalid-date", "invalid-date"],
    ["2025-13-45T99:99:99Z", "2025-13-45T99:99"] // nonsense in, nonsense out
  ])("%s -> %s", (input, expected) => {
    expect(utils.formatISODateString(input)).toBe(expected);
  });

  test("is undefined-safe via optional chaining", () => {
    expect(utils.formatISODateString(undefined as unknown as string)).toBeUndefined();
  });
});

describe("formatISODateAsLondonTime", () => {
  test.each([
    [GMT_NOON, "12:00"],
    [BST_NOON, "13:00"],
    [GMT_MIDNIGHT, "00:00"],
    [GMT_2330, "23:30"],
    [BST_MIDNIGHT, "00:00"],
    [BST_2330, "23:30"],
    [SPRING_25_BEFORE, "00:59"],
    [SPRING_25_AFTER, "02:00"], // the 01:00 hour does not exist on this day
    [AUTUMN_25_FIRST_0130, "01:30"], // ambiguous hour, first (BST) pass
    [AUTUMN_25_SECOND_0130, "01:30"], // ...and second (GMT) pass, indistinguishable in output
    [SPRING_26_BEFORE, "00:59"],
    [SPRING_26_AFTER, "02:00"],
    [AUTUMN_26_FIRST_0130, "01:30"],
    [AUTUMN_26_SECOND_0130, "01:30"]
  ])("%s -> %s", (iso, expected) => {
    expect(utils.formatISODateAsLondonTime(new Date(iso))).toBe(expected);
  });
});

describe("convertISODateStringToLondonTime", () => {
  // The existing suite above covers the happy path and the empty/invalid cases; these are the
  // DST and boundary cases it was missing.
  test.each([
    [GMT_NOON, "12:00"],
    [BST_NOON, "13:00"],
    [GMT_MIDNIGHT, "00:00"],
    [GMT_2330, "23:30"],
    [BST_MIDNIGHT, "00:00"],
    [BST_2330, "23:30"],
    [SPRING_25_BEFORE, "00:59"],
    [SPRING_25_AFTER, "02:00"],
    [AUTUMN_25_FIRST_0130, "01:30"],
    [AUTUMN_25_SECOND_0130, "01:30"],
    [SPRING_26_AFTER, "02:00"],
    [AUTUMN_26_SECOND_0130, "01:30"]
  ])("%s -> %s", (iso, expected) => {
    expect(utils.convertISODateStringToLondonTime(iso)).toBe(expected);
  });

  test("throws on a date-shaped string that Date cannot parse", () => {
    expect(() => utils.convertISODateStringToLondonTime("2025-13-45T99:99:99Z")).toThrow(
      "Invalid date: 2025-13-45T99:99:99Z"
    );
  });
});

describe("convertToLocaleDateString", () => {
  // Viewer-zone dependent, and deliberately lying: it shifts the instant by the viewer's offset
  // and then serialises with `toISOString`, so the "Z" on the result is false everywhere except
  // UTC. Under the UTC-pinned test process the offset is 0, so it is an identity function and
  // the lie is invisible — which is exactly why it needs replacing rather than porting.
  test.each([
    [GMT_NOON, "2025-01-15T12:00:00.000Z"],
    [BST_NOON, "2025-07-15T12:00:00.000Z"],
    [GMT_MIDNIGHT, "2025-01-15T00:00:00.000Z"],
    [GMT_2330, "2025-01-15T23:30:00.000Z"],
    [BST_MIDNIGHT, "2025-07-14T23:00:00.000Z"],
    [AUTUMN_25_SECOND_0130, "2025-10-26T01:30:00.000Z"]
  ])("%s -> %s (UTC viewer: identity)", (iso, expected) => {
    expect(utils.convertToLocaleDateString(iso)).toBe(expected);
  });

  test.each(["", "invalid-date", ":00.000Z", "2025-13-45T99:99:99Z"])(
    "throws on invalid input %p",
    (input) => {
      expect(() => utils.convertToLocaleDateString(input)).toThrow(`Invalid date: ${input}`);
    }
  );
});

describe("formatISODateStringHuman", () => {
  test.each([
    [GMT_NOON, "Wednesday, 15 January 2025, 12:00"],
    [BST_NOON, "Tuesday, 15 July 2025, 13:00"],
    [GMT_MIDNIGHT, "Wednesday, 15 January 2025, 00:00"],
    [GMT_2330, "Wednesday, 15 January 2025, 23:30"],
    // London has already ticked over to the 15th while UTC is still on the 14th
    [BST_MIDNIGHT, "Tuesday, 15 July 2025, 00:00"],
    [BST_2330, "Tuesday, 15 July 2025, 23:30"],
    [SPRING_25_BEFORE, "Sunday, 30 March 2025, 00:59"],
    [SPRING_25_AFTER, "Sunday, 30 March 2025, 02:00"],
    [AUTUMN_25_FIRST_0130, "Sunday, 26 October 2025, 01:30"],
    [AUTUMN_25_SECOND_0130, "Sunday, 26 October 2025, 01:30"],
    [SPRING_26_AFTER, "Sunday, 29 March 2026, 02:00"],
    [AUTUMN_26_SECOND_0130, "Sunday, 25 October 2026, 01:30"]
  ])("%s -> %s", (iso, expected) => {
    expect(utils.formatISODateStringHuman(iso)).toBe(expected);
  });

  test.each(["", "invalid-date", ":00.000Z", "2025-13-45T99:99:99Z"])(
    "renders garbage rather than throwing for invalid input %p",
    (input) => {
      // "Invalid Date, Inval" — the time half is `"Invalid Date".slice(0, 5)`. Not a crash, but
      // not something anyone would want on screen either.
      expect(utils.formatISODateStringHuman(input)).toBe("Invalid Date, Inval");
    }
  );
});

describe("dateToLondonDateTimeString", () => {
  test.each([
    [GMT_NOON, "Wednesday, 15 January 2025, 12:00"],
    [BST_NOON, "Tuesday, 15 July 2025, 13:00"],
    [GMT_MIDNIGHT, "Wednesday, 15 January 2025, 00:00"],
    [BST_MIDNIGHT, "Tuesday, 15 July 2025, 00:00"],
    [BST_2330, "Tuesday, 15 July 2025, 23:30"],
    [SPRING_25_AFTER, "Sunday, 30 March 2025, 02:00"],
    [AUTUMN_25_SECOND_0130, "Sunday, 26 October 2025, 01:30"]
  ])("%s -> %s", (iso, expected) => {
    expect(utils.dateToLondonDateTimeString(new Date(iso))).toBe(expected);
  });
});

describe("dateToLondonDateTimeOnlyString", () => {
  // Note the trailing space, which callers concatenate onto.
  test.each([
    [GMT_NOON, "15/01/2025 "],
    [BST_NOON, "15/07/2025 "],
    [GMT_MIDNIGHT, "15/01/2025 "],
    [GMT_2330, "15/01/2025 "],
    [BST_MIDNIGHT, "15/07/2025 "], // 23:00 UTC on the 14th is already the 15th in London
    [BST_2330, "15/07/2025 "],
    [SPRING_25_AFTER, "30/03/2025 "],
    [AUTUMN_25_SECOND_0130, "26/10/2025 "]
  ])("%s -> %s", (iso, expected) => {
    expect(utils.dateToLondonDateTimeOnlyString(new Date(iso))).toBe(expected);
  });
});

describe("formatISODateStringHumanNumbersOnly", () => {
  test.each([
    [GMT_NOON, "15/01/2025 12:00"],
    [BST_NOON, "15/07/2025 13:00"],
    [GMT_MIDNIGHT, "15/01/2025 00:00"],
    [GMT_2330, "15/01/2025 23:30"],
    [BST_MIDNIGHT, "15/07/2025 00:00"],
    [BST_2330, "15/07/2025 23:30"],
    [SPRING_25_BEFORE, "30/03/2025 00:59"],
    [SPRING_25_AFTER, "30/03/2025 02:00"],
    [AUTUMN_25_FIRST_0130, "26/10/2025 01:30"],
    [AUTUMN_25_SECOND_0130, "26/10/2025 01:30"],
    [SPRING_26_AFTER, "29/03/2026 02:00"],
    [AUTUMN_26_FIRST_0130, "25/10/2026 01:30"]
  ])("%s -> %s", (iso, expected) => {
    expect(utils.formatISODateStringHumanNumbersOnly(iso)).toBe(expected);
  });

  test.each(["", "invalid-date", ":00.000Z", "2025-13-45T99:99:99Z"])(
    "renders garbage rather than throwing for invalid input %p",
    (input) => {
      expect(utils.formatISODateStringHumanNumbersOnly(input)).toBe("Invalid Date Inval");
    }
  );
});

describe("prettyPrintDayLabelWithDate — DST and boundary cases", () => {
  // Viewer-zone dependent: unlike its neighbours this one formats in the *process* zone, with no
  // `timeZone: "Europe/London"`. Under the UTC-pinned test process that shows up on the BST
  // midnight fixture, where London is already on the 15th but the label says "Mon 14".
  test.each([
    [GMT_NOON, "Wed 15"],
    [BST_NOON, "Tue 15"],
    [GMT_MIDNIGHT, "Wed 15"],
    [GMT_2330, "Wed 15"],
    [BST_MIDNIGHT, "Mon 14"], // London: Tuesday the 15th. This is the bug, pinned.
    [BST_2330, "Tue 15"],
    [SPRING_25_BEFORE, "Sun 30"],
    [SPRING_25_AFTER, "Sun 30"],
    [AUTUMN_25_FIRST_0130, "Sun 26"],
    [AUTUMN_25_SECOND_0130, "Sun 26"],
    [SPRING_26_AFTER, "Sun 29"],
    [AUTUMN_26_SECOND_0130, "Sun 25"]
  ])("%s -> %s", (iso, expected) => {
    expect(utils.prettyPrintDayLabelWithDate(iso)).toBe(expected);
  });

  test("treats the epoch as invalid, not as 1 January 1970", () => {
    expect(utils.prettyPrintDayLabelWithDate(0)).toBe("Invalid date");
  });
});

describe("prettyPrintChartAxisLabelDate — DST and boundary cases", () => {
  // The chart feeds this the 16-character `formatISODateString` output, which is the branch the
  // existing tests above exercise.
  test.each([
    ["2025-01-15T12:00", "12:00"],
    ["2025-07-15T12:00", "13:00"],
    ["2025-01-15T00:00", "00:00"],
    ["2025-01-15T23:30", "23:30"],
    ["2025-07-14T23:00", "00:00"], // London midnight
    ["2025-07-15T22:30", "23:30"],
    ["2025-03-30T00:59", "00:59"],
    ["2025-03-30T01:00", "02:00"], // spring forward
    ["2025-10-26T00:30", "01:30"], // ambiguous hour, first pass
    ["2025-10-26T01:30", "01:30"], // ...and second
    ["2026-03-29T01:00", "02:00"],
    ["2026-10-25T01:30", "01:30"]
  ])("%s -> %s", (input, expected) => {
    expect(utils.prettyPrintChartAxisLabelDate(input)).toBe(expected);
  });

  test.each([
    ["2025-01-15T12:00:00.000Z", "Invalid date: 2025-01-15T12:00:00.000Z+00:00"],
    ["2025-07-15T12:00:00.000Z", "Invalid date: 2025-07-15T12:00:00.000Z+00:00"],
    ["2025-07-15T12:00:00Z", "Invalid date: 2025-07-15T12:00:00Z+00:00"]
  ])(
    "THROWS on a Z-suffixed ISO string (%s) — the >16-char branch appends '+00:00' to a string that already carries a zone",
    (input, message) => {
      // Pinned, not endorsed. Nothing in the app currently reaches this branch (ticks arrive as
      // the 16-char form), but it is an uncaught throw inside a chart tick formatter and one
      // caller passing a raw API timestamp would blank the chart. Flagged for a decision rather
      // than fixed here — the fix belongs with whoever owns the axis.
      expect(() => utils.prettyPrintChartAxisLabelDate(input)).toThrow(message);
    }
  );

  test("returns a sentinel rather than throwing for a parseable-shaped but invalid string", () => {
    expect(utils.prettyPrintChartAxisLabelDate("2025-13-45T99:99:99Z")).toBe("Invalid date 3");
  });

  test("treats the epoch and NaN as invalid", () => {
    expect(utils.prettyPrintChartAxisLabelDate(0)).toBe("Invalid date 1");
    expect(utils.prettyPrintChartAxisLabelDate(NaN)).toBe("Invalid datetime input: number – NaN");
  });
});

describe("addMinutesToISODate", () => {
  // Instant arithmetic on a UTC-serialised Date, so DST never enters into it — 30 minutes is
  // always 30 minutes, including across both clock changes.
  test.each([
    [GMT_NOON, 30, "2025-01-15T12:30:00.000Z"],
    [GMT_2330, 30, "2025-01-16T00:00:00.000Z"], // rolls the date
    [GMT_MIDNIGHT, -90, "2025-01-14T22:30:00.000Z"], // rolls back over midnight
    [BST_NOON, 30, "2025-07-15T12:30:00.000Z"],
    [SPRING_25_BEFORE, 30, "2025-03-30T01:29:00.000Z"], // spans the spring-forward gap
    [AUTUMN_25_FIRST_0130, 30, "2025-10-26T01:00:00.000Z"], // spans the repeated hour
    [AUTUMN_25_SECOND_0130, 30, "2025-10-26T02:00:00.000Z"],
    [SPRING_26_BEFORE, 30, "2026-03-29T01:29:00.000Z"],
    [AUTUMN_26_FIRST_0130, 30, "2026-10-25T01:00:00.000Z"],
    [GMT_NOON, 0, "2025-01-15T12:00:00.000Z"]
  ])("%s + %i minutes -> %s", (iso, minutes, expected) => {
    expect(utils.addMinutesToISODate(iso, minutes)).toBe(expected);
  });

  test.each(["", "invalid-date", ":00.000Z", "2025-13-45T99:99:99Z"])(
    "throws RangeError on invalid input %p (toISOString on an Invalid Date)",
    (input) => {
      expect(() => utils.addMinutesToISODate(input, 30)).toThrow("Invalid time value");
    }
  );
});

describe("getRounded4HoursAgoString", () => {
  // Rounds the half-hour in the *viewer's* zone, then renders the result as London time. Under
  // the UTC-pinned test process those coincide in winter and are an hour apart in summer.
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test.each([
    // [frozen now (UTC), expected London HH:MM]
    ["2025-01-15T12:20:00.000Z", "08:00"], // GMT: 08:20 rounds down to 08:00
    ["2025-01-15T12:45:00.000Z", "08:30"], // minutes >= 30 rounds down to :30
    ["2025-01-15T12:30:00.000Z", "08:30"], // exactly :30
    ["2025-01-15T12:29:59.000Z", "08:00"],
    ["2025-01-15T02:10:00.000Z", "22:00"], // crosses back over midnight
    ["2025-01-15T00:00:00.000Z", "20:00"],
    ["2025-07-15T12:20:00.000Z", "09:00"], // BST: 08:20 UTC rendered as 09:00 London
    ["2025-07-15T12:45:00.000Z", "09:30"],
    ["2025-07-15T02:10:00.000Z", "23:00"],
    // 4 hours before 02:00 BST on the spring-forward day is 21:00 UTC the evening before
    ["2025-03-30T01:00:00.000Z", "21:00"],
    // ...and on the clocks-back day, 4h before 01:30 GMT is 21:30 UTC == 22:30 BST
    ["2025-10-26T01:30:00.000Z", "22:30"]
  ])("now = %s -> %s", (now, expected) => {
    jest.setSystemTime(new Date(now).getTime());
    expect(utils.getRounded4HoursAgoString()).toBe(expected);
  });
});

describe("Luxon's default zone does not reach these helpers", () => {
  // Every helper above uses the native `Date`, so `Settings.defaultZone` — the obvious lever,
  // and the one the Luxon-based helpers in data.ts respond to — has no effect at all here.
  // Pinned because Phase 3 will want one consistent way to set the zone, and this documents
  // that "set Settings.defaultZone" is not it until these are migrated to Luxon (F5).
  afterEach(() => {
    Settings.defaultZone = "system";
  });

  test.each(["America/Los_Angeles", "Australia/Sydney"])(
    "output is unchanged with Settings.defaultZone = %s",
    (zone) => {
      const before = utils.getTimeFromDate(new Date(BST_NOON));
      Settings.defaultZone = zone;
      expect(utils.getTimeFromDate(new Date(BST_NOON))).toBe(before);
      expect(utils.prettyPrintDayLabelWithDate(BST_MIDNIGHT)).toBe("Mon 14");
      expect(utils.convertToLocaleDateString(BST_NOON)).toBe(BST_NOON);
    }
  );
});
