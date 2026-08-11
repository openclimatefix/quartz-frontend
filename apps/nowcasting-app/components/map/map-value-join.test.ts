/**
 * The map's value join, tested as pure functions.
 *
 * Nothing here touches geometry and nothing here touches the network — and since Phase 5 that
 * is a property of the module rather than of this suite: `components/helpers/data.ts` no
 * longer loads anything at all, so importing it costs nothing. What this pins is the part the
 * old pipeline got wrong:
 *
 *  - the join is a key lookup into `RegionSeries.regions`, not a `.find()` per region;
 *  - `unpublished`, `no-data` and `value` stay three different answers, and a genuine 0 is a
 *    value (audit B8's bug class);
 *  - a rollup over GB's DNO groupings double-counts, because those groupings are not a
 *    partition — pinned deliberately, and Phase 5 reproduced it rather than fixing it while
 *    the question sits with the API owner.
 */
import { describe, expect, jest, test } from "@jest/globals";

jest.mock("next/router", () => ({ __esModule: true, default: { push: jest.fn() } }));
jest.mock("@sentry/nextjs", () => ({ __esModule: true, captureException: jest.fn() }));
jest.mock("@auth0/nextjs-auth0/client", () => ({
  __esModule: true,
  useUser: () => ({ user: null, isLoading: false, error: undefined })
}));

import gbGspForecastPeriod from "../../lib/api/v1/__fixtures__/gb-gsp-forecasts-period.json";
import gbRegionsGsp from "../../lib/api/v1/__fixtures__/gb-regions-gsp.json";
import { normaliseForecastMatrix, normaliseRegions } from "../../lib/domain/normalise";
import type { Region, RegionSeries } from "../../lib/domain/types";
import { DELTA_BUCKET } from "../../constant";
import {
  buildMapFeatureStates,
  buildRegionBridge,
  buildRegionValues,
  regionSeriesSnapshotAt,
  rollUpRegionValues,
  timeIndexOf,
  utcMinuteKey
} from "../helpers/data";
import { ActiveUnit } from "./types";
import type { AggregationLevel } from "../helpers/aggregationLevels";
import { theme } from "../../tailwind.config";
import {
  NO_DATA_COLOR,
  NO_DATA_OPACITY,
  deltaFillColorExpression,
  fillColorExpression,
  fillOpacityExpression
} from "./feature-state";

const TIMES = ["2026-08-04T00:00:00Z", "2026-08-04T00:30:00Z", "2026-08-04T01:00:00Z"];

/** A stand-in for the levels `deriveAggregationLevels` produces. Only `derived` is read here. */
const aggregationLevel = (regionType: string, derived = false): AggregationLevel => ({
  regionType,
  level: derived ? 5 : 10,
  label: regionType,
  minZoom: 0,
  maxZoom: 14,
  derived
});
const GSP_LEVEL = aggregationLevel("gsp");

const region = (name: string, over: Partial<Region> = {}): Region => ({
  name,
  label: name.toUpperCase(),
  regionType: "gsp",
  capacityMw: 100,
  centroid: null,
  metadata: {},
  ...over
});

const series = (regions: Record<string, (number | null)[]>, capacityMw = 100): RegionSeries => ({
  times: TIMES,
  regions: Object.fromEntries(
    Object.entries(regions).map(([name, powerMw]) => [
      name,
      { regionName: name, capacityMw, powerMw }
    ])
  ),
  cacheUpdatedUtc: null
});

describe("time axis join", () => {
  test("utcMinuteKey treats an offset-free instant as UTC and drops seconds", () => {
    expect(utcMinuteKey("2026-08-04T00:30:00Z")).toBe("2026-08-04T00:30");
    expect(utcMinuteKey("2026-08-04T00:30")).toBe("2026-08-04T00:30");
    expect(utcMinuteKey("2026-08-04T01:30:00+01:00")).toBe("2026-08-04T00:30");
  });

  test("utcMinuteKey returns an empty key rather than throwing on rubbish", () => {
    expect(utcMinuteKey("not a time")).toBe("");
    expect(timeIndexOf(TIMES, "not a time")).toBe(-1);
  });

  test("timeIndexOf resolves the slot once for the whole series", () => {
    expect(timeIndexOf(TIMES, "2026-08-04T00:30:00Z")).toBe(1);
    expect(timeIndexOf(TIMES, "2026-08-04T02:00:00Z")).toBe(-1);
    expect(timeIndexOf(undefined, "2026-08-04T00:30:00Z")).toBe(-1);
  });
});

