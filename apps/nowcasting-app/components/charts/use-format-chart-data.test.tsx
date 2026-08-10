/**
 * Characterisation tests for `useFormatChartData` — the hook that assembles the national/GSP
 * chart dataset out of the canonical (v1) forecast, model, N-hour and generation series, plus
 * p-levels and seasonal norms.
 *
 * These pin CURRENT behaviour, bugs included, because Phase 4 rewrites the pipeline onto the v1
 * data layer and the only safe definition of "the same chart" is "the same numbers out". Where a
 * pinned behaviour is wrong, it carries a `// CHARACTERISATION:` comment saying what it should be;
 * those assertions are expected to be inverted deliberately, not to fail by surprise.
 *
 * Two things dominate:
 *  - the past/future split, which depends on the wall clock, so time is frozen via Luxon's
 *    `Settings.now` (the only clock `getCursorNow` reads);
 *  - the UTC-slot vs GB-settlement-period distinction, which disagree by two slots all summer.
 *
 * Fixtures are hand-written and tiny so every expected number is checkable by eye.
 */
import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react";
import { DateTime, Settings } from "luxon";
import useFormatChartData from "./use-format-chart-data";
import { setGlobalState } from "../helpers/globalState";
import { ChartData, getPLevelRangeKey } from "./remix-line";
// The fixture asset itself (Track A shipped it; the numbers are identical to the retired
// `data/national_metrics.json` bundled import this test used to read — verified byte-for-byte
// before this test file switched over). Importing the shipped asset rather than the deleted
// bundle import is what keeps the hand-checked assertions below an oracle on real data.
import nationalMetrics from "../../public/data/gb/national-metrics.json";
import { getSettlementPeriodForDate, getUtcHalfHourIndex } from "../helpers/chartUtils";
import { useSeasonalNorms } from "../../hooks/data/use-seasonal-norms";

// `useFormatChartData` now gets its norms through `useSeasonalNorms` rather than a bundled
// import (Phase 5). Mocked here to return the same fixture synchronously, so every existing
// characterisation test — hundreds of them, reading `run(...)` synchronously — is unaffected.
// The hook's own async-arrival and "no dataset" behaviour is `useSeasonalNorms`'s contract and
// is tested in `hooks/data/use-seasonal-norms.test.ts`; this file only needs one test proving
// this hook renders correctly when that contract hands back `undefined`.
jest.mock("../../hooks/data/use-seasonal-norms", () => ({
  __esModule: true,
  useSeasonalNorms: jest.fn()
}));
const mockedUseSeasonalNorms = useSeasonalNorms as jest.MockedFunction<typeof useSeasonalNorms>;

// Duplicated from the hook on purpose: if the module's constant changes, these tests should fail
// rather than silently follow it.
const NATIONAL_CAPACITY = 21504.629;

// Frozen "now". 10:12Z rounds up to the 10:30 slot, so the past/future boundary is 10:30:00Z.
// 1 July is BST, which is what makes the settlement-period assertions load-bearing.
const NOW_BST = "2025-07-01T10:12:00.000Z";
const BOUNDARY_BST = "2025-07-01T10:30:00Z";
const BEFORE_BST = "2025-07-01T10:00:00Z";
const AFTER_BST = "2025-07-01T11:00:00Z";

const freeze = (iso: string) => {
  const fixed = DateTime.fromISO(iso, { zone: "utc" }).toMillis();
  Settings.now = () => fixed;
};

type Props = Parameters<typeof useFormatChartData>[0];

const render = (props: Props) =>
  renderHook((p: Props) => useFormatChartData(p), { initialProps: props });

const run = (props: Props): ChartData[] => render(props).result.current;

// A canonical TimeSeries, built from [timeUtc, powerMw] pairs and (optionally) plevels keyed the
// wire way ("10", "90", …).
const ts = (points: [string, number | null][], plevelsMw?: Record<string, number>) =>
  ({
    regionName: "Great Britain",
    capacityMw: NATIONAL_CAPACITY,
    values: points.map(([timeUtc, powerMw]) => ({
      timeUtc,
      powerMw,
      ...(plevelsMw ? { plevelsMw } : {})
    }))
  } as any);

// The three arguments the guard requires, in their most boring possible form: a primary
// forecast, one generation series, and a time trigger.
const baseProps = (overrides: Partial<Props> = {}): Props => ({
  forecastSeries: ts([]),
  generationSeries: [{ key: "GENERATION", series: ts([]) }],
  timeTrigger: "tick",
  ...overrides
});

const at = (data: ChartData[], formattedDate: string): Record<string, any> => {
  const found = data.filter((d) => d.formattedDate === formattedDate);
  expect(found).toHaveLength(1);
  return found[0] as Record<string, any>;
};

beforeEach(() => {
  freeze(NOW_BST);
  // react-hooks-global-state has no provider, so state is module-global and leaks between tests.
  setGlobalState("nHourForecast", 4);
  setGlobalState("pLevels", [[10, 90]]);
  mockedUseSeasonalNorms.mockReturnValue(nationalMetrics as ReturnType<typeof useSeasonalNorms>);
});

afterEach(() => {
  Settings.now = () => Date.now();
});

