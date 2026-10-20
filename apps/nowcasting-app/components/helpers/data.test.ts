/**
 * The geometry builder.
 *
 * The API request window used to be tested here too; it moved to
 * `lib/api/v1/series-window.test.ts` with the helper itself on 2026-08-17.
 *
 * This arrived in Phase 5. `buildMapGeometry` used to `require` 36 MB of bundled
 * GeoJSON and pick a file by `NationalAggregation` member; it is now pure — shapes in,
 * FeatureCollection out — so it is testable at all for the first time, and the assertions
 * below are about the join rules rather than about any particular file. The value half of the
 * same module is covered by `components/map/map-value-join.test.ts`.
 */
import { describe, expect } from "@jest/globals";
import type { FeatureCollection } from "geojson";
import { buildMapGeometry } from "./data";
import type { AggregationLevel } from "./aggregationLevels";
import type { Region } from "../../lib/domain/types";
import { it } from "@jest/globals";

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
