/**
 * Characterisation tests for `useFormatChartData` — the hook that assembles the national/GSP
 * chart dataset out of six forecast series, two truth series, p-levels and seasonal norms.
 *
 * These pin CURRENT behaviour, bugs included, because Phase 4 rewrites the pipeline onto the v1
 * data layer and the only safe definition of "the same chart" is "the same numbers out". Where a
 * pinned behaviour is wrong, it carries a `// CHARACTERISATION:` comment saying what it should be;
 * those assertions are expected to be inverted deliberately, not to fail by surprise.
 *
 * Two things dominate:
 *  - the past/future split, which depends on the wall clock, so time is frozen via Luxon's
 *    `Settings.now` (the only clock `get30MinNow` reads);
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
import nationalMetrics from "../../data/national_metrics.json";

// Duplicated from the hook on purpose: if the module's constant changes, these tests should fail
// rather than silently follow it.
const NATIONAL_CAPACITY = 21504.629;

// Frozen "now". 10:12Z rounds up to the 10:30 slot, so the past/future boundary is 10:30:00Z.
// 1 July is BST, which is what makes the settlement-period assertions load-bearing.
const NOW_BST = "2025-07-01T10:12:00.000Z";
const BOUNDARY_BST = "2025-07-01T10:30:00+00:00";
const BEFORE_BST = "2025-07-01T10:00:00+00:00";
const AFTER_BST = "2025-07-01T11:00:00+00:00";

const freeze = (iso: string) => {
  const fixed = DateTime.fromISO(iso, { zone: "utc" }).toMillis();
  Settings.now = () => fixed;
};

type Props = Parameters<typeof useFormatChartData>[0];

const render = (props: Props) =>
  renderHook((p: Props) => useFormatChartData(p), { initialProps: props });

const run = (props: Props): ChartData[] => render(props).result.current;

// The three arguments the guard requires, in their most boring possible form.
const baseProps = (overrides: Partial<Props> = {}): Props => ({
  forecastData: [],
  pvRealDayAfterData: [],
  pvRealDayInData: [],
  timeTrigger: "tick",
  ...overrides
});

const fc = (targetTime: string, mw: number, plevels?: Record<string, number>) =>
  ({ targetTime, expectedPowerGenerationMegawatts: mw, ...(plevels ? { plevels } : {}) } as any);

const pv = (datetimeUtc: string, kw: number | null | undefined) =>
  ({ datetimeUtc, solarGenerationKw: kw } as any);

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
});

afterEach(() => {
  Settings.now = () => Date.now();
});

describe("the guard", () => {
  test("returns [] unless forecastData, both truth series and timeTrigger are all present", () => {
    expect(run(baseProps())).toEqual([]);
    for (const missing of [
      "forecastData",
      "pvRealDayAfterData",
      "pvRealDayInData",
      "timeTrigger"
    ] as const) {
      const props = baseProps({ forecastData: [fc(AFTER_BST, 100)] });
      delete (props as any)[missing];
      expect(run(props)).toEqual([]);
    }
  });

  // Empty arrays are truthy, so "no data yet" and "data, but none of it" are the same input here
  // and the guard lets the empty case through to produce an empty chart.
  test("empty-but-present arrays pass the guard and produce an empty dataset", () => {
    expect(run(baseProps())).toEqual([]);
  });
});

describe("past/future forecast split", () => {
  test("a targetTime after now is FORECAST only", () => {
    const datum = at(run(baseProps({ forecastData: [fc(AFTER_BST, 123)] })), "2025-07-01T11:00");
    expect(datum.FORECAST).toBe(123);
    expect(datum.PAST_FORECAST).toBeUndefined();
  });

  test("a targetTime before now is PAST_FORECAST only", () => {
    const datum = at(run(baseProps({ forecastData: [fc(BEFORE_BST, 77)] })), "2025-07-01T10:00");
    expect(datum.PAST_FORECAST).toBe(77);
    expect(datum.FORECAST).toBeUndefined();
  });

  // The boundary slot is deliberately written to BOTH series so the past and future lines join up
  // on the chart instead of leaving a one-slot gap. This is the case that breaks whenever the
  // rounding of "now" changes, so it is pinned hard.
  test("a targetTime EXACTLY equal to now is written to both FORECAST and PAST_FORECAST", () => {
    const datum = at(run(baseProps({ forecastData: [fc(BOUNDARY_BST, 55)] })), "2025-07-01T10:30");
    expect(datum.FORECAST).toBe(55);
    expect(datum.PAST_FORECAST).toBe(55);
    expect(datum.FORECAST).toBe(datum.PAST_FORECAST);
  });

  // "now" is the 30-minute slot at or after the real clock (10:12 -> 10:30), so a target time
  // that is genuinely still in the future by the wall clock is nonetheless plotted as PAST.
  test("the boundary is the rounded-up 30-minute slot, not the raw clock", () => {
    const data = run(
      baseProps({
        forecastData: [fc("2025-07-01T10:15:00+00:00", 1), fc("2025-07-01T10:29:00+00:00", 2)]
      })
    );
    expect(at(data, "2025-07-01T10:15").PAST_FORECAST).toBe(1);
    expect(at(data, "2025-07-01T10:15").FORECAST).toBeUndefined();
    expect(at(data, "2025-07-01T10:29").PAST_FORECAST).toBe(2);
    expect(at(data, "2025-07-01T10:29").FORECAST).toBeUndefined();
  });

  test("equality is instant-based, so a different ISO spelling of the boundary still splits both ways", () => {
    const datum = at(
      run(baseProps({ forecastData: [fc("2025-07-01T11:30:00+01:00", 9)] })),
      "2025-07-01T11:30"
    );
    expect(datum.FORECAST).toBe(9);
    expect(datum.PAST_FORECAST).toBe(9);
  });
});

describe("the N-hour series", () => {
  test("fourHourData produces N_HOUR_FORECAST / N_HOUR_PAST_FORECAST, both at the boundary", () => {
    const data = run(
      baseProps({
        fourHourData: [fc(BEFORE_BST, 10), fc(BOUNDARY_BST, 20), fc(AFTER_BST, 30)]
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
    const fourHourData = [fc(AFTER_BST, 42)];
    const view = render(baseProps({ fourHourData }));
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
      run(baseProps({ forecastData: [fc(AFTER_BST, 100)], fourHourData: [fc(AFTER_BST, 5)] })),
      "2025-07-01T11:00"
    );
    expect(datum.FORECAST).toBe(5);
    expect(datum.N_HOUR_FORECAST).toBeUndefined();
  });

  // fourHourData is merged AFTER the settlement-period / seasonal loop has already run over the
  // map's keys, so a timestamp that only the N-hour series knows about never gets them.
  // CHARACTERISATION: current behaviour is wrong — every row should carry SETTLEMENT_PERIOD and,
  // for national, the seasonal norms, regardless of which series introduced the timestamp.
  test("a timestamp only present in fourHourData gets no SETTLEMENT_PERIOD and no seasonal norms", () => {
    const data = run(
      baseProps({
        forecastData: [fc(AFTER_BST, 100)],
        fourHourData: [fc(AFTER_BST, 90), fc("2025-07-01T12:00:00+00:00", 80)]
      })
    );
    expect(at(data, "2025-07-01T11:00").SETTLEMENT_PERIOD).toBe(25); // 12:00 London
    const orphan = at(data, "2025-07-01T12:00");
    expect(orphan.N_HOUR_FORECAST).toBe(80);
    expect(orphan.SETTLEMENT_PERIOD).toBeUndefined();
    expect(orphan.SEASONAL_MEAN).toBeUndefined();
  });
});

describe("the merge", () => {
  test("timestamps present in only some series merge into one row per timestamp", () => {
    const data = run(
      baseProps({
        pvRealDayAfterData: [pv(BEFORE_BST, 1000)],
        pvRealDayInData: [pv(BEFORE_BST, 2000), pv("2025-07-01T09:30:00+00:00", 3000)],
        forecastData: [fc(BEFORE_BST, 50), fc(AFTER_BST, 60)]
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

  test("row order follows first-write order: day-after truth, day-in truth, forecast, models", () => {
    const data = run(
      baseProps({
        pvRealDayAfterData: [pv("2025-07-01T09:00:00+00:00", 1000)],
        pvRealDayInData: [pv("2025-07-01T08:00:00+00:00", 1000)],
        forecastData: [fc("2025-07-01T07:00:00+00:00", 1)],
        nationalSatOnly: [fc("2025-07-01T06:00:00+00:00", 1)]
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
        pvRealDayAfterData: [pv(BEFORE_BST, 1000)],
        forecastData: [fc(BEFORE_BST, 50)]
      })
    );
    expect(data).toHaveLength(1);
    expect(data[0].formattedDate).toBe("2025-07-01T10:00");
  });

  // The merge key is the RAW datetime string, not a normalised instant. Every current producer
  // emits "+00:00", so this does not bite today — but it is exactly the assumption a v1 client
  // that emits "Z" (or seconds-less timestamps) would break, and the failure mode is silent:
  // two rows, same formattedDate, each holding half the series.
  // CHARACTERISATION: current behaviour is wrong — the map should be keyed on the parsed instant
  // (or a normalised ISO string), so equivalent spellings merge.
  test("two spellings of the same instant do NOT merge, and produce duplicate formattedDates", () => {
    const data = run(
      baseProps({
        pvRealDayAfterData: [pv("2025-07-01T10:00:00Z", 1000)],
        forecastData: [fc("2025-07-01T10:00:00+00:00", 50)]
      })
    );
    expect(data).toHaveLength(2);
    expect(data.map((d) => d.formattedDate)).toEqual(["2025-07-01T10:00", "2025-07-01T10:00"]);
    expect(data[0].GENERATION_UPDATED).toBe(1);
    expect(data[0].PAST_FORECAST).toBeUndefined();
    expect(data[1].PAST_FORECAST).toBe(50);
  });

  test("a later series wins a key collision on the same timestamp", () => {
    // Both truth series write different keys, so collisions only happen within a series or
    // between the plain forecast and an N-hour series sharing a key (see the 0-hour case above).
    const data = run(
      baseProps({
        pvRealDayInData: [pv(BEFORE_BST, 1000), pv(BEFORE_BST, 4000)]
      })
    );
    expect(data).toHaveLength(1);
    expect(data[0].GENERATION).toBe(4);
  });
});

describe("kW to MW conversion", () => {
  test("GENERATION and GENERATION_UPDATED are divided by 1000", () => {
    const data = run(
      baseProps({
        pvRealDayAfterData: [pv(BEFORE_BST, 12345)],
        pvRealDayInData: [pv(BEFORE_BST, 1_000_000)]
      })
    );
    expect(at(data, "2025-07-01T10:00")).toMatchObject({
      GENERATION_UPDATED: 12.345,
      GENERATION: 1000
    });
  });

  test("a genuine zero survives as 0, not as absent", () => {
    const data = run(baseProps({ pvRealDayInData: [pv(BEFORE_BST, 0)] }));
    const datum = at(data, "2025-07-01T10:00");
    expect(datum.GENERATION).toBe(0);
    expect("GENERATION" in datum).toBe(true);
  });

  // CHARACTERISATION: current behaviour is wrong — `null / 1000` is 0, so a night-time gap or a
  // failed reading is plotted as a hard zero indistinguishable from a real zero. It should be
  // left undefined so the line breaks. (B8 is the same class of bug in the CSV export.)
  test("a null reading becomes 0 rather than being dropped", () => {
    const datum = at(
      run(baseProps({ pvRealDayInData: [pv(BEFORE_BST, null)] })),
      "2025-07-01T10:00"
    );
    expect(datum.GENERATION).toBe(0);
  });

  // CHARACTERISATION: current behaviour is wrong — an absent `solarGenerationKw` yields NaN,
  // which recharts renders as a gap but which also poisons getZoomYMax and any downstream sum.
  test("a missing reading becomes NaN", () => {
    const datum = at(
      run(baseProps({ pvRealDayInData: [pv(BEFORE_BST, undefined)] })),
      "2025-07-01T10:00"
    );
    expect(Number.isNaN(datum.GENERATION)).toBe(true);
  });
});

describe("the five extra model series", () => {
  const models: [keyof Props, string][] = [
    ["nationalIntradayECMWFOnlyData", "INTRADAY_ECMWF_ONLY"],
    ["nationalPvnetDayAhead", "PVNET_DAY_AHEAD"],
    ["nationalPvnetIntraday", "PVNET_INTRADAY"],
    ["nationalMetOfficeOnly", "MET_OFFICE_ONLY"],
    ["nationalSatOnly", "SAT_ONLY"]
  ];

  test.each(models)("%s produces %s / PAST_%s with the same boundary rule", (prop, key) => {
    const data = run(
      baseProps({
        [prop]: [fc(BEFORE_BST, 1), fc(BOUNDARY_BST, 2), fc(AFTER_BST, 3)]
      } as Partial<Props>)
    );
    expect(at(data, "2025-07-01T10:00")[`PAST_${key}`]).toBe(1);
    expect(at(data, "2025-07-01T10:00")[key]).toBeUndefined();
    expect(at(data, "2025-07-01T10:30")[key]).toBe(2);
    expect(at(data, "2025-07-01T10:30")[`PAST_${key}`]).toBe(2);
    expect(at(data, "2025-07-01T11:00")[key]).toBe(3);
    expect(at(data, "2025-07-01T11:00")[`PAST_${key}`]).toBeUndefined();
  });

  test("all five models merge onto the same timestamp as the main forecast and the truth series", () => {
    const series = [fc(AFTER_BST, 7)];
    const data = run(
      baseProps({
        forecastData: [fc(AFTER_BST, 100)],
        pvRealDayInData: [pv(AFTER_BST, 5000)],
        nationalIntradayECMWFOnlyData: series,
        nationalPvnetDayAhead: series,
        nationalPvnetIntraday: series,
        nationalMetOfficeOnly: series,
        nationalSatOnly: series
      })
    );
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      FORECAST: 100,
      GENERATION: 5,
      INTRADAY_ECMWF_ONLY: 7,
      PVNET_DAY_AHEAD: 7,
      PVNET_INTRADAY: 7,
      MET_OFFICE_ONLY: 7,
      SAT_ONLY: 7
    });
  });

  test("an undefined model series contributes nothing at all", () => {
    const data = run(baseProps({ forecastData: [fc(AFTER_BST, 100)], nationalSatOnly: undefined }));
    expect(Object.keys(data[0]).some((k) => k.includes("SAT_ONLY"))).toBe(false);
  });
});

describe("p-levels", () => {
  const plevels = {
    plevel_2: 2,
    plevel_10: 5,
    plevel_25: 8,
    plevel_75: 12,
    plevel_90: 15,
    plevel_98: 20
  };

  test("one range key per selected pair, and PROBABILISTIC_UPPER_BOUND is the widest upper bound", () => {
    act(() =>
      setGlobalState("pLevels", [
        [10, 90],
        [2, 98]
      ])
    );
    const datum = at(
      run(baseProps({ forecastData: [fc(AFTER_BST, 100, plevels)] })),
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
    const partial = { plevel_2: 2, plevel_10: 5, plevel_90: 15 }; // no plevel_98
    const datum = at(
      run(baseProps({ forecastData: [fc(AFTER_BST, 100, partial)] })),
      "2025-07-01T11:00"
    );
    expect(datum[getPLevelRangeKey(2, 98)]).toBeUndefined();
    expect(datum[getPLevelRangeKey(10, 90)]).toEqual([5, 15]);
    expect(datum.PROBABILISTIC_UPPER_BOUND).toBe(15);
  });

  test("if no selected pair is available, no probabilistic keys are written at all", () => {
    act(() => setGlobalState("pLevels", [[2, 98]]));
    const datum = at(
      run(baseProps({ forecastData: [fc(AFTER_BST, 100, { plevel_10: 5, plevel_90: 15 })] })),
      "2025-07-01T11:00"
    );
    expect(datum.PROBABILISTIC_UPPER_BOUND).toBeUndefined();
    expect(Object.keys(datum).some((k) => k.startsWith("PROBABILISTIC_RANGE"))).toBe(false);
  });

  test("an empty pLevels selection writes nothing, even when the payload has plevels", () => {
    act(() => setGlobalState("pLevels", []));
    const datum = at(
      run(baseProps({ forecastData: [fc(AFTER_BST, 100, plevels)] })),
      "2025-07-01T11:00"
    );
    expect(datum.PROBABILISTIC_UPPER_BOUND).toBeUndefined();
    expect(Object.keys(datum).some((k) => k.startsWith("PROBABILISTIC"))).toBe(false);
  });

  test("a forecast with no plevels object writes nothing", () => {
    const datum = at(run(baseProps({ forecastData: [fc(AFTER_BST, 100)] })), "2025-07-01T11:00");
    expect(Object.keys(datum).some((k) => k.startsWith("PROBABILISTIC"))).toBe(false);
  });

  test("p-levels are written for past forecasts too", () => {
    const datum = at(
      run(baseProps({ forecastData: [fc(BEFORE_BST, 100, plevels)] })),
      "2025-07-01T10:00"
    );
    expect(datum[getPLevelRangeKey(10, 90)]).toEqual([5, 15]);
  });
});

describe("settlement period vs UTC half-hour slot", () => {
  // The regression guard for B9. SETTLEMENT_PERIOD is counted from Europe/London midnight, the
  // seasonal norms are indexed by the UTC half-hour slot, and throughout BST the two answers are
  // two apart. If these ever collapse back into one call, this test fails.
  test("in BST the settlement period is two slots ahead of the UTC half-hour index", () => {
    const utcSlotIndex = 21; // 10:30 UTC
    const datum = at(run(baseProps({ forecastData: [fc(BOUNDARY_BST, 100)] })), "2025-07-01T10:30");
    expect(datum.SETTLEMENT_PERIOD).toBe(24); // 11:30 London
    expect(datum.SETTLEMENT_PERIOD - (utcSlotIndex + 1)).toBe(2);
    // and the seasonal value is the UTC slot's, not the settlement period's
    expect(datum.SEASONAL_MEAN).toBeCloseTo(
      nationalMetrics.data["7"]["1"].mean[utcSlotIndex] * NATIONAL_CAPACITY,
      6
    );
    expect(datum.SEASONAL_MEAN).not.toBeCloseTo(
      nationalMetrics.data["7"]["1"].mean[datum.SETTLEMENT_PERIOD - 1] * NATIONAL_CAPACITY,
      6
    );
  });

  test("in GMT the two agree (settlement period is the UTC slot index plus one)", () => {
    freeze("2025-01-15T10:12:00.000Z");
    const utcSlotIndex = 21;
    const datum = at(
      run(baseProps({ forecastData: [fc("2025-01-15T10:30:00+00:00", 100)] })),
      "2025-01-15T10:30"
    );
    expect(datum.SETTLEMENT_PERIOD).toBe(22);
    expect(datum.SETTLEMENT_PERIOD - (utcSlotIndex + 1)).toBe(0);
    expect(datum.SEASONAL_MEAN).toBeCloseTo(
      nationalMetrics.data["1"]["15"].mean[utcSlotIndex] * NATIONAL_CAPACITY,
      6
    );
  });

  test("settlement periods run 1-48 from London midnight", () => {
    const data = run(
      baseProps({
        forecastData: [
          fc("2025-01-15T00:00:00+00:00", 1),
          fc("2025-01-15T00:30:00+00:00", 1),
          fc("2025-01-15T23:30:00+00:00", 1)
        ]
      })
    );
    expect(data.map((d) => d.SETTLEMENT_PERIOD)).toEqual([1, 2, 48]);
  });
});

describe("seasonal norms", () => {
  // National only: the norms are a national-capacity-scaled dataset with no GSP equivalent.
  test("gsp: true skips all seasonal keys but still writes SETTLEMENT_PERIOD", () => {
    const datum = at(
      run(baseProps({ forecastData: [fc(BOUNDARY_BST, 100)], gsp: true })),
      "2025-07-01T10:30"
    );
    expect(datum.SETTLEMENT_PERIOD).toBe(24);
    expect(Object.keys(datum).some((k) => k.startsWith("SEASONAL"))).toBe(false);
  });

  test("national writes SEASONAL_MEAN, SEASONAL_BOUNDS and the per-quantile keys, capacity-scaled", () => {
    const slot = 21;
    const metrics = nationalMetrics.data["7"]["1"];
    const [p10, p90] = metrics.pLevels;
    const datum = at(run(baseProps({ forecastData: [fc(BOUNDARY_BST, 100)] })), "2025-07-01T10:30");
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
      run(baseProps({ forecastData: [fc("2025-01-15T10:30:00+00:00", 100)] })),
      "2025-01-15T10:30"
    );
    expect(datum.SEASONAL_MEAN).toBeCloseTo(0.1202 * NATIONAL_CAPACITY, 6);
    expect(datum.SEASONAL_P10).toBeCloseTo(0.0333 * NATIONAL_CAPACITY, 6);
    expect(datum.SEASONAL_P90).toBeCloseTo(0.2398 * NATIONAL_CAPACITY, 6);
  });

  test("the seasonal lookup is by the row's own date, not by today", () => {
    // "now" is 1 July; the row is 15 January, and must read January's norms.
    const datum = at(
      run(baseProps({ forecastData: [fc("2025-01-15T10:30:00+00:00", 100)] })),
      "2025-01-15T10:30"
    );
    expect(datum.SEASONAL_MEAN).toBeCloseTo(0.1202 * NATIONAL_CAPACITY, 6);
  });

  test("norms are scaled by the national capacity constant, so the ratio is the raw fraction", () => {
    const datum = at(run(baseProps({ forecastData: [fc(BOUNDARY_BST, 100)] })), "2025-07-01T10:30");
    expect(datum.SEASONAL_MEAN / NATIONAL_CAPACITY).toBeCloseTo(0.4283, 9);
  });
});

describe("delta mode", () => {
  test("delta is off by default: no DELTA or DELTA_BUCKET keys", () => {
    const datum = at(
      run(
        baseProps({
          forecastData: [fc(BEFORE_BST, 70)],
          pvRealDayInData: [pv(BEFORE_BST, 100_000)]
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
          forecastData: [fc(BEFORE_BST, 70)],
          pvRealDayAfterData: [pv(BEFORE_BST, 100_000)],
          pvRealDayInData: [pv(BEFORE_BST, 200_000)]
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
          forecastData: [fc(BEFORE_BST, 70)],
          pvRealDayInData: [pv(BEFORE_BST, 40_000)]
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
          forecastData: [fc(BOUNDARY_BST, 100)],
          fourHourData: [fc(BOUNDARY_BST, 60)]
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
          forecastData: [fc(AFTER_BST, 100)],
          fourHourData: [fc(AFTER_BST, 130)]
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
      run(baseProps({ delta: true, forecastData: [fc(AFTER_BST, 100)] })),
      "2025-07-01T11:00"
    );
    expect(noData.DELTA).toBe(0);
    expect(noData.DELTA_BUCKET).toBe(0);

    const genuineZero = at(
      run(
        baseProps({
          delta: true,
          forecastData: [fc(BEFORE_BST, 50)],
          pvRealDayInData: [pv(BEFORE_BST, 50_000)]
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
        pvRealDayInData: [pv(BEFORE_BST, 10_000)]
      })
    );
    expect(data[0].DELTA).toBe(0);
  });
});

describe("B6: the useMemo dependency array omits four inputs", () => {
  /*
   * Known bug, deliberately NOT fixed here (Phase 4 owns it). `nationalMetOfficeOnly`,
   * `nationalSatOnly`, `delta` and `gsp` are read inside the memo but missing from its deps, so
   * changing any of them alone leaves the previously computed dataset on screen. The tests below
   * assert the STALE result on purpose.
   *
   * WHEN B6 IS FIXED: invert every `toBe(false)` / `toBeUndefined()` in this block to the fresh
   * value. That is the intended failure — this block failing means the fix landed, not that
   * something regressed.
   */
  const stableForecast = [fc(AFTER_BST, 100)];
  const stableDayAfter = [pv(AFTER_BST, 1000)];
  const stableDayIn = [pv(AFTER_BST, 2000)];
  const stableProps = (overrides: Partial<Props> = {}): Props => ({
    forecastData: stableForecast,
    pvRealDayAfterData: stableDayAfter,
    pvRealDayInData: stableDayIn,
    timeTrigger: "tick",
    ...overrides
  });

  test("adding nationalSatOnly does not update the output (stale)", () => {
    const view = render(stableProps());
    const before = view.result.current;
    view.rerender(stableProps({ nationalSatOnly: [fc(AFTER_BST, 42)] }));
    expect(view.result.current).toBe(before); // same array instance: the memo never re-ran
    expect(view.result.current[0].SAT_ONLY).toBeUndefined();
  });

  test("adding nationalMetOfficeOnly does not update the output (stale)", () => {
    const view = render(stableProps());
    view.rerender(stableProps({ nationalMetOfficeOnly: [fc(AFTER_BST, 42)] }));
    expect((view.result.current[0] as Record<string, any>).MET_OFFICE_ONLY).toBeUndefined();
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

  test("a dep that IS in the array (forecastData) does force a recompute, proving the harness works", () => {
    const view = render(stableProps());
    const before = view.result.current;
    view.rerender(
      stableProps({
        forecastData: [fc(AFTER_BST, 999)],
        nationalSatOnly: [fc(AFTER_BST, 42)]
      })
    );
    expect(view.result.current).not.toBe(before);
    expect(view.result.current[0].FORECAST).toBe(999);
    // and the previously-ignored prop is picked up as a side effect of the recompute, which is
    // what makes B6 intermittent rather than reliably broken.
    expect((view.result.current[0] as Record<string, any>).SAT_ONLY).toBe(42);
  });
});