describe("the guard", () => {
  test("returns [] unless forecastSeries, every generationSeries entry and timeTrigger are all present", () => {
    expect(run(baseProps())).toEqual([]);

    expect(run(baseProps({ forecastSeries: undefined }))).toEqual([]);
    expect(run(baseProps({ timeTrigger: undefined }))).toEqual([]);
    expect(
      run(baseProps({ generationSeries: [{ key: "GENERATION", series: undefined }] }))
    ).toEqual([]);
  });

  // Empty arrays/series are truthy, so "no data yet" and "data, but none of it" are the same
  // input here and the guard lets the empty case through to produce an empty chart.
  test("empty-but-present series pass the guard and produce an empty dataset", () => {
    expect(run(baseProps())).toEqual([]);
  });
});

describe("past/future forecast split", () => {
  test("a targetTime after now is FORECAST only", () => {
    const datum = at(
      run(baseProps({ forecastSeries: ts([[AFTER_BST, 123]]) })),
      "2025-07-01T11:00"
    );
    expect(datum.FORECAST).toBe(123);
    expect(datum.PAST_FORECAST).toBeUndefined();
  });

  test("a targetTime before now is PAST_FORECAST only", () => {
    const datum = at(
      run(baseProps({ forecastSeries: ts([[BEFORE_BST, 77]]) })),
      "2025-07-01T10:00"
    );
    expect(datum.PAST_FORECAST).toBe(77);
    expect(datum.FORECAST).toBeUndefined();
  });

  // The boundary slot is deliberately written to BOTH series so the past and future lines join up
  // on the chart instead of leaving a one-slot gap. This is the case that breaks whenever the
  // rounding of "now" changes, so it is pinned hard.
  test("a targetTime EXACTLY equal to now is written to both FORECAST and PAST_FORECAST", () => {
    const datum = at(
      run(baseProps({ forecastSeries: ts([[BOUNDARY_BST, 55]]) })),
      "2025-07-01T10:30"
    );
    expect(datum.FORECAST).toBe(55);
    expect(datum.PAST_FORECAST).toBe(55);
    expect(datum.FORECAST).toBe(datum.PAST_FORECAST);
  });

  // "now" is the 30-minute slot at or after the real clock (10:12 -> 10:30), so a target time
  // that is genuinely still in the future by the wall clock is nonetheless plotted as PAST.
  test("the boundary is the rounded-up 30-minute slot, not the raw clock", () => {
    const data = run(
      baseProps({
        forecastSeries: ts([
          ["2025-07-01T10:15:00Z", 1],
          ["2025-07-01T10:29:00Z", 2]
        ])
      })
    );
    expect(at(data, "2025-07-01T10:15").PAST_FORECAST).toBe(1);
    expect(at(data, "2025-07-01T10:15").FORECAST).toBeUndefined();
    expect(at(data, "2025-07-01T10:29").PAST_FORECAST).toBe(2);
    expect(at(data, "2025-07-01T10:29").FORECAST).toBeUndefined();
  });

  test("equality is instant-based, so a different ISO spelling of the boundary still splits both ways", () => {
    const datum = at(
      run(baseProps({ forecastSeries: ts([["2025-07-01T11:30:00+01:00", 9]]) })),
      "2025-07-01T11:30"
    );
    expect(datum.FORECAST).toBe(9);
    expect(datum.PAST_FORECAST).toBe(9);
  });
});

describe("the N-hour series", () => {
  test("nHourSeries produces N_HOUR_FORECAST / N_HOUR_PAST_FORECAST, both at the boundary", () => {
    const data = run(
      baseProps({
        nHourSeries: ts([
          [BEFORE_BST, 10],
          [BOUNDARY_BST, 20],
          [AFTER_BST, 30]
        ])
      })
    );
    expect(at(data, "2025-07-01T10:00")).toMatchObject({ N_HOUR_PAST_FORECAST: 10 });
    expect(at(data, "2025-07-01T10:00").N_HOUR_FORECAST).toBeUndefined();
    expect(at(data, "2025-07-01T10:30")).toMatchObject({
      N_HOUR_FORECAST: 20,
      N_HOUR_PAST_FORECAST: 20
    });
    expect(at(data, "2025-07-01T11:00")).toMatchObject({ N_HOUR_FORECAST: 30 });
    expect(at(data, "2025-07-01T11:00").N_HOUR_PAST_FORECAST).toBeUndefined();
  });

  // `nHourForecast` only decides the KEY PREFIX via a truthiness check on `forecast_horizon`;
  // it never filters or shifts anything, so the numbers are identical for 1h and 8h.
  test("the nHourForecast global state does not change the values, only that the N_HOUR keys are used", () => {
    const nHourSeries = ts([[AFTER_BST, 42]]);
    const view = render(baseProps({ nHourSeries }));
    expect(at(view.result.current, "2025-07-01T11:00").N_HOUR_FORECAST).toBe(42);

    act(() => setGlobalState("nHourForecast", 8));
    expect(at(view.result.current, "2025-07-01T11:00").N_HOUR_FORECAST).toBe(42);
  });

  // CHARACTERISATION: current behaviour is wrong — nHourForecast of 0 silently turns the N-hour
  // series into the plain FORECAST series, overwriting the real forecast, because the key is
  // chosen by `forecast_horizon ? ... : ...` and 0 is falsy. It should either be rejected or
  // still produce N_HOUR keys. 0 is not currently selectable in the UI (N_HOUR_FORECAST_OPTIONS
  // is [1,2,4,8]), so this is latent rather than live.
  test("nHourForecast of 0 makes the N-hour series overwrite FORECAST", () => {
    act(() => setGlobalState("nHourForecast", 0));
    const datum = at(
      run(
        baseProps({
          forecastSeries: ts([[AFTER_BST, 100]]),
          nHourSeries: ts([[AFTER_BST, 5]])
        })
      ),
      "2025-07-01T11:00"
    );
    expect(datum.FORECAST).toBe(5);
    expect(datum.N_HOUR_FORECAST).toBeUndefined();
  });

  // nHourSeries is merged AFTER the settlement-period / seasonal loop has already run over the
  // map's keys, so a timestamp that only the N-hour series knows about never gets them.
  // CHARACTERISATION: current behaviour is wrong — for national, every row should carry the
  // seasonal norms regardless of which series introduced the timestamp.
  test("a timestamp only present in nHourSeries gets no seasonal norms", () => {
    const data = run(
      baseProps({
        forecastSeries: ts([[AFTER_BST, 100]]),
        nHourSeries: ts([
          [AFTER_BST, 90],
          ["2025-07-01T12:00:00Z", 80]
        ])
      })
    );
    expect(at(data, "2025-07-01T11:00").SEASONAL_MEAN).toBeDefined();
    const orphan = at(data, "2025-07-01T12:00");
    expect(orphan.N_HOUR_FORECAST).toBe(80);
    expect(orphan.SEASONAL_MEAN).toBeUndefined();
  });
});

