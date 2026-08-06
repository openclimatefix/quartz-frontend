/**
 * The permanent reconciliation invariant for `rollUpRegionSeries` (Phase 4 Track E).
 *
 * This is the oracle for the whole time-series rollup: GSP-level values, NG-zone-level values
 * and the national total must sum to the same figure at every timestamp, because the NG zone
 * groupings ARE a partition of the national GSP set (317 ids, no duplicates — verified against
 * the bundled `data/*.json` below).
 *
 * DNO groupings are NOT a partition — 15 GSP ids appear in two DNO groupings each, and the DNO
 * files additionally carry ids outside the national grouping entirely. That is a known,
 * unresolved bug (see `rollUpRegionValues` and `rollUpRegionSeries` in `data.ts`), deliberately
 * reproduced rather than fixed here. The DNO assertions below document the excess explicitly
 * rather than silently accepting it; when Phase 5 regenerates the groupings name-keyed, the
 * "does NOT reconcile" test should start failing, which is the signal to flip it to an equality
 * assertion.
 */
import { describe, expect, it } from "@jest/globals";
import { buildRegionBridge, groupGspIds, rollUpRegionSeries } from "./data";
import { NationalAggregation } from "../map/types";
import type { Region, RegionSeries, RegionSeriesValues } from "../../lib/domain/types";

import ngZoneGroupings from "../../data/ng_gsp_zone_groupings.json";
import dnoGroupings from "../../data/dno_gsp_groupings.json";
import nationalGrouping from "../../data/national_gsp_zone.json";

const KNOWN_DUPLICATE_DNO_IDS = [
  26, 40, 60, 103, 135, 142, 155, 180, 199, 240, 279, 281, 322, 328, 341
];

// Every GSP id referenced by any grouping file, so the synthetic series covers whichever of
// them a given aggregation level asks for.
const allGroupingIds = new Set<number>();
for (const ids of Object.values(ngZoneGroupings as Record<string, number[]>)) {
  ids.forEach((id) => allGroupingIds.add(id));
}
for (const ids of Object.values(dnoGroupings as Record<string, number[]>)) {
  ids.forEach((id) => allGroupingIds.add(id));
}
for (const ids of Object.values(nationalGrouping as Record<string, number[]>)) {
  ids.forEach((id) => allGroupingIds.add(id));
}

const regions: Region[] = Array.from(allGroupingIds).map((id) => ({
  name: `gsp-${id}`,
  label: `GSP ${id}`,
  regionType: "gsp",
  capacityMw: 1,
  centroid: null,
  metadata: { gsp_id: id }
}));

const bridge = buildRegionBridge(regions);

const TIMES = ["2026-06-01T11:00:00Z", "2026-06-01T11:30:00Z", "2026-06-01T12:00:00Z"];

// Deterministic, per-id and per-timestamp, so a reconciliation failure can't be masked by every
// region coincidentally carrying the same value.
const powerFor = (id: number, timeIndex: number) => (id % 7) + timeIndex + 1;

const series: RegionSeries = {
  times: TIMES,
  regions: Object.fromEntries(
    regions.map((region) => {
      const id = region.metadata["gsp_id"] as number;
      const values: RegionSeriesValues = {
        regionName: region.name,
        capacityMw: 1,
        powerMw: TIMES.map((_, index) => powerFor(id, index))
      };
      return [region.name, values];
    })
  ),
  cacheUpdatedUtc: null
};

const sumAt = (rolled: ReturnType<typeof rollUpRegionSeries>[], index: number) =>
  rolled.reduce((total, r) => total + (r!.values[index].powerMw ?? 0), 0);

