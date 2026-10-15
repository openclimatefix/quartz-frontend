/**
 * The permanent reconciliation invariant for `rollUpRegionSeries` (Phase 4 Track E).
 *
 * This is the oracle for the whole time-series rollup: GSP-level values, NG-zone-level values
 * and the national total must sum to the same figure at every timestamp, because the NG zone
 * groupings ARE a partition (no region appears in two zones — verified against the shipped
 * `public/geo/gb/*-groupings.json` below).
 *
 * DNO groupings are NOT a partition — 15 GSPs appear in two DNO groupings each, and the DNO
 * file additionally carries regions outside the zone partition entirely. That is a known,
 * unresolved bug (see `rollUpRegionValues` and `rollUpRegionSeries` in `data.ts`), deliberately
 * reproduced rather than fixed here. The DNO assertions below document the excess explicitly
 * rather than silently accepting it.
 *
 * **Phase 5 regenerated the groupings name-keyed and deliberately did NOT fix this.** An earlier
 * version of this comment predicted the regeneration would make the "does NOT reconcile" test
 * start failing and that the fix was to flip it to an equality assertion. That did not happen and
 * must not be done: the question put to the API owner — whether a GSP feeding two licence areas
 * is legitimately counted in both, or whether its capacity should be apportioned — has not been
 * answered. Until it is, there is no basis for choosing a number, so
 * `scripts/build-geo-assets.mjs` translates gsp_id -> v1 region name one-for-one and the 15
 * duplicates stay duplicated in `public/geo/gb/dno-groupings.json`. `config/geo-aliases.test.ts`
 * pins the duplicate count on the shipped asset from the other side.
 *
 * So this test keeps documenting the excess. Flipping it to equality is a decision about the
 * data, not a cleanup, and it waits for that answer.
 */
import { describe, expect, it } from "@jest/globals";
import { groupRegionNames, rollUpRegionSeries } from "./data";
import { COUNTRY_CONFIG } from "../../config/countries";
import type { RegionSeries, RegionSeriesValues } from "../../lib/domain/types";

import ngZoneGroupings from "../../public/geo/gb/zone-groupings.json";
import dnoGroupings from "../../public/geo/gb/dno-groupings.json";

const ZONE_GROUPINGS = ngZoneGroupings as Record<string, string[]>;
const DNO_GROUPINGS = dnoGroupings as Record<string, string[]>;

/**
 * The 15 GSPs appearing in two DNO licence areas each, now named rather than numbered.
 * `config/geo-aliases.test.ts` pins the count on the shipped asset from the other side.
 */
const KNOWN_DUPLICATE_DNO_REGIONS = [...new Set(Object.values(DNO_GROUPINGS).flat())].filter(
  (name) =>
    Object.values(DNO_GROUPINGS)
      .flat()
      .filter((other) => other === name).length > 1
);

/**
 * The national baseline is the union of the NG zone groupings.
 *
 * Phase 5 ships no national grouping asset — `data/national_gsp_zone.json` was a bundled
 * `{ National: [every gsp_id] }` file and went with the rest of the `require` block. The zone
 * union is what that file's contents actually were (the test below still checks the zone
 * groupings carry no duplicate, which is the substantive half of the old
 * "national == union of zones" assertion), so the DNO excess it is measured against is the
 * same number as before.
 */
const nationalNames = [...new Set(Object.values(ZONE_GROUPINGS).flat())];

// Every region referenced by either grouping file, so the synthetic series covers whichever
// of them a given aggregation level asks for.
const allGroupingRegions = [
  ...new Set([...Object.values(ZONE_GROUPINGS).flat(), ...Object.values(DNO_GROUPINGS).flat()])
];

const TIMES = ["2026-06-01T11:00:00Z", "2026-06-01T11:30:00Z", "2026-06-01T12:00:00Z"];

// Deterministic, per-region and per-timestamp, so a reconciliation failure can't be masked by
// every region coincidentally carrying the same value. Hashed off the name now that the
// grouping assets are name-keyed.
const hashOf = (name: string) =>
  [...name].reduce((total, character) => total + character.charCodeAt(0), 0);
const powerFor = (name: string, timeIndex: number) => (hashOf(name) % 7) + timeIndex + 1;