describe("regionSeriesSnapshotAt — absent, null and zero stay three different answers", () => {
  const withHoles = series({ present: [0, 5, 10], reportedNothing: [null, null, null] });

  test("a region present with 0 is a value, not a hole", () => {
    const snapshot = regionSeriesSnapshotAt(withHoles, TIMES[0]);
    expect(snapshot?.regions.present.powerMw).toBe(0);
  });

  test("a region present with null is carried through as null", () => {
    const snapshot = regionSeriesSnapshotAt(withHoles, TIMES[0]);
    expect(snapshot?.regions.reportedNothing.powerMw).toBeNull();
  });

  test("a region absent from the payload stays absent", () => {
    const snapshot = regionSeriesSnapshotAt(withHoles, TIMES[0]);
    expect(Object.keys(snapshot?.regions ?? {})).toEqual(["present", "reportedNothing"]);
    expect(snapshot?.regions.neverHeardOf).toBeUndefined();
  });

  test("a time outside the fetched window publishes nothing rather than inventing nulls", () => {
    const snapshot = regionSeriesSnapshotAt(withHoles, "2026-08-04T09:00:00Z");
    expect(snapshot?.regions).toEqual({});
  });
});

describe("buildRegionValues", () => {
  const regions = [region("aaaa_1"), region("bbbb_1"), region("cccc_1")];

  const values = (targetTime: string, timeNow: string) =>
    buildRegionValues({
      regions,
      // cccc_1 is absent from both payloads: it has not published this slot.
      forecast: series({ aaaa_1: [0, 40, 80], bbbb_1: [null, null, null] }),
      generation: series({ aaaa_1: [0, 30, 90], bbbb_1: [10, 10, 10] }),
      targetTime,
      timeNow
    });

  test("a genuine overnight zero renders as a value, not as missing", () => {
    const value = values(TIMES[0], TIMES[2])!.get("aaaa_1")!;
    expect(value.dataState).toBe("value");
    expect(value.power).toBe(0);
    expect(value.normalized).toBe(0);
  });

  test("a region reporting null is no-data, distinct from one that has not published", () => {
    const result = values(TIMES[0], TIMES[2])!;
    expect(result.get("bbbb_1")!.dataState).toBe("no-data");
    expect(result.get("cccc_1")!.dataState).toBe("unpublished");
  });

  test("capacity is carried even where no value has published", () => {
    expect(values(TIMES[0], TIMES[2])!.get("cccc_1")!.capacity).toBe(100);
  });

  test("normalized is power over capacity, in MW throughout", () => {
    const value = values(TIMES[1], TIMES[2])!.get("aaaa_1")!;
    expect(value.power).toBe(40);
    expect(value.normalized).toBeCloseTo(0.4, 6);
  });

  test("a delta of exactly zero from two real readings is still a delta", () => {
    // Both sides are 0 at midnight. The v0 path read `!yield` as "no reading" and suppressed
    // the delta; here `hasDelta` is true and the delta is a real 0.
    const value = values(TIMES[0], TIMES[2])!.get("aaaa_1")!;
    expect(value.hasDelta).toBe(true);
    expect(value.delta).toBe(0);
    expect(value.deltaBucket).toBe(DELTA_BUCKET.ZERO);
  });

  test("generation minus forecast, signed the way the delta legend reads", () => {
    const value = values(TIMES[1], TIMES[2])!.get("aaaa_1")!;
    expect(value.delta).toBe(-10);
    expect(value.actual).toBe(30);
  });

  test("a slot at or after now has no delta, which is not a delta of zero", () => {
    const value = values(TIMES[2], TIMES[2])!.get("aaaa_1")!;
    expect(value.hasDelta).toBe(false);
    expect(value.delta).toBe(0);
  });

  test("a region with no generation reading has no delta", () => {
    const value = values(TIMES[0], TIMES[2])!.get("bbbb_1")!;
    expect(value.hasDelta).toBe(false);
  });

  test("the label is displayed, never the raw region code", () => {
    expect(values(TIMES[0], TIMES[2])!.get("aaaa_1")!.label).toBe("AAAA_1");
  });
});

