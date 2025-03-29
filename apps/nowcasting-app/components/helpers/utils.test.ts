import { describe, expect, test } from "@jest/globals";
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
  test("should return 0 when chart data is empty array", () => {
    const result = utils.calculateChartYMax([]);
    expect(result).toBe(0);
  });

  test("should round up to nearest 1000 with buffer of 1000", () => {
    const chartData = [{ GENERATION: 12500, formattedDate: "2022-05-16T15:00" }];
    const result = utils.calculateChartYMax(chartData);
    expect(result).toBe(14000); // 12500 + 1000 = 13500 rounded to nearest 1000 is 14000
  });

  test("should handle multiple numeric values", () => {
    const chartData = [
      { GENERATION: 5000, FORECAST: 8000, formattedDate: "2022-05-16T15:00" },
      { GENERATION: 3000, FORECAST: 7000, formattedDate: "2022-05-16T16:00" }
    ];
    const result = utils.calculateChartYMax(chartData, 0); // the MAX_NATIONAL_GENERATION_MW is not considered for this test
    expect(result).toBe(9000); // (8000 + 1000) rounded up to nearest 1000 is 9000
  });

  test("should ignore formattedDate fields", () => {
    const chartData = [{ GENERATION: 15500, formattedDate: "2023-10-12" }];
    const result = utils.calculateChartYMax(chartData, 0); // the MAX_NATIONAL_GENERATION_MW is not considered for this test
    expect(result).toBe(17000); // (15500 + 1000) rounded up to nearest 1000 is 17000
  });

  test("should handle edge case where values exactly match rounding threshold", () => {
    const chartData = [{ GENERATION: 15000, formattedDate: "2022-05-16T15:00" }];
    const result = utils.calculateChartYMax(chartData);
    expect(result).toBe(16000); // (15000 + 1000) rounded up to next 1000
  });

  test("should consider yMax if the value of yMax is greater than the Max National Generation", () => {
    const chartData = [{ GENERATION: 15000, formattedDate: "2022-05-16T15:00" }];
    const result = Math.max(utils.calculateChartYMax(chartData), MAX_NATIONAL_GENERATION_MW);
    expect(result).toBe(utils.calculateChartYMax(chartData));
  });

  test("should consider Max National Generation if the value of yMax is less than the Max National Generation", () => {
    const chartData = [{ GENERATION: 10000, formattedDate: "2022-05-16T15:00" }];
    const result = Math.max(utils.calculateChartYMax(chartData), MAX_NATIONAL_GENERATION_MW);
    expect(result).toBe(MAX_NATIONAL_GENERATION_MW);
  });
});