const series: RegionSeries = {
  times: TIMES,
  regions: Object.fromEntries(
    allGroupingRegions.map((name) => {
      const values: RegionSeriesValues = {
        regionName: name,
        capacityMw: 1,
        powerMw: TIMES.map((_, index) => powerFor(name, index))
      };
      return [name, values];
    })
  ),
  cacheUpdatedUtc: null
};

const sumAt = (rolled: ReturnType<typeof rollUpRegionSeries>[], index: number) =>
  rolled.reduce((total, r) => total + (r!.values[index].powerMw ?? 0), 0);

describe("rollUpRegionSeries reconciliation", () => {
  const national = rollUpRegionSeries(series, nationalNames, "National")!;

  it("the NG zone groupings are a partition -- no region appears in two zones", () => {
    const zoneNames = Object.values(ZONE_GROUPINGS).flat();
    expect(new Set(zoneNames).size).toBe(zoneNames.length);
    expect(nationalNames.length).toBe(zoneNames.length);
  });

  it("NG zones reconcile to national at every timestamp", () => {
    const zoneSeries = Object.keys(ZONE_GROUPINGS).map(
      (name) => rollUpRegionSeries(series, groupRegionNames(ZONE_GROUPINGS, name)!, name)!
    );

    TIMES.forEach((_, index) => {
      expect(sumAt(zoneSeries, index)).toBeCloseTo(national.values[index].powerMw as number);
    });
  });

  it("raw region-level values reconcile to national at every timestamp", () => {
    TIMES.forEach((_, index) => {
      const gspSum = nationalNames.reduce(
        (total, name) => total + (series.regions[name].powerMw[index] ?? 0),
        0
      );
      expect(gspSum).toBeCloseTo(national.values[index].powerMw as number);
    });
  });

  /**
   * The regression guard the coordinator asked for. The grouped chart path broke twice in
   * Phase 5 without a single test noticing: once when the stored level moved from the enum's
   * `"DNO"` to the registry's `"dno"` and the lookup table silently missed, and once when the
   * call site was stubbed out to `null` while the seam moved underneath it. Both failures
   * looked identical from the outside — an empty chart panel, no error.
   *
   * So this asserts the whole grouped rollup end to end on the SHIPPED asset: a real DNO
   * group name resolves to member regions, and those members produce a series carrying actual
   * numbers. `undefined`, `[]` and a series of nulls all fail it.
   */
  it("a real DNO group name rolls up to a non-empty series with real numbers", () => {
    const groupName = "ENWL";
    const members = groupRegionNames(DNO_GROUPINGS, groupName);
    expect(members).toBeDefined();
    expect(members!.length).toBeGreaterThan(0);

    const rolled = rollUpRegionSeries(series, members!, groupName)!;
    expect(rolled.regionName).toBe(groupName);
    expect(rolled.values).toHaveLength(TIMES.length);
    expect(rolled.values.every((point) => typeof point.powerMw === "number")).toBe(true);
    expect(rolled.values[0].powerMw).toBeGreaterThan(0);
    expect(rolled.capacityMw).toBe(members!.length);
  });

  /**
   * The other half of that regression: the case mismatch could only exist because a lookup
   * table was keyed by hand. It is not any more — the grouping URL is resolved from
   * `config/countries.ts` using the level's own `regionType` — and this pins the convention
   * so a capitalised key cannot creep back in and reintroduce a silent miss.
   */
  it("every derived region type is keyed by its lowercase region-type name", () => {
    for (const config of Object.values(COUNTRY_CONFIG)) {
      for (const [regionType, derived] of Object.entries(config.derivedRegionTypes)) {
        expect(regionType).toBe(regionType.toLowerCase());
        expect(derived.groupings).toContain(regionType);
      }
    }
  });

  it("DNO totals do NOT reconcile to national -- documents the known double-count bug, not a fix", () => {
    const dnoSeries = Object.keys(DNO_GROUPINGS).map(
      (name) => rollUpRegionSeries(series, groupRegionNames(DNO_GROUPINGS, name)!, name)!
    );

    TIMES.forEach((_, index) => {
      const dnoSum = sumAt(dnoSeries, index);
      const nationalValue = national.values[index].powerMw as number;
      // If this ever becomes an equality, Phase 5 has regenerated the groupings name-keyed and
      // fixed the double-count -- flip this assertion to `toBeCloseTo` at that point, don't just
      // delete it.
      expect(dnoSum).not.toBeCloseTo(nationalValue);
      expect(dnoSum).toBeGreaterThan(nationalValue);
    });
  });

  it("the DNO excess is explained exactly by the 15 known duplicates plus DNO-only regions", () => {
    const dnoSeries = Object.keys(DNO_GROUPINGS).map(
      (name) => rollUpRegionSeries(series, groupRegionNames(DNO_GROUPINGS, name)!, name)!
    );
    const dnoNames = Object.values(DNO_GROUPINGS).flat();
    const dnoCounts = new Map<string, number>();
    for (const name of dnoNames) dnoCounts.set(name, (dnoCounts.get(name) ?? 0) + 1);

    // The re-keyed asset must still carry exactly 15 regions in two licence areas: Phase 5
    // translated gsp_id -> region name one-for-one and did not de-duplicate.
    expect(KNOWN_DUPLICATE_DNO_REGIONS).toHaveLength(15);

    const nationalNameSet = new Set(nationalNames);
    TIMES.forEach((_, index) => {
      const dnoSum = sumAt(dnoSeries, index);
      const nationalValue = national.values[index].powerMw as number;

      let expectedExcess = 0;
      for (const [name, count] of dnoCounts.entries()) {
        // Every extra occurrence beyond the first double-counts that region's power; regions
        // the DNO file carries that aren't in the national set at all count in fully.
        const extraOccurrences = nationalNameSet.has(name) ? count - 1 : count;
        if (extraOccurrences > 0) expectedExcess += extraOccurrences * powerFor(name, index);
      }
      // The reverse gap: national regions no DNO grouping carries at all. Each is +1 on the
      // national side with nothing offsetting it on the DNO side, so it *reduces* the excess.
      for (const name of nationalNames) {
        if (!dnoCounts.has(name)) expectedExcess -= powerFor(name, index);
      }

      expect(dnoSum - nationalValue).toBeCloseTo(expectedExcess);
    });
  });
});