describe("the merge", () => {
  test("timestamps present in only some series merge into one row per timestamp", () => {
    const data = run(
      baseProps({
        generationSeries: [
          { key: "GENERATION_UPDATED", series: ts([[BEFORE_BST, 1]]) },
          {
            key: "GENERATION",
            series: ts([
              [BEFORE_BST, 2],
              ["2025-07-01T09:30:00Z", 3]
            ])
          }
        ],
        forecastSeries: ts([
          [BEFORE_BST, 50],
          [AFTER_BST, 60]
        ])
      })
    );
    expect(data).toHaveLength(3);
    expect(at(data, "2025-07-01T09:30")).toMatchObject({ GENERATION: 3 });
    expect(at(data, "2025-07-01T10:00")).toMatchObject({
      GENERATION_UPDATED: 1,
      GENERATION: 2,
      PAST_FORECAST: 50
    });
    expect(at(data, "2025-07-01T11:00")).toMatchObject({ FORECAST: 60 });
  });

  test("row order follows first-write order: generationSeries in order, then forecast, then models", () => {
    const data = run(
      baseProps({
        generationSeries: [
          { key: "GENERATION_UPDATED", series: ts([["2025-07-01T09:00:00Z", 1000]]) },
          { key: "GENERATION", series: ts([["2025-07-01T08:00:00Z", 1000]]) }
        ],
        forecastSeries: ts([["2025-07-01T07:00:00Z", 1]]),
        modelSeries: [{ key: "SAT_ONLY", series: ts([["2025-07-01T06:00:00Z", 1]]) }]
      })
    );
    expect(data.map((d) => d.formattedDate)).toEqual([
      "2025-07-01T09:00",
      "2025-07-01T08:00",
      "2025-07-01T07:00",
      "2025-07-01T06:00"
    ]);
  });

  test("formattedDate is set by the first writer and never overwritten", () => {
    const data = run(
      baseProps({
        generationSeries: [{ key: "GENERATION_UPDATED", series: ts([[BEFORE_BST, 1000]]) }],
        forecastSeries: ts([[BEFORE_BST, 50]])
      })
    );
    expect(data).toHaveLength(1);
    expect(data[0].formattedDate).toBe("2025-07-01T10:00");
  });

  // The merge key is the RAW datetime string, not a normalised instant. Every current producer
  // emits "Z", so this does not bite today — but it is exactly the assumption a producer that
  // emits "+00:00" (or seconds-less timestamps) would break, and the failure mode is silent:
  // two rows, same formattedDate, each holding half the series.
  // CHARACTERISATION: current behaviour is wrong — the map should be keyed on the parsed instant
  // (or a normalised ISO string), so equivalent spellings merge.
  test("two spellings of the same instant do NOT merge, and produce duplicate formattedDates", () => {
    const data = run(
      baseProps({
        generationSeries: [
          { key: "GENERATION_UPDATED", series: ts([["2025-07-01T10:00:00+00:00", 1000]]) }
        ],
        forecastSeries: ts([["2025-07-01T10:00:00Z", 50]])
      })
    );
    expect(data).toHaveLength(2);
    expect(data.map((d) => d.formattedDate)).toEqual(["2025-07-01T10:00", "2025-07-01T10:00"]);
    expect(data[0].GENERATION_UPDATED).toBe(1000);
    expect(data[0].PAST_FORECAST).toBeUndefined();
    expect(data[1].PAST_FORECAST).toBe(50);
  });

  test("a later point wins a key collision on the same timestamp", () => {
    // Both truth series write different keys, so collisions only happen within a series or
    // between the plain forecast and an N-hour series sharing a key (see the 0-hour case above).
    const data = run(
      baseProps({
        generationSeries: [
          {
            key: "GENERATION",
            series: ts([
              [BEFORE_BST, 1000],
              [BEFORE_BST, 4000]
            ])
          }
        ]
      })
    );
    expect(data).toHaveLength(1);
    expect(data[0].GENERATION).toBe(4000);
  });
});

