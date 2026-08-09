/**
 * Two things live here: the API request window, and the geometry builder.
 *
 * The geometry half arrived in Phase 5. `buildMapGeometry` used to `require` 36 MB of bundled
 * GeoJSON and pick a file by `NationalAggregation` member; it is now pure — shapes in,
 * FeatureCollection out — so it is testable at all for the first time, and the assertions
 * below are about the join rules rather than about any particular file. The value half of the
 * same module is covered by `components/map/map-value-join.test.ts`.
 */
import { describe, expect, jest } from "@jest/globals";
import type { FeatureCollection } from "geojson";
import { buildMapGeometry, getEarliestForecastTimestamp } from "./data";
import type { AggregationLevel } from "./aggregationLevels";
import type { Region } from "../../lib/domain/types";
import { Settings } from "luxon";
import { afterEach, beforeEach, it } from "@jest/globals";

/**
 * B2. These tests previously pinned the *broken* behaviour; they now assert the corrected one.
 * Two things changed:
 *
 * 1. `getFurthestForecastTimestamp` had a broken round-up. It no longer exists at all: nothing
 *    pins the END of a forecast window any more, because the horizon is a per-country fact (GB
 *    36h, NL 48h) and any constant truncates somebody. See the note in `data.ts`.
 * 2. Both helpers rounded in the *viewer's* local timezone and only then converted to UTC, so a
 *    viewer in Los Angeles or Sydney requested a different window from a viewer in the UK for the
 *    same instant (worst around the boundaries, and across the viewer's own DST changes, where
 *    calendar-day arithmetic in local time shifts the instant by an hour). Rounding now happens
 *    in UTC, which is the only zone the API knows about, so every viewer gets the same window.
 *
 * The old expectations that changed, for the record (frozen now = 2025-12-07T14:45:00Z, UTC
 * viewer): furthest was "2025-12-08T16:00:00.000Z", now "2025-12-08T18:00:00.000Z". Earliest was
 * already right for a UTC viewer; it was only wrong off-zone, e.g. an LA viewer at
 * 2025-11-03T12:00:00Z got "2025-11-01T07:00:00.000Z" where a UK viewer got
 * "2025-11-01T12:00:00.000Z".
 */
describe("forecast window helpers (B2)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Settings.defaultZone = "utc";
  });
  afterEach(() => {
    jest.useRealTimers();
    Settings.defaultZone = "system";
    jest.restoreAllMocks();
  });

  const freeze = (iso: string) => jest.setSystemTime(new Date(iso).getTime());

  describe("getEarliestForecastTimestamp — two days back, rounded DOWN to a 6-hour UTC boundary", () => {
    it.each([
      // [frozen now, expected]
      ["2025-12-07T14:45:00Z", "2025-12-05T12:00:00.000Z"],
      ["2025-12-07T05:59:59Z", "2025-12-05T00:00:00.000Z"],
      ["2025-12-07T23:59:59Z", "2025-12-05T18:00:00.000Z"],
      ["2025-12-07T11:59:59.999Z", "2025-12-05T06:00:00.000Z"],
      // BST, where the old local-zone rounding drifted for UK viewers too
      ["2025-07-15T14:45:00Z", "2025-07-13T12:00:00.000Z"],
      ["2025-07-15T00:30:00Z", "2025-07-13T00:00:00.000Z"],
      // spanning the UK DST boundaries
      ["2025-03-30T02:30:00Z", "2025-03-28T00:00:00.000Z"],
      ["2025-10-26T01:30:00Z", "2025-10-24T00:00:00.000Z"],
      ["2026-03-29T02:30:00Z", "2026-03-27T00:00:00.000Z"],
      ["2026-10-25T01:30:00Z", "2026-10-23T00:00:00.000Z"]
    ])("now = %s -> %s", (now, expected) => {
      freeze(now);
      expect(getEarliestForecastTimestamp()).toBe(expected);
    });

    it.each(["00:00", "06:00", "12:00", "18:00"])(
      "is idempotent on the boundary hour %s (does not jump back a full interval)",
      (hhmm) => {
        freeze(`2025-12-07T${hhmm}:00Z`);
        expect(getEarliestForecastTimestamp()).toBe(`2025-12-05T${hhmm}:00.000Z`);
      }
    );
  });

  describe("the viewer's timezone must not change the UTC window", () => {
    const zones = [
      "utc",
      "Europe/London",
      "America/Los_Angeles",
      "Australia/Sydney",
      "Asia/Kolkata"
    ];

    it.each(zones)("a viewer in %s gets the same window as a UK viewer (BST)", (zone) => {
      Settings.defaultZone = zone;
      freeze("2025-07-15T14:45:00Z");
      expect(getEarliestForecastTimestamp()).toBe("2025-07-13T12:00:00.000Z");
    });

    it.each(zones)("a viewer in %s gets the same window across their own DST change", (zone) => {
      // US DST ended 2025-11-02, UK's 2025-10-26: calendar-day arithmetic in local time used to
      // shift the instant by an hour here, so viewers disagreed.
      Settings.defaultZone = zone;
      freeze("2025-11-03T12:00:00Z");
      expect(getEarliestForecastTimestamp()).toBe("2025-11-01T12:00:00.000Z");
    });
  });
});

// =========================================================================================
// buildMapGeometry — pure since Phase 5
// =========================================================================================

const level = (regionType: string, derived = false): AggregationLevel => ({
  regionType,
  level: derived ? 5 : 10,
  label: regionType,
  minZoom: 0,
  maxZoom: 14,
  derived
});

const region = (name: string, over: Partial<Region> = {}): Region => ({
  name,
  label: name.toUpperCase(),
  regionType: "gsp",
  capacityMw: 1,
  centroid: null,
  metadata: {},
  ...over
});

