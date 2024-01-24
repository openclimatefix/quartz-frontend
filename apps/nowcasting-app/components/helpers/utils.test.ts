import { describe, expect, test } from "@jest/globals";
import {
  convertISODateStringToLondonTime,
  getOpacityValueFromPVNormalized,
  prettyPrintChartAxisLabelDate
} from "./utils";
import * as utils from "./utils";

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
    expect(convertISODateStringToLondonTime("2021-01-01T03:21:00.000")).toBe("03:21");
    expect(convertISODateStringToLondonTime("2021-01-01T03:50:11")).toBe("03:50");
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