describe("model series write whatever key the config names", () => {
  test.each([
    "INTRADAY_ECMWF_ONLY",
    "PVNET_DAY_AHEAD",
    "PVNET_INTRADAY",
    "MET_OFFICE_ONLY",
    "SAT_ONLY"
  ])("%s produces %s / PAST_%s with the same boundary rule", (key) => {
    const data = run(
      baseProps({
        modelSeries: [
          {
            key,
            series: ts([
              [BEFORE_BST, 1],
              [BOUNDARY_BST, 2],
              [AFTER_BST, 3]
            ])
          }
        ]
      })
    );
    expect(at(data, "2025-07-01T10:00")[`PAST_${key}`]).toBe(1);
    expect(at(data, "2025-07-01T10:00")[key]).toBeUndefined();
    expect(at(data, "2025-07-01T10:30")[key]).toBe(2);
    expect(at(data, "2025-07-01T10:30")[`PAST_${key}`]).toBe(2);
    expect(at(data, "2025-07-01T11:00")[key]).toBe(3);
    expect(at(data, "2025-07-01T11:00")[`PAST_${key}`]).toBeUndefined();
  });

  test("all model series merge onto the same timestamp as the main forecast and the truth series", () => {
    const series = ts([[AFTER_BST, 7]]);
    const data = run(
      baseProps({
        forecastSeries: ts([[AFTER_BST, 100]]),
        generationSeries: [{ key: "GENERATION", series: ts([[AFTER_BST, 5000]]) }],
        modelSeries: [
          { key: "INTRADAY_ECMWF_ONLY", series },
          { key: "PVNET_DAY_AHEAD", series },
          { key: "PVNET_INTRADAY", series },
          { key: "MET_OFFICE_ONLY", series },
          { key: "SAT_ONLY", series }
        ]
      })
    );
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      FORECAST: 100,
      GENERATION: 5000,
      INTRADAY_ECMWF_ONLY: 7,
      PVNET_DAY_AHEAD: 7,
      PVNET_INTRADAY: 7,
      MET_OFFICE_ONLY: 7,
      SAT_ONLY: 7
    });
  });

  test("a model series that has not loaded yet contributes nothing at all, and does not block", () => {
    const data = run(
      baseProps({
        forecastSeries: ts([[AFTER_BST, 100]]),
        modelSeries: [{ key: "SAT_ONLY", series: undefined }]
      })
    );
    expect(at(data, "2025-07-01T11:00").FORECAST).toBe(100);
    expect(Object.keys(data[0]).some((k) => k.includes("SAT_ONLY"))).toBe(false);
  });
});

describe("p-levels", () => {
  const plevels = {
    "2": 2,
    "10": 5,
    "25": 8,
    "75": 12,
    "90": 15,
    "98": 20
  };

  test("one range key per selected pair, and PROBABILISTIC_UPPER_BOUND is the widest upper bound", () => {
    act(() =>
      setGlobalState("pLevels", [
        [10, 90],
        [2, 98]
      ])
    );
    const datum = at(
      run(baseProps({ forecastSeries: ts([[AFTER_BST, 100]], plevels) })),
      "2025-07-01T11:00"
    );
    expect(datum[getPLevelRangeKey(10, 90)]).toEqual([5, 15]);
    expect(datum[getPLevelRangeKey(2, 98)]).toEqual([2, 20]);
    expect(datum[getPLevelRangeKey(25, 75)]).toBeUndefined();
    expect(datum.PROBABILISTIC_UPPER_BOUND).toBe(20);
  });

  test("a pair missing one side is dropped, and does not contribute to the upper bound", () => {
    act(() =>
      setGlobalState("pLevels", [
        [10, 90],
        [2, 98]
      ])
    );
    const partial = { "2": 2, "10": 5, "90": 15 }; // no plevel 98
    const datum = at(
      run(baseProps({ forecastSeries: ts([[AFTER_BST, 100]], partial) })),
      "2025-07-01T11:00"
    );
    expect(datum[getPLevelRangeKey(2, 98)]).toBeUndefined();
    expect(datum[getPLevelRangeKey(10, 90)]).toEqual([5, 15]);
    expect(datum.PROBABILISTIC_UPPER_BOUND).toBe(15);
  });

  test("if no selected pair is available, no probabilistic keys are written at all", () => {
    act(() => setGlobalState("pLevels", [[2, 98]]));
    const datum = at(
      run(baseProps({ forecastSeries: ts([[AFTER_BST, 100]], { "10": 5, "90": 15 }) })),
      "2025-07-01T11:00"
    );
    expect(datum.PROBABILISTIC_UPPER_BOUND).toBeUndefined();
    expect(Object.keys(datum).some((k) => k.startsWith("PROBABILISTIC_RANGE"))).toBe(false);
  });

  test("an empty pLevels selection writes nothing, even when the payload has plevels", () => {
    act(() => setGlobalState("pLevels", []));
    const datum = at(
      run(baseProps({ forecastSeries: ts([[AFTER_BST, 100]], plevels) })),
      "2025-07-01T11:00"
    );
    expect(datum.PROBABILISTIC_UPPER_BOUND).toBeUndefined();
    expect(Object.keys(datum).some((k) => k.startsWith("PROBABILISTIC"))).toBe(false);
  });

  test("a forecast with no plevels object writes nothing", () => {
    const datum = at(
      run(baseProps({ forecastSeries: ts([[AFTER_BST, 100]]) })),
      "2025-07-01T11:00"
    );
    expect(Object.keys(datum).some((k) => k.startsWith("PROBABILISTIC"))).toBe(false);
  });

  test("p-levels are written for past forecasts too", () => {
    const datum = at(
      run(baseProps({ forecastSeries: ts([[BEFORE_BST, 100]], plevels) })),
      "2025-07-01T10:00"
    );
    expect(datum[getPLevelRangeKey(10, 90)]).toEqual([5, 15]);
  });
});