/**
 * The bridge survived Phase 5, narrowed to id translation alone.
 *
 * `byGspCode` is gone: the geometry join is no longer a hardcoded case fold on
 * `properties.GSPs` but a name join driven by the registry's `joinProperty`/`joinTransform`,
 * which is what lets a country without GSPs draw at all. What is left is the numeric id,
 * which two things outside the groupings still need — see the doc comment on `RegionBridge`.
 */
describe("buildRegionBridge — the numeric-id bridge", () => {
  const regions = [
    region("citr_1", { metadata: { gsp_id: 67, full_name: "City Road" } }),
    region("chap", { metadata: { gsp_id: 5 } }),
    region("nogspid", { metadata: {} })
  ];

  test("gsp_id maps both ways, and a region without one is simply absent", () => {
    const bridge = buildRegionBridge(regions);
    expect(bridge.gspIdFor("citr_1")).toBe(67);
    expect(bridge.byGspId.get(5)?.name).toBe("chap");
    expect(bridge.gspIdFor("nogspid")).toBeUndefined();
  });

  test("the real GB region list carries a gsp_id for every region", () => {
    const bridge = buildRegionBridge(normaliseRegions(gbRegionsGsp as never));
    expect(bridge.byName.size).toBe(338);
    expect(bridge.byGspId.size).toBe(338);
    expect(bridge.byName.get("citr_1")?.label).toBe("City Road");
  });
});

describe("rollUpRegionValues", () => {
  const regions = [
    region("a", { metadata: { gsp_id: 1 }, capacityMw: 100 }),
    region("b", { metadata: { gsp_id: 2 }, capacityMw: 200 }),
    region("c", { metadata: { gsp_id: 3 }, capacityMw: 300 })
  ];
  const values = buildRegionValues({
    regions,
    forecast: series({ a: [10, 10, 10], b: [20, 20, 20], c: [null, null, null] }),
    generation: series({ a: [5, 5, 5], b: [5, 5, 5] }),
    targetTime: TIMES[0],
    timeNow: TIMES[2]
  });

  test("a grouping sums power and capacity over its members", () => {
    const rolled = rollUpRegionValues(values, { North: ["a", "b"] });
    expect(rolled.get("North")!.power).toBe(30);
    expect(rolled.get("North")!.capacity).toBe(300);
    expect(rolled.get("North")!.normalized).toBeCloseTo(0.1, 6);
  });

  test("a partly-published grouping is still a value, not a hole", () => {
    const rolled = rollUpRegionValues(values, { Mixed: ["a", "c"] });
    expect(rolled.get("Mixed")!.dataState).toBe("value");
    expect(rolled.get("Mixed")!.power).toBe(10);
  });

  test("a grouping whose members all reported nothing is no-data", () => {
    const rolled = rollUpRegionValues(values, { Empty: ["c"] });
    expect(rolled.get("Empty")!.dataState).toBe("no-data");
  });

  test("a grouping with no known members at all is unpublished", () => {
    const rolled = rollUpRegionValues(values, { Unknown: ["nosuchregion"] });
    expect(rolled.get("Unknown")!.dataState).toBe("unpublished");
  });

  // CHARACTERISATION: GB's DNO groupings are not a partition — 15 GSPs appear in two
  // groupings each — so a GSP counted twice within one grouping (or across two) is summed
  // twice, in both power and capacity. Phase 5 regenerated the grouping files name-keyed and
  // reproduced the duplication exactly: the API owner has not answered whether a GSP feeding
  // two licence areas should be counted in both or apportioned, so there is no number to
  // choose. De-duplicating here would change published DNO figures without anyone deciding to.
  test("a GSP listed twice in a grouping is counted twice", () => {
    const rolled = rollUpRegionValues(values, { Double: ["a", "a"] });
    expect(rolled.get("Double")!.power).toBe(20);
    expect(rolled.get("Double")!.capacity).toBe(200);
  });

  test("deltas roll up too, and a group with no computable member has none", () => {
    const rolled = rollUpRegionValues(values, { North: ["a", "b"] });
    expect(rolled.get("North")!.hasDelta).toBe(true);
    expect(rolled.get("North")!.delta).toBe(-20);
    expect(rollUpRegionValues(values, { Empty: ["c"] }).get("Empty")!.hasDelta).toBe(false);
  });
});

