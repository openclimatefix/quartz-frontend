/**
 * The regional chart's header figures, rendered through `GspPvRemixChart` with its data hooks
 * stubbed, so each test states the series the header reads and the text it prints.
 *
 *  - C5: capacity goes through the same formatting as the header's other figures.
 *  - C6: a missing forecast or actual prints the placeholder, and no delta is derived from it.
 *    A published 0 still prints as 0.
 *  - C7: the big "now" figure reads the country's label for the period now filling. GB labels
 *    period-end, so at 16:10 that is the 16:30 row; NL labels period-start, so the 16:00 row.
 *  - Several groups selected at a derived level (GB's DNOs) roll up over the union of their
 *    members, each member once, and are titled "<n> <level label>s".
 *
 * `ForecastHeaderGSP` has not rendered its `children` (the "now / capacity" figure) since
 * 2023, so the C5 and C7 tests render them beside the real header to read what index.tsx
 * passes.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import React from "react";
import { render } from "@testing-library/react";
import type { TimeSeries } from "../../../lib/domain/types";

jest.mock("next/router", () => ({ __esModule: true, default: { push: jest.fn() } }));
jest.mock("@sentry/nextjs", () => ({ __esModule: true, captureException: jest.fn() }));
jest.mock("@auth0/nextjs-auth0/client", () => ({
  __esModule: true,
  useUser: () => ({ user: null, isLoading: false, error: undefined })
}));

type Scenario = {
  country: string;
  level: string;
  selectedRegions: string[];
  forecast?: TimeSeries;
  generation?: TimeSeries;
  capacityMw: number;
  /** A derived level's grouping file, and per-member forecasts the roll-up stub sums. */
  derived?: {
    label: string;
    groupings: Record<string, string[]>;
    memberMw: Record<string, number>;
  };
};
let scenario: Scenario;

jest.mock("../remix-line", () => ({ __esModule: true, default: () => null }));
jest.mock("../use-format-chart-data", () => ({ __esModule: true, default: () => [] }));
jest.mock("../../icons/spinner", () => ({ __esModule: true, default: () => null }));
jest.mock("../../../hooks/data/use-country-format", () => ({
  __esModule: true,
  useCountryFormatting: () => ({ timezone: "UTC", locale: "en-GB" })
}));
jest.mock("../../../hooks/data/use-map-geometry", () => ({
  __esModule: true,
  useLevelGroupings: () => ({ data: scenario.derived?.groupings })
}));
jest.mock("../../../hooks/data/use-regions", () => ({
  __esModule: true,
  useGenerationSources: () => ({ data: undefined })
}));
jest.mock("../../../hooks/data", () => ({
  __esModule: true,
  useFocusedCountry: () => scenario.country,
  useCurrentAggregationLevel: () =>
    scenario.derived
      ? { level: 2, derived: true, regionType: "gsp", label: scenario.derived.label }
      : { level: 1, derived: false, regionType: scenario.level, label: scenario.level },
  useAggregationLevels: () => [
    { level: 1, derived: false, regionType: scenario.level, label: scenario.level }
  ]
}));
jest.mock("../../helpers/globalState", () => ({
  __esModule: true,
  default: (key: string) => [key === "nHourForecast" ? 4 : false, jest.fn()],
  useCountryState: () => [scenario.level, jest.fn()]
}));
const aggregateArgs: [string[] | null, string | null][] = [];
jest.mock("./use-gsp-region-data", () => {
  const data = (single: boolean, names?: string[] | null) => ({
    forecast:
      scenario.derived && names
        ? {
            regionName: "rollup",
            capacityMw: null,
            values: [
              {
                timeUtc: "2025-07-01T16:30:00+00:00",
                powerMw: names.reduce((sum, name) => sum + scenario.derived!.memberMw[name], 0)
              }
            ]
          }
        : scenario.forecast,
    generationSeries: scenario.generation ? [scenario.generation] : [],
    primaryGeneration: scenario.generation,
    nHour: undefined,
    region: single ? { capacityMw: scenario.capacityMw, label: "Region" } : undefined,
    capacityMw: scenario.capacityMw,
    memberLabels: ["A", "B"],
    isLoading: false,
    hasError: false
  });
  return {
    __esModule: true,
    useGspRegionData: () => data(true),
    useGspAggregateData: (names: string[] | null, groupName: string | null) => {
      aggregateArgs.push([names, groupName]);
      return data(false, names);
    },
    useGspRegionNames: (ids: string[] | null) => ids
  };
});

// The real header, with the `children` it drops rendered beside it.
jest.mock("./forecast-header-gsp", () => {
  const Real = (jest.requireActual("./forecast-header-gsp") as { default: React.FC<any> }).default;
  return {
    __esModule: true,
    default: (props: { children?: React.ReactNode }) => (
      <>
        <Real {...props} />
        <div data-test="header-children">{props.children}</div>
      </>
    )
  };
});

import GspPvRemixChart from "./index";

const series = (points: [string, number | null][]): TimeSeries => ({
  regionName: "r",
  capacityMw: null,
  values: points.map(([hhmm, powerMw]) => ({
    timeUtc: `2025-07-01T${hhmm}:00+00:00`,
    powerMw
  })) as TimeSeries["values"]
});

const renderChart = (deltaView = false) =>
  render(
    <GspPvRemixChart
      selectedRegions={scenario.selectedRegions}
      selectedTime="2025-07-01T16:00:00+00:00"
      close={jest.fn()}
      setTimeOfInterest={jest.fn()}
      timeNow="2025-07-01T16:00:00+00:00"
      resetTime={jest.fn()}
      visibleLines={[]}
      deltaView={deltaView}
    />
  );