describe("settlement period vs UTC half-hour slot", () => {
  // The regression guard for B9. The GB settlement period is counted from Europe/London midnight;
  // the seasonal norms are indexed by the UTC half-hour slot; throughout BST the two answers are
  // two apart. The chart row no longer carries a settlement period (it was written and never read),
  // so this asserts against `getSettlementPeriodForDate` directly, and separately checks that the
  // hook still picks the seasonal norms off the UTC slot. If these ever collapse back into one
  // call — in chartUtils or in the hook — this fails.
  const utcInstant = (iso: string) => DateTime.fromISO(iso, { zone: "utc" }) as DateTime;

  test("in BST the settlement period is two slots ahead of the UTC half-hour index", () => {
    const instant = utcInstant(BOUNDARY_BST); // 10:30 UTC == 11:30 London
    const utcSlotIndex = getUtcHalfHourIndex(instant);
    const settlementPeriod = getSettlementPeriodForDate(instant);
    expect(utcSlotIndex).toBe(21);
    expect(settlementPeriod).toBe(24);
    expect(settlementPeriod - (utcSlotIndex + 1)).toBe(2);

    // and the hook takes the seasonal value from the UTC slot, not from the settlement period
    const datum = at(
      run(baseProps({ forecastSeries: ts([[BOUNDARY_BST, 100]]) })),
      "2025-07-01T10:30"
    );
    expect(datum.SEASONAL_MEAN).toBeCloseTo(
      nationalMetrics.data["7"]["1"].mean[utcSlotIndex] * NATIONAL_CAPACITY,
      6
    );
    expect(datum.SEASONAL_MEAN).not.toBeCloseTo(
      nationalMetrics.data["7"]["1"].mean[settlementPeriod - 1] * NATIONAL_CAPACITY,
      6
    );
  });

  test("in GMT the two agree (settlement period is the UTC slot index plus one)", () => {
    freeze("2025-01-15T10:12:00.000Z");
    const instant = utcInstant("2025-01-15T10:30:00Z");
    const utcSlotIndex = getUtcHalfHourIndex(instant);
    const settlementPeriod = getSettlementPeriodForDate(instant);
    expect(utcSlotIndex).toBe(21);
    expect(settlementPeriod).toBe(22);
    expect(settlementPeriod - (utcSlotIndex + 1)).toBe(0);

    const datum = at(
      run(baseProps({ forecastSeries: ts([["2025-01-15T10:30:00Z", 100]]) })),
      "2025-01-15T10:30"
    );
    expect(datum.SEASONAL_MEAN).toBeCloseTo(
      nationalMetrics.data["1"]["15"].mean[utcSlotIndex] * NATIONAL_CAPACITY,
      6
    );
  });

  test("settlement periods run 1-48 from London midnight", () => {
    expect(
      ["2025-01-15T00:00:00Z", "2025-01-15T00:30:00Z", "2025-01-15T23:30:00Z"].map((iso) =>
        getSettlementPeriodForDate(utcInstant(iso))
      )
    ).toEqual([1, 2, 48]);
  });
});