describe("buildMapFeatureStates against the recorded GB fixtures", () => {
  const regions = normaliseRegions(gbRegionsGsp as never);
  const forecast = normaliseForecastMatrix(gbGspForecastPeriod as never);

  test("GSP level keys feature state by the numeric gsp id the geometry promotes", () => {
    const states = buildMapFeatureStates(GSP_LEVEL, {
      regions,
      forecast,
      generation: undefined,
      targetTime: forecast.times[20],
      timeNow: forecast.times[47]
    });
    // City Road is gsp_id 67 and 1.538 MW at index 20 (1538 kW on the wire).
    expect(states.size).toBe(338);
    const cityRoad = states.get(67)!;
    expect(cityRoad.label).toBe("City Road");
    expect(cityRoad.dataState).toBe("value");
    expect(cityRoad.power).toBeCloseTo(1.538, 6);
    expect(cityRoad.capacity).toBeCloseTo(3.982, 6);
  });

  // The recorded fixture carries 5 of the 338 regions, which is exactly the shape the
  // distinction exists for: the 5 that published a genuine overnight 0 must read as values,
  // and the 333 that are simply not in the payload must read as unpublished — not as zeros.
  test("an overnight zero is a value; a region absent from the payload is not", () => {
    const states = buildMapFeatureStates(GSP_LEVEL, {
      regions,
      forecast,
      generation: undefined,
      targetTime: forecast.times[0],
      timeNow: forecast.times[47]
    });
    const overnight = [...states.values()];
    const published = overnight.filter((state) => state.dataState === "value");
    expect(published).toHaveLength(5);
    expect(published.every((state) => state.power === 0)).toBe(true);
    expect(overnight.filter((state) => state.dataState === "unpublished")).toHaveLength(333);
    expect(overnight.filter((state) => state.dataState === "no-data")).toHaveLength(0);
  });

  test("with no generation loaded there is no delta anywhere", () => {
    const states = buildMapFeatureStates(GSP_LEVEL, {
      regions,
      forecast,
      generation: undefined,
      targetTime: forecast.times[20],
      timeNow: forecast.times[47]
    });
    expect([...states.values()].some((state) => state.hasDelta)).toBe(false);
  });
});

/**
 * The three states have to be *visibly* three states, which lives in the paint expressions
 * rather than in the data. Mapbox's own expression evaluator is not reachable from jsdom, so
 * the handful of operators used here are evaluated directly — enough to prove that
 * "unpublished", "no-data" and a genuine 0 produce three different pixels.
 */
const evaluate = (expression: unknown, state: Record<string, unknown>): unknown => {
  if (!Array.isArray(expression)) return expression;
  const [operator, ...args] = expression as [string, ...unknown[]];
  switch (operator) {
    case "feature-state":
      return state[args[0] as string];
    case "coalesce":
      for (const arg of args) {
        const value = evaluate(arg, state);
        if (value !== undefined && value !== null) return value;
      }
      return undefined;
    case "==":
      return evaluate(args[0], state) === evaluate(args[1], state);
    case "!=":
      return evaluate(args[0], state) !== evaluate(args[1], state);
    case "case": {
      for (let i = 0; i + 1 < args.length; i += 2) {
        if (evaluate(args[i], state)) return evaluate(args[i + 1], state);
      }
      return evaluate(args[args.length - 1], state);
    }
    case "step": {
      const input = Number(evaluate(args[0], state));
      let output = evaluate(args[1], state);
      for (let i = 2; i + 1 < args.length; i += 2) {
        if (input >= Number(args[i])) output = evaluate(args[i + 1], state);
      }
      return output;
    }
    default:
      return expression;
  }
};