const point = (properties: Record<string, unknown>): FeatureCollection["features"][number] => ({
  type: "Feature",
  properties,
  geometry: { type: "Point", coordinates: [0, 51] }
});

const collection = (...features: FeatureCollection["features"]): FeatureCollection => ({
  type: "FeatureCollection",
  features
});

describe("buildMapGeometry — the region/feature join", () => {
  const gspLevel = level("gsp");

  it("loads nothing: the shapes are an argument", () => {
    // The whole point of the phase's bundle number. If this file ever `require`s a
    // `data/*.json` again, this call would still pass -- but the module would be megabytes.
    // The guard that matters is that `shapes` is the only source of features.
    const result = buildMapGeometry({
      level: gspLevel,
      shapes: collection(point({ GSPs: "CITR_1" })),
      regions: [region("citr_1", { metadata: { gsp_id: 67 } })],
      joinProperty: "GSPs",
      joinTransform: "lowercase",
      country: "GB"
    });
    expect(result.features).toHaveLength(1);
  });

  it("applies the registry's joinTransform to the FEATURE key, not the region name", () => {
    // GB's boundary file spells the code uppercase (`CITR_1`); v1 region names are lowercase.
    const result = buildMapGeometry({
      level: gspLevel,
      shapes: collection(point({ GSPs: "CITR_1" })),
      regions: [region("citr_1", { metadata: { gsp_id: 67 } })],
      joinProperty: "GSPs",
      joinTransform: "lowercase",
      country: "GB"
    });
    expect(result.features[0].id).toBe(67);
    expect(result.features[0].properties?.regionName).toBe("citr_1");
    expect(result.features[0].properties?.gspDisplayName).toBe("CITR_1");
  });

  it("uses the region name as the feature id where there is no numeric gsp_id", () => {
    // NL: provinces have no gsp_id, and `use-update-map-state-on-click.ts` only coerces to a
    // number at `gsp` level, so a name is the right id everywhere else.
    const result = buildMapGeometry({
      level: level("province"),
      shapes: collection(point({ name: "Groningen" })),
      regions: [region("groningen", { regionType: "province" })],
      joinProperty: "name",
      joinTransform: "lowercase",
      country: "NL"
    });
    expect(result.features[0].id).toBe("groningen");
  });

  it("gives every unmatched feature a DISTINCT negative id", () => {
    // Feature state cannot tolerate two features sharing an id; the v0 code gave all the
    // Off_NETS placeholders 1000 apiece. GB currently has three unmatched keys across seven
    // features (`off_nets(unassigned)` alone is five).
    const result = buildMapGeometry({
      level: gspLevel,
      shapes: collection(
        point({ GSPs: "OFF_NETS(UNASSIGNED)" }),
        point({ GSPs: "OFF_NETS(UNASSIGNED)" }),
        point({ GSPs: "GREM_P" })
      ),
      regions: [],
      joinProperty: "GSPs",
      joinTransform: "lowercase",
      country: "GB"
    });
    const ids = result.features.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => typeof id === "number" && (id as number) < 0)).toBe(true);
    expect(result.features[0].properties?.regionName).toBe("");
  });

  it("draws one region on several features rather than assuming a 1:1 mapping", () => {
    // 362 GB polygons carry only 335 distinct keys: a multi-part GSP is legitimately several
    // polygons. Both must carry the same id so one setFeatureState paints both.
    const result = buildMapGeometry({
      level: gspLevel,
      shapes: collection(point({ GSPs: "CITR_1" }), point({ GSPs: "CITR_1" })),
      regions: [region("citr_1", { metadata: { gsp_id: 67 } })],
      joinProperty: "GSPs",
      joinTransform: "lowercase",
      country: "GB"
    });
    expect(result.features.map((feature) => feature.id)).toEqual([67, 67]);
  });

  it("never draws a LEGACY_REGIONS region", () => {
    // `carr_1` is served by the API for backward compatibility; the NESO file models only the
    // merged `carr_1|fidf_1`. If a rebuild ever introduced a colliding key, the legacy region
    // must still not claim it -- otherwise the same ground is painted twice and the national
    // total inflates, which is the 683 MW bug the rule exists to resolve.
    const result = buildMapGeometry({
      level: gspLevel,
      shapes: collection(point({ GSPs: "CARR_1" })),
      regions: [region("carr_1", { metadata: { gsp_id: 56 } })],
      joinProperty: "GSPs",
      joinTransform: "lowercase",
      country: "GB"
    });
    expect(result.features[0].id).toBe(-1);
    expect(result.features[0].properties?.regionName).toBe("");
  });

  it("a derived level reads its id straight off the polygon's join property", () => {
    const result = buildMapGeometry({
      level: level("dno", true),
      shapes: collection(point({ LongName: "UKPN (East)" })),
      groupings: { "UKPN (East)": ["citr_1"] },
      regions: [region("citr_1", { metadata: { gsp_id: 67 } })],
      joinProperty: "LongName",
      country: "GB"
    });
    expect(result.features[0].id).toBe("UKPN (East)");
    expect(result.features[0].properties?.id).toBe("UKPN (East)");
  });

  it("leaves the source collection untouched", () => {
    const shapes = collection(point({ GSPs: "CITR_1" }));
    buildMapGeometry({
      level: gspLevel,
      shapes,
      regions: [region("citr_1", { metadata: { gsp_id: 67 } })],
      joinProperty: "GSPs",
      joinTransform: "lowercase",
      country: "GB"
    });
    // The fetched asset is shared between both maps through `loadGeoAsset`'s cache, so
    // mutating it here would corrupt the other map's geometry.
    expect(shapes.features[0].id).toBeUndefined();
    expect(shapes.features[0].properties).toEqual({ GSPs: "CITR_1" });
  });
});
