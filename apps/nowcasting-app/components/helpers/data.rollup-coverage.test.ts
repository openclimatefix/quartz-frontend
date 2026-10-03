/**
 * `rollUpRegionValues` while the newest slot is partly published (review finding D3).
 *
 * Seen for real in the `gb-gsp-generation-snapshot-partial.json` fixture: 127 of 336 regions had
 * an actual. Everything that sets actual against forecast must be summed over one member set,
 * the members that have both, or a group that is on forecast reads as far under it.
 */
import { describe, expect, test } from "@jest/globals";
import { rollUpRegionValues, type MapRegionValue } from "./data";

const member = (name: string, actual: number | null): MapRegionValue =>
  ({
    featureId: name,
    regionName: name,
    dataState: "value",
    power: 100,
    normalized: 0.5,
    capacity: 200,
    actual,
    delta: actual === null ? 0 : actual - 100,
    deltaNormalized: actual === null ? 0 : (actual - 100) / 200,
    deltaBucket: 0,
    deltaBucketNormalized: 0,
    hasDelta: actual !== null,
    label: name
  } as MapRegionValue);

const rollUp = (members: MapRegionValue[]) =>
  rollUpRegionValues(new Map(members.map((m) => [m.regionName, m])), {
    DNO: members.map((m) => m.regionName)
  }).get("DNO")!;

describe("rollUpRegionValues compares actual and forecast over one member set", () => {
  test("a group on forecast with half its actuals published compares equal", () => {
    // a: on forecast, actual published. b: forecast published, actual not yet.
    const rolled = rollUp([member("a", 100), member("b", null)]);

    expect(rolled.comparedActual).toBe(rolled.comparedForecast);
    expect(rolled.comparedActual).toBe(100);
    expect(rolled.membersCompared).toBe(1);
    expect(rolled.membersTotal).toBe(2);
    // The Forecast map encoding is still the whole group's forecast.
    expect(rolled.power).toBe(200);
  });

  test("the normalised delta divides by the capacity of the compared members only", () => {
    // a: 50 MW over forecast on 200 MW of capacity; b: no actual yet.
    const rolled = rollUp([member("a", 150), member("b", null)]);

    expect(rolled.delta).toBe(50);
    expect(rolled.deltaNormalized).toBeCloseTo(0.25, 6);
    expect(rolled.comparedCapacity).toBe(200);
    // The same delta on a single fully-reporting region of the same size: same strength.
    expect(rolled.deltaNormalized).toBeCloseTo(member("x", 150).deltaNormalized, 6);
  });

  test("full coverage leaves the comparison equal to the whole-group sums", () => {
    const rolled = rollUp([member("a", 150), member("b", 80)]);

    expect(rolled.membersCompared).toBe(rolled.membersTotal);
    expect(rolled.comparedActual).toBe(rolled.actual);
    expect(rolled.comparedForecast).toBe(rolled.power);
    expect(rolled.comparedCapacity).toBe(rolled.capacity);
    expect(rolled.deltaNormalized).toBeCloseTo(30 / 400, 6);
  });

  test("a group with no member reporting an actual has no comparison, never a zero", () => {
    const rolled = rollUp([member("a", null), member("b", null)]);

    expect(rolled.actual).toBeNull();
    expect(rolled.comparedActual).toBeNull();
    expect(rolled.comparedForecast).toBeNull();
    expect(rolled.hasDelta).toBe(false);
    expect(rolled.membersCompared).toBe(0);
    expect(rolled.membersTotal).toBe(2);
  });
});