describe("rollUpRegionSeries -- absent/no-data/value semantics", () => {
  // "c" deliberately has no entry in the series below -- "absent from the payload".
  const twoRegionTimes = ["2026-06-01T00:00:00Z", "2026-06-01T00:30:00Z", "2026-06-01T01:00:00Z"];
  const twoRegionSeries: RegionSeries = {
    times: twoRegionTimes,
    regions: {
      a: { regionName: "a", capacityMw: 5, powerMw: [0, null, 3] }, // a genuine 0, then no-data, then a value
      b: { regionName: "b", capacityMw: 7, powerMw: [2, null, null] }
    },
    cacheUpdatedUtc: null
  };

  it("sums when at least one member published, including a genuine 0", () => {
    const rolled = rollUpRegionSeries(twoRegionSeries, ["a", "b"], "group")!;
    expect(rolled.values[0].powerMw).toBe(2); // 0 + 2, not dropped as missing
  });

  it("is null, not 0, when every present member reported no-data at that instant", () => {
    const rolled = rollUpRegionSeries(twoRegionSeries, ["a", "b"], "group")!;
    expect(rolled.values[1].powerMw).toBeNull();
  });

  it("sums the one member that published even when another member reported no-data", () => {
    const rolled = rollUpRegionSeries(twoRegionSeries, ["a", "b"], "group")!;
    expect(rolled.values[2].powerMw).toBe(3);
  });

  it("a grouping member absent from the payload is skipped, not zero-filled", () => {
    const rolled = rollUpRegionSeries(twoRegionSeries, ["a", "b", "c"], "group")!;
    expect(rolled.values[0].powerMw).toBe(2); // unchanged by the absent "c"
    expect(rolled.capacityMw).toBe(12); // 5 + 7, "c" contributes nothing
  });

  it("returns undefined when the series itself hasn't loaded", () => {
    expect(rollUpRegionSeries(undefined, ["a", "b"], "group")).toBeUndefined();
  });
});