describe("seasonal norms", () => {
  // National only: the norms are a national-capacity-scaled dataset with no GSP equivalent.
  test("gsp: true skips all seasonal keys", () => {
    const datum = at(
      run(baseProps({ forecastSeries: ts([[BOUNDARY_BST, 100]]), gsp: true })),
      "2025-07-01T10:30"
    );
    expect(datum.FORECAST).toBe(100);
    expect(Object.keys(datum).some((k) => k.startsWith("SEASONAL"))).toBe(false);
  });

  // `useSeasonalNorms` returns `undefined` both while its fetch is in flight and permanently
  // for a country with no dataset (`seasonalNorms: null`, e.g. NL) — that collapse is its own
  // contract, tested in `hooks/data/use-seasonal-norms.test.ts`. This is the one thing this
  // hook must get right about it: render the rest of the chart normally and write no seasonal
  // keys at all, rather than falling back to a previously-loaded country's norms or to zeros.
  test("undefined norms (loading, or no dataset for this country) writes no seasonal keys", () => {
    mockedUseSeasonalNorms.mockReturnValue(undefined);
    const datum = at(
      run(baseProps({ forecastSeries: ts([[BOUNDARY_BST, 100]]) })),
      "2025-07-01T10:30"
    );
    expect(datum.FORECAST).toBe(100);
    expect(Object.keys(datum).some((k) => k.startsWith("SEASONAL"))).toBe(false);
  });

  test("national writes SEASONAL_MEAN, SEASONAL_BOUNDS and the per-quantile keys, capacity-scaled", () => {
    const slot = 21;
    const metrics = nationalMetrics.data["7"]["1"];
    const [p10, p90] = metrics.pLevels;
    const datum = at(
      run(baseProps({ forecastSeries: ts([[BOUNDARY_BST, 100]]) })),
      "2025-07-01T10:30"
    );
    expect(datum.SEASONAL_BOUNDS).toEqual([["P10", "P90"]]);
    expect(datum.SEASONAL_MEAN).toBeCloseTo(metrics.mean[slot] * NATIONAL_CAPACITY, 6);
    expect(datum.SEASONAL_P10).toBeCloseTo(p10[slot] * NATIONAL_CAPACITY, 6);
    expect(datum.SEASONAL_P90).toBeCloseTo(p90[slot] * NATIONAL_CAPACITY, 6);
    expect(datum.SEASONAL_BOUND_P10_P90).toHaveLength(2);
    expect(datum.SEASONAL_BOUND_P10_P90[0]).toBeCloseTo(p10[slot] * NATIONAL_CAPACITY, 6);
    expect(datum.SEASONAL_BOUND_P10_P90[1]).toBeCloseTo(p90[slot] * NATIONAL_CAPACITY, 6);
    // hand-checkable: the July 1st 10:30 UTC values as they stand in data/national_metrics.json
    expect(datum.SEASONAL_MEAN).toBeCloseTo(0.4283 * NATIONAL_CAPACITY, 6);
    expect(datum.SEASONAL_P10).toBeCloseTo(0.263 * NATIONAL_CAPACITY, 6);
    expect(datum.SEASONAL_P90).toBeCloseTo(0.6177 * NATIONAL_CAPACITY, 6);
  });

  test("a GMT date reads the January arrays", () => {
    freeze("2025-01-15T10:12:00.000Z");
    const datum = at(
      run(baseProps({ forecastSeries: ts([["2025-01-15T10:30:00Z", 100]]) })),
      "2025-01-15T10:30"
    );
    expect(datum.SEASONAL_MEAN).toBeCloseTo(0.1202 * NATIONAL_CAPACITY, 6);
    expect(datum.SEASONAL_P10).toBeCloseTo(0.0333 * NATIONAL_CAPACITY, 6);
    expect(datum.SEASONAL_P90).toBeCloseTo(0.2398 * NATIONAL_CAPACITY, 6);
  });

  test("the seasonal lookup is by the row's own date, not by today", () => {
    // "now" is 1 July; the row is 15 January, and must read January's norms.
    const datum = at(
      run(baseProps({ forecastSeries: ts([["2025-01-15T10:30:00Z", 100]]) })),
      "2025-01-15T10:30"
    );
    expect(datum.SEASONAL_MEAN).toBeCloseTo(0.1202 * NATIONAL_CAPACITY, 6);
  });

  test("norms are scaled by the national capacity constant, so the ratio is the raw fraction", () => {
    const datum = at(
      run(baseProps({ forecastSeries: ts([[BOUNDARY_BST, 100]]) })),
      "2025-07-01T10:30"
    );
    expect(datum.SEASONAL_MEAN / NATIONAL_CAPACITY).toBeCloseTo(0.4283, 9);
  });
});

