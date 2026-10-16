/**
 * The chart tooltip's figures, in the unit its heading names.
 *
 * Recharts draws nothing in jsdom (the container is 0x0 and the tooltip only appears on hover),
 * so it is stubbed: every chart part renders nothing except `Tooltip`, which calls its `content`
 * with one row, the way Recharts does on hover. What is under test is the text of that content.
 */
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import React from "react";
import { render, screen, within } from "@testing-library/react";

let mockTooltipRow: Record<string, unknown> = {};

jest.mock("recharts", () => {
  const passThrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const nothing = () => null;
  return {
    __esModule: true,
    Area: nothing,
    Bar: nothing,
    CartesianGrid: nothing,
    ComposedChart: passThrough,
    Line: nothing,
    Rectangle: nothing,
    ReferenceLine: nothing,
    ReferenceArea: nothing,
    ResponsiveContainer: passThrough,
    XAxis: nothing,
    YAxis: nothing,
    Tooltip: ({ content }: { content: (props: unknown) => React.ReactNode }) => (
      <div data-testid="tooltip">
        {content({ payload: [{ payload: mockTooltipRow }], label: mockTooltipRow.formattedDate })}
      </div>
    )
  };
});
jest.mock("../../hooks/data/use-countries", () => ({
  __esModule: true,
  useFocusedCountry: () => "GB"
}));
jest.mock("../../hooks/data/use-regions", () => ({
  __esModule: true,
  useGenerationSources: () => ({ data: undefined })
}));
jest.mock("../../hooks/data/use-country-format", () => ({
  __esModule: true,
  useCountryFormatting: () => ({ timezone: "Europe/London", locale: "en-GB" })
}));

import { setGlobalState } from "../helpers/globalState";
import RemixLine, { type ChartData } from "./remix-line";

// A finished period, two hours before LIVE, so the delta row is shown.
const row: ChartData = {
  formattedDate: "2026-09-29T12:00",
  FORECAST: 21437,
  GENERATION_UPDATED: 21087,
  DELTA: -350,
  PROBABILISTIC_RANGE_10_90: [18234, 24567]
};

const renderTooltip = (national: boolean) => {
  mockTooltipRow = row;
  render(
    <RemixLine
      timeOfInterest="2026-09-29T12:00"
      timeNow="2026-09-29T14:00"
      data={[{ ...row }]}
      yMax={30000}
      national={national}
      visibleLines={["FORECAST", "GENERATION_UPDATED"]}
      deltaView
    />
  );
  return within(screen.getByTestId("tooltip"));
};

const rowValue = (tooltip: ReturnType<typeof within>, title: string) =>
  tooltip.getByText(`${title}:`).nextElementSibling?.textContent?.trim();

describe("RemixLine tooltip", () => {
  beforeEach(() => {
    setGlobalState("showNHourView", false);
    setGlobalState("isSitesChart", false);
    setGlobalState("pLevels", [[10, 90]]);
  });

  describe("national chart (GW)", () => {
    test("the delta reads in GW, to two decimal places", () => {
      const tooltip = renderTooltip(true);
      expect(tooltip.getByText("GW")).toBeTruthy();
      expect(rowValue(tooltip, "Delta")).toBe("-0.35");
    });

    test("readings of 10 GW and above keep one decimal place", () => {
      const tooltip = renderTooltip(true);
      expect(rowValue(tooltip, "OCF")).toBe("21.4");
      expect(rowValue(tooltip, "PV Live Actual")).toBe("21.1");
      expect(rowValue(tooltip, "OCF P10")).toBe("18.2");
      expect(rowValue(tooltip, "OCF P90")).toBe("24.6");
    });
  });

  describe("regional chart in a MW country", () => {
    test("the delta and the readings are whole megawatts", () => {
      const tooltip = renderTooltip(false);
      expect(tooltip.getByText("MW")).toBeTruthy();
      expect(rowValue(tooltip, "Delta")).toBe("-350");
      expect(rowValue(tooltip, "OCF")).toBe("21,437");
      expect(rowValue(tooltip, "OCF P90")).toBe("24,567");
    });
  });
});