describe("rollUpRegionSeries reconciliation", () => {
  const nationalIds = groupGspIds(NationalAggregation.national, "National")!;
  const national = rollUpRegionSeries(series, nationalIds, bridge, "National")!;

  it("national grouping is exactly the union of the NG zone groupings (no duplicates)", () => {
    const zoneIds = Object.values(ngZoneGroupings as Record<string, number[]>).flat();
    expect(new Set(zoneIds).size).toBe(zoneIds.length); // zones don't duplicate internally
    expect([...new Set(zoneIds)].sort((a, b) => a - b)).toEqual(
      [...nationalIds].sort((a, b) => a - b)
    );
  });

  it("NG zones reconcile to national at every timestamp", () => {
    const zoneSeries = Object.keys(ngZoneGroupings).map(
      (name) =>
        rollUpRegionSeries(series, groupGspIds(NationalAggregation.zone, name)!, bridge, name)!
    );

    TIMES.forEach((_, index) => {
      expect(sumAt(zoneSeries, index)).toBeCloseTo(national.values[index].powerMw as number);
    });
  });

  it("raw GSP-level values reconcile to national at every timestamp", () => {
    TIMES.forEach((_, index) => {
      const gspSum = nationalIds.reduce((total, id) => {
        const region = bridge.byGspId.get(id)!;
        return total + (series.regions[region.name].powerMw[index] ?? 0);
      }, 0);
      expect(gspSum).toBeCloseTo(national.values[index].powerMw as number);
    });
  });

  it("DNO totals do NOT reconcile to national -- documents the known double-count bug, not a fix", () => {
    const dnoSeries = Object.keys(dnoGroupings).map(
      (name) =>
        rollUpRegionSeries(series, groupGspIds(NationalAggregation.DNO, name)!, bridge, name)!
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

  it("the DNO excess is explained exactly by the 15 known-duplicate ids plus DNO-only ids", () => {
    const dnoSeries = Object.keys(dnoGroupings).map(
      (name) =>
        rollUpRegionSeries(series, groupGspIds(NationalAggregation.DNO, name)!, bridge, name)!
    );
    const dnoIds = Object.values(dnoGroupings as Record<string, number[]>).flat();
    const dnoIdCounts = new Map<number, number>();
    for (const id of dnoIds) dnoIdCounts.set(id, (dnoIdCounts.get(id) ?? 0) + 1);

    // Confirms the duplicate set pinned in the doc comments hasn't drifted from the bundled file.
    const duplicates = [...dnoIdCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([id]) => id);
    expect(duplicates.sort((a, b) => a - b)).toEqual(
      [...KNOWN_DUPLICATE_DNO_IDS].sort((a, b) => a - b)
    );

    const nationalIdSet = new Set(nationalIds);
    TIMES.forEach((_, index) => {
      const dnoSum = sumAt(dnoSeries, index);
      const nationalValue = national.values[index].powerMw as number;

      let expectedExcess = 0;
      for (const [id, count] of dnoIdCounts.entries()) {
        // Every extra occurrence beyond the first double-counts that id's power; ids the DNO
        // files carry that aren't in the national grouping at all count in fully.
        const inNational = nationalIdSet.has(id);
        const extraOccurrences = inNational ? count - 1 : count;
        if (extraOccurrences > 0) expectedExcess += extraOccurrences * powerFor(id, index);
      }
      // The reverse gap: national ids no DNO grouping carries at all. Each is +1 on the
      // national side with nothing offsetting it on the DNO side, so it *reduces* the excess.
      for (const id of nationalIds) {
        if (!dnoIdCounts.has(id)) expectedExcess -= powerFor(id, index);
      }

      expect(dnoSum - nationalValue).toBeCloseTo(expectedExcess);
    });
  });
});

describe("rollUpRegionSeries -- absent/no-data/value semantics", () => {
  const bridgeAB = buildRegionBridge([
    {
      name: "a",
      label: "A",
      regionType: "gsp",
      capacityMw: 5,
      centroid: null,
      metadata: { gsp_id: 1 }
    },
    {
      name: "b",
      label: "B",
      regionType: "gsp",
      capacityMw: 7,
      centroid: null,
      metadata: { gsp_id: 2 }
    }
    // id 3 deliberately has no region behind it -- "absent from the payload".
  ]);

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
    const rolled = rollUpRegionSeries(twoRegionSeries, [1, 2], bridgeAB, "group")!;
    expect(rolled.values[0].powerMw).toBe(2); // 0 + 2, not dropped as missing
  });

  it("is null, not 0, when every present member reported no-data at that instant", () => {
    const rolled = rollUpRegionSeries(twoRegionSeries, [1, 2], bridgeAB, "group")!;
    expect(rolled.values[1].powerMw).toBeNull();
  });

  it("sums the one member that published even when another member reported no-data", () => {
    const rolled = rollUpRegionSeries(twoRegionSeries, [1, 2], bridgeAB, "group")!;
    expect(rolled.values[2].powerMw).toBe(3);
  });

  it("a grouping id with no region behind it (absent from the payload) is skipped, not zero-filled", () => {
    const rolled = rollUpRegionSeries(twoRegionSeries, [1, 2, 3], bridgeAB, "group")!;
    expect(rolled.values[0].powerMw).toBe(2); // unchanged by the absent id 3
    expect(rolled.capacityMw).toBe(12); // 5 + 7, id 3 contributes nothing
  });

  it("returns undefined when the series itself hasn't loaded", () => {
    expect(rollUpRegionSeries(undefined, [1, 2], bridgeAB, "group")).toBeUndefined();
  });
});