describe("delta mode", () => {
  test("delta is off by default: no DELTA or DELTA_BUCKET keys", () => {
    const datum = at(
      run(
        baseProps({
          forecastSeries: ts([[BEFORE_BST, 70]]),
          generationSeries: [{ key: "GENERATION", series: ts([[BEFORE_BST, 100]]) }]
        })
      ),
      "2025-07-01T10:00"
    );
    expect(datum.DELTA).toBeUndefined();
    expect(datum.DELTA_BUCKET).toBeUndefined();
  });

  test("GENERATION_UPDATED wins over GENERATION when both are present", () => {
    const datum = at(
      run(
        baseProps({
          delta: true,
          forecastSeries: ts([[BEFORE_BST, 70]]),
          generationSeries: [
            { key: "GENERATION_UPDATED", series: ts([[BEFORE_BST, 100]]) },
            { key: "GENERATION", series: ts([[BEFORE_BST, 200]]) }
          ]
        })
      ),
      "2025-07-01T10:00"
    );
    expect(datum.DELTA).toBe(30); // 100 (updated) - 70, not 200 - 70
    expect(datum.DELTA_BUCKET).toBe(25);
  });

  test("GENERATION is used when there is no GENERATION_UPDATED", () => {
    const datum = at(
      run(
        baseProps({
          delta: true,
          forecastSeries: ts([[BEFORE_BST, 70]]),
          generationSeries: [{ key: "GENERATION", series: ts([[BEFORE_BST, 40]]) }]
        })
      ),
      "2025-07-01T10:00"
    );
    expect(datum.DELTA).toBe(-30);
    expect(datum.DELTA_BUCKET).toBe(-25);
  });

  test("with a PAST_FORECAST but no truth at all, it falls back to FORECAST minus N_HOUR_FORECAST", () => {
    // The boundary slot is the only place both PAST_FORECAST and FORECAST exist.
    const datum = at(
      run(
        baseProps({
          delta: true,
          generationSeries: [{ key: "GENERATION", series: ts([]) }],
          forecastSeries: ts([[BOUNDARY_BST, 100]]),
          nHourSeries: ts([[BOUNDARY_BST, 60]])
        })
      ),
      "2025-07-01T10:30"
    );
    expect(datum.DELTA).toBe(40);
  });

  test("with no PAST_FORECAST, future rows use FORECAST minus N_HOUR_FORECAST", () => {
    const datum = at(
      run(
        baseProps({
          delta: true,
          generationSeries: [{ key: "GENERATION", series: ts([]) }],
          forecastSeries: ts([[AFTER_BST, 100]]),
          nHourSeries: ts([[AFTER_BST, 130]])
        })
      ),
      "2025-07-01T11:00"
    );
    expect(datum.DELTA).toBe(-30);
  });

  // CHARACTERISATION: current behaviour is wrong (or at least lossy) — `getDelta` returns 0 when
  // no rule matches, so "we have nothing to compare" and "the forecast was exactly right" are
  // indistinguishable downstream, and both land in the ZERO bucket. It should return undefined
  // for "no comparison possible" so the delta map/chart can omit the row.
  test("no comparable data yields DELTA 0, indistinguishable from a genuine zero delta", () => {
    const noData = at(
      run(
        baseProps({
          delta: true,
          generationSeries: [{ key: "GENERATION", series: ts([]) }],
          forecastSeries: ts([[AFTER_BST, 100]])
        })
      ),
      "2025-07-01T11:00"
    );
    expect(noData.DELTA).toBe(0);
    expect(noData.DELTA_BUCKET).toBe(0);

    const genuineZero = at(
      run(
        baseProps({
          delta: true,
          forecastSeries: ts([[BEFORE_BST, 50]]),
          generationSeries: [{ key: "GENERATION", series: ts([[BEFORE_BST, 50]]) }]
        })
      ),
      "2025-07-01T10:00"
    );
    expect(genuineZero.DELTA).toBe(0);
    expect(genuineZero.DELTA_BUCKET).toBe(0);
    // ...and the two rows are literally identical on the delta keys.
    expect([noData.DELTA, noData.DELTA_BUCKET]).toEqual([
      genuineZero.DELTA,
      genuineZero.DELTA_BUCKET
    ]);
  });

  test("delta is computed for every row, including truth-only rows", () => {
    const data = run(
      baseProps({
        delta: true,
        forecastSeries: ts([]),
        generationSeries: [{ key: "GENERATION", series: ts([[BEFORE_BST, 10]]) }]
      })
    );
    expect(data[0].DELTA).toBe(0);
  });
});