describe("paint expressions render the three states distinctly", () => {
  const base = { power: 0, normalized: 0, capacity: 100, deltaBucket: 0, hasDelta: false };
  const unpublished = { ...base, dataState: "unpublished" };
  const noData = { ...base, dataState: "no-data" };
  const genuineZero = { ...base, dataState: "value" };
  const generating = { ...base, dataState: "value", power: 300, normalized: 0.6 };

  // Grouped-ness moved from an argument into feature state in Phase 6 Track F: the map draws
  // several countries at once and each is on its own level, so one expression has to serve a
  // GB DNO rollup and an NL province in the same frame. Absent flag = region-level bands.
  const opacity = fillOpacityExpression(ActiveUnit.MW);
  const colour = fillColorExpression(ActiveUnit.MW);

  test("a genuine zero is faint but drawn; unpublished is not drawn at all", () => {
    expect(evaluate(opacity, genuineZero)).toBe(0.03);
    expect(evaluate(opacity, unpublished)).toBe(0);
  });

  test("no-data has its own opacity and its own colour", () => {
    expect(evaluate(opacity, noData)).toBe(NO_DATA_OPACITY);
    expect(evaluate(colour, noData)).toBe(NO_DATA_COLOR);
    expect(evaluate(colour, genuineZero)).not.toBe(NO_DATA_COLOR);
  });

  test("the MW bands match the labels ColorGuideBar draws", () => {
    expect(evaluate(opacity, { ...base, dataState: "value", power: 49 })).toBe(0.03);
    expect(evaluate(opacity, { ...base, dataState: "value", power: 50 })).toBe(0.2);
    expect(evaluate(opacity, generating)).toBe(0.6);
    expect(evaluate(opacity, { ...base, dataState: "value", power: 999 })).toBe(1);
  });

  test("grouped levels use the ten-times bands the zone/DNO legend shows", () => {
    expect(evaluate(opacity, { ...base, dataState: "value", power: 300, grouped: true })).toBe(
      0.03
    );
    expect(evaluate(opacity, { ...base, dataState: "value", power: 3000, grouped: true })).toBe(
      0.6
    );
  });

  test("one expression bands a grouped and an ungrouped feature differently in the same frame", () => {
    // The reason grouped-ness became feature state: GB on its DNO rollup and NL on provinces
    // are drawn by the same paint expression, and 300 MW means different things to each.
    const value = { ...base, dataState: "value", power: 300 };
    expect(evaluate(opacity, { ...value, grouped: true })).toBe(0.03);
    expect(evaluate(opacity, { ...value, grouped: false })).toBe(0.6);
  });

  test("percentage mode reproduces getOpacityValueFromPVNormalized's table", () => {
    const percentage = fillOpacityExpression(ActiveUnit.percentage);
    expect(evaluate(percentage, { ...base, dataState: "value", normalized: 0 })).toBe(0.03);
    expect(evaluate(percentage, { ...base, dataState: "value", normalized: 0.36 })).toBe(0.6);
    expect(evaluate(percentage, { ...base, dataState: "value", normalized: 0.9 })).toBe(1);
  });

  test("capacity mode is not gated on dataState — capacity is known regardless", () => {
    const capacity = fillOpacityExpression(ActiveUnit.capacity);
    expect(evaluate(capacity, { ...unpublished, capacity: 300 })).toBe(0.6);
  });

  test("no computable delta draws nothing rather than the zero-bucket colour", () => {
    const deltaColour = deltaFillColorExpression();
    expect(evaluate(deltaColour, { ...base, hasDelta: false, deltaBucket: 0 })).toBe("transparent");
    expect(evaluate(deltaColour, { ...base, hasDelta: true, deltaBucket: 0 })).toBe("transparent");
    expect(evaluate(deltaColour, { ...base, hasDelta: true, deltaBucket: DELTA_BUCKET.POS2 })).toBe(
      theme.extend.colors["ocf-delta"][700]
    );
    expect(evaluate(deltaColour, { ...base, hasDelta: true, deltaBucket: DELTA_BUCKET.NEG4 })).toBe(
      theme.extend.colors["ocf-delta"][200]
    );
  });
});