/** The big "now" figure: the first `text-solar` span in the header's children. */
const nowFigure = (container: HTMLElement) =>
  container.querySelector("span.text-solar.text-lg")?.textContent;

const deltaFigure = (container: HTMLElement) =>
  container.querySelector('[data-test="delta-header-figure"] > div')?.textContent;

beforeEach(() => {
  aggregateArgs.length = 0;
  // 16:10 UTC: inside a period on both grids.
  jest.spyOn(Date, "now").mockReturnValue(Date.parse("2025-07-01T16:10:00Z"));
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe("C7: the now figure reads the period now filling", () => {
  test("GB (period-end, 30 min) at 16:10 reads the 16:30 row", () => {
    scenario = {
      country: "GB",
      level: "gsp",
      selectedRegions: ["67"],
      forecast: series([
        ["15:30", 50],
        ["16:00", 111],
        ["16:30", 333]
      ]),
      generation: series([["15:30", 40]]),
      capacityMw: 400
    };
    const { container } = renderChart();
    expect(nowFigure(container)).toBe("333");
  });

  test("NL (period-start, 15 min) at 16:10 reads the 16:00 row", () => {
    scenario = {
      country: "NL",
      level: "province",
      selectedRegions: ["utrecht"],
      forecast: series([
        ["15:45", 900],
        ["16:00", 1110],
        ["16:15", 1330]
      ]),
      generation: series([["15:45", 800]]),
      capacityMw: 4000
    };
    const { container } = renderChart();
    expect(nowFigure(container)).toBe("1.11");
  });
});

describe("C5: capacity is formatted like the header's other figures", () => {
  test("a GB multi-select summing to a float tail prints one decimal", () => {
    scenario = {
      country: "GB",
      level: "gsp",
      selectedRegions: ["1", "2"],
      forecast: series([["16:30", 5]]),
      generation: series([["15:30", 4]]),
      capacityMw: 3.982 + 8.772
    };
    const { container } = renderChart();
    expect(container.textContent).not.toContain("12.754000000000001");
    expect(container.textContent).toContain("/ 12.8");
  });
});

describe("C6: a missing value is a placeholder, a published 0 is 0", () => {
  test("no actual in the window: the actual and the delta are placeholders", () => {
    scenario = {
      country: "GB",
      level: "gsp",
      selectedRegions: ["67"],
      forecast: series([
        ["16:00", 120],
        ["16:30", 130]
      ]),
      generation: series([
        ["15:30", null],
        ["16:00", null]
      ]),
      capacityMw: 400
    };
    const { container } = renderChart(true);
    expect(container.querySelector("span.text-solar-light")?.textContent).toBe("–");
    expect(deltaFigure(container)).toBe("–");
  });

  test("no forecast at the latest actual's slot: the forecast and the delta are placeholders", () => {
    scenario = {
      country: "GB",
      level: "gsp",
      selectedRegions: ["67"],
      forecast: series([["16:30", 130]]),
      generation: series([["15:30", 90]]),
      capacityMw: 400
    };
    const { container } = renderChart(true);
    expect(container.querySelector("span.text-solar-light")?.textContent).toBe("90.0");
    expect(container.textContent).not.toContain("90.0 / 0.0");
    expect(deltaFigure(container)).toBe("–");
  });

  test("a published 0 overnight still prints as 0", () => {
    scenario = {
      country: "GB",
      level: "gsp",
      selectedRegions: ["67"],
      forecast: series([
        ["15:30", 0],
        ["16:00", 0],
        ["16:30", 0]
      ]),
      generation: series([["15:30", 0]]),
      capacityMw: 400
    };
    const { container } = renderChart(true);
    expect(container.querySelector("span.text-solar-light")?.textContent).toBe("0.0");
    expect(nowFigure(container)).toBe("0");
    expect(deltaFigure(container)).toBe("0.0");
  });
});

describe("several groups at a derived level roll up together", () => {
  test("two DNOs sharing a member sum each member once, titled by the level", () => {
    scenario = {
      country: "GB",
      level: "dno",
      selectedRegions: ["North", "South", "Missing"],
      capacityMw: 400,
      derived: {
        label: "DNO",
        groupings: { North: ["a", "shared"], South: ["shared", "b"], East: ["c"] },
        memberMw: { a: 1, shared: 10, b: 100, c: 1000 }
      }
    };
    const { container } = renderChart();
    const [names, groupName] = aggregateArgs[aggregateArgs.length - 1];
    expect([...(names ?? [])].sort()).toEqual(["a", "b", "shared"]);
    expect(groupName).toBe("2 DNOs");
    expect(nowFigure(container)).toBe("111");
    expect(container.textContent).toContain("2 DNOs");
  });

  test("one DNO is unchanged: its own name and members", () => {
    scenario = {
      country: "GB",
      level: "dno",
      selectedRegions: ["South"],
      capacityMw: 400,
      derived: {
        label: "DNO",
        groupings: { North: ["a", "shared"], South: ["shared", "b"] },
        memberMw: { a: 1, shared: 10, b: 100 }
      }
    };
    const { container } = renderChart();
    const [names, groupName] = aggregateArgs[aggregateArgs.length - 1];
    expect(names).toEqual(["shared", "b"]);
    expect(groupName).toBe("South");
    expect(nowFigure(container)).toBe("110");
  });
});