describe("the canonical (v1) inputs", () => {
  /*
   * The national, GSP and delta views all now pass canonical `TimeSeries` values and a
   * config-driven list of (key, series) pairs. What matters here is that the series list is
   * data, not code: an arbitrary key produces that key, and the number of generation series is
   * a country fact.
   */

  const canonical = (overrides: Partial<Props> = {}): Props => ({
    forecastSeries: ts([[AFTER_BST, 100]]),
    generationSeries: [{ key: "GENERATION", series: ts([[BEFORE_BST, 5]]) }],
    timeTrigger: "tick",
    ...overrides
  });

  test("the primary series writes FORECAST with the same past/future rule", () => {
    const data = run(canonical({ forecastSeries: ts([[BEFORE_BST, 10]]), generationSeries: [] }));
    expect(at(data, "2025-07-01T10:00").PAST_FORECAST).toBe(10);
    expect(at(data, "2025-07-01T10:00").FORECAST).toBeUndefined();
  });

  // Everything from the data layer is already MW — the kW conversion happened once at the
  // normalise boundary. A second division here would be the classic double-conversion bug.
  test("generation values are used as MW, not divided again", () => {
    const data = run(canonical());
    expect(at(data, "2025-07-01T10:00").GENERATION).toBe(5);
  });

  // The keys are config, not code: whatever the country's series list names, the row carries.
  test("model series write whatever key the config names", () => {
    const data = run(
      canonical({
        modelSeries: [
          { key: "SAT_ONLY", series: ts([[AFTER_BST, 7]]) },
          { key: "SOME_FUTURE_MODEL", series: ts([[AFTER_BST, 8]]) }
        ]
      })
    );
    expect(at(data, "2025-07-01T11:00")).toMatchObject({
      FORECAST: 100,
      SAT_ONLY: 7,
      SOME_FUTURE_MODEL: 8
    });
  });

  test("a model series that has not loaded yet contributes nothing but does not block", () => {
    const data = run(canonical({ modelSeries: [{ key: "SAT_ONLY", series: undefined }] }));
    expect(at(data, "2025-07-01T11:00").FORECAST).toBe(100);
    expect(Object.keys(at(data, "2025-07-01T11:00")).some((k) => k.includes("SAT_ONLY"))).toBe(
      false
    );
  });

  // The guard is now "every generation series this country HAS", not "both pvlive regimes".
  // A single-observer country must render on one series rather than waiting for a second
  // that does not exist.
  test("one generation series is enough for a single-observer country", () => {
    expect(run(canonical())).not.toEqual([]);
  });

  test("a two-observer country waits for both", () => {
    const oneLoaded = canonical({
      generationSeries: [
        { key: "GENERATION", series: ts([[BEFORE_BST, 5]]) },
        { key: "GENERATION_UPDATED", series: undefined }
      ]
    });
    expect(run(oneLoaded)).toEqual([]);

    const bothLoaded = canonical({
      generationSeries: [
        { key: "GENERATION", series: ts([[BEFORE_BST, 5]]) },
        { key: "GENERATION_UPDATED", series: ts([[BEFORE_BST, 6]]) }
      ]
    });
    expect(at(run(bothLoaded), "2025-07-01T10:00")).toMatchObject({
      GENERATION: 5,
      GENERATION_UPDATED: 6
    });
  });

  test("the primary forecast still gates everything", () => {
    expect(run(canonical({ forecastSeries: undefined }))).toEqual([]);
  });

  // The canonical model distinguishes "no reading" from a genuine zero: a null point is dropped
  // so the line breaks, rather than being written as a hard 0.
  test("a null reading is dropped rather than plotted as zero", () => {
    const data = run(
      canonical({
        generationSeries: [
          {
            key: "GENERATION",
            series: ts([
              [BEFORE_BST, null],
              [AFTER_BST, 3]
            ])
          }
        ]
      })
    );
    expect(data.some((d) => d.formattedDate === "2025-07-01T10:00")).toBe(false);
    expect(at(data, "2025-07-01T11:00").GENERATION).toBe(3);
  });

  // Canonical p-levels are keyed by the bare level ("10"), not v0's "plevel_10".
  test("p-levels come off the primary series with the canonical key shape", () => {
    act(() => setGlobalState("pLevels", [[10, 90]]));
    const datum = at(
      run(canonical({ forecastSeries: ts([[AFTER_BST, 100]], { "10": 5, "90": 15 }) })),
      "2025-07-01T11:00"
    );
    expect(datum[getPLevelRangeKey(10, 90)]).toEqual([5, 15]);
    expect(datum.PROBABILISTIC_UPPER_BOUND).toBe(15);
  });

  test("the N-hour series is passed as a TimeSeries too", () => {
    const data = run(canonical({ nHourSeries: ts([[AFTER_BST, 42]]) }));
    expect(at(data, "2025-07-01T11:00").N_HOUR_FORECAST).toBe(42);
  });

  // A genuine zero is not a null point: it must survive as 0, not be dropped or coerced away.
  test("a genuine zero survives as 0, not as absent", () => {
    const data = run(
      canonical({ generationSeries: [{ key: "GENERATION", series: ts([[BEFORE_BST, 0]]) }] })
    );
    const datum = at(data, "2025-07-01T10:00");
    expect(datum.GENERATION).toBe(0);
    expect("GENERATION" in datum).toBe(true);
  });
});

describe("B6: the useMemo dependency array omits delta and gsp", () => {
  /*
   * Known bug, deliberately NOT fixed here (Phase 4 owns it). `delta` and `gsp` are read inside
   * the memo but missing from its deps, so changing either alone leaves the previously computed
   * dataset on screen. The tests below assert the STALE result on purpose.
   *
   * WHEN B6 IS FIXED: invert every `toBe(false)` / `toBeUndefined()` in this block to the fresh
   * value. That is the intended failure — this block failing means the fix landed, not that
   * something regressed.
   */
  // Hoisted so their object identity is stable across rerenders: the whole point of this block
  // is to prove the memo does NOT re-run when only `delta`/`gsp` change, and a fresh `ts(...)`
  // call on every `stableProps()` invocation would give every prop a new identity regardless,
  // masking the bug instead of pinning it.
  const stableForecastSeries = ts([[AFTER_BST, 100]]);
  const stableGenerationSeries = [
    { key: "GENERATION_UPDATED", series: ts([[AFTER_BST, 1000]]) },
    { key: "GENERATION", series: ts([[AFTER_BST, 2000]]) }
  ];
  const stableProps = (overrides: Partial<Props> = {}): Props => ({
    forecastSeries: stableForecastSeries,
    generationSeries: stableGenerationSeries,
    timeTrigger: "tick",
    ...overrides
  });

  test("turning delta on does not update the output (stale)", () => {
    const view = render(stableProps({ delta: false }));
    view.rerender(stableProps({ delta: true }));
    expect(view.result.current[0].DELTA).toBeUndefined();
  });

  test("switching gsp on does not drop the seasonal keys (stale)", () => {
    const view = render(stableProps({ gsp: false }));
    expect(view.result.current[0].SEASONAL_MEAN).toBeDefined();
    view.rerender(stableProps({ gsp: true }));
    expect(view.result.current[0].SEASONAL_MEAN).toBeDefined();
  });

  test("a dep that IS in the array (forecastSeries) does force a recompute, proving the harness works", () => {
    const view = render(stableProps());
    const before = view.result.current;
    view.rerender(
      stableProps({
        forecastSeries: ts([[AFTER_BST, 999]]),
        delta: true
      })
    );
    expect(view.result.current).not.toBe(before);
    expect(view.result.current[0].FORECAST).toBe(999);
    // and the previously-ignored `delta` is picked up as a side effect of the recompute, which
    // is what makes B6 intermittent rather than reliably broken.
    expect(view.result.current[0].DELTA).toBeDefined();
  });
});
