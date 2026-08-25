import { describe, expect, test } from "@jest/globals";
import fs from "fs";
import path from "path";
import { FeatureCollection } from "geojson";
import gspShapeData from "../../data/GSP_regions_4326_20260209.json";
import gspMetadata from "../../data/gsp_metadata_26-06-05.json";

// Same file data.ts uses to draw GSP regions on the map - if that import
// changes, this should be updated to match.
const gspShapeJson = gspShapeData as FeatureCollection;
const METRICS_DIR = path.join(__dirname, "../../public/metrics/gsp_metrics");

const nameToGspId = new Map<string, number>(
  (gspMetadata as { gspId: number; gspName: string }[]).map((row) => [row.gspName, row.gspId])
);

const boundaryNames = gspShapeJson.features.map((f) => f.properties?.GSPs as string);

// GSP's with zero capacity that are excluded for this test
const ZERO_CAPACITY_GSP_IDS = new Set([
  87, // DOUN_P
  92, // DUBE_P
  239 // QUOI_P
]);

describe("GSP boundary vs seasonal metrics coverage", () => {
  test("every boundary region with a known GSP ID has a seasonal metrics file", () => {
    const missing = boundaryNames
      .map((name) => ({ name, gspId: nameToGspId.get(name) }))
      .filter((entry): entry is { name: string; gspId: number } => entry.gspId !== undefined)
      .filter(({ gspId }) => !ZERO_CAPACITY_GSP_IDS.has(gspId))
      .filter(({ gspId }) => !fs.existsSync(path.join(METRICS_DIR, `gsp_${gspId}.json`)));

    expect(missing).toEqual([]);
  });

  test("logs boundary regions whose name has no matching GSP ID in gsp_metadata", () => {
    const unresolved = boundaryNames.filter((name) => !nameToGspId.has(name));

    if (unresolved.length > 0) {
      console.log(
        `${unresolved.length}/${boundaryNames.length} boundary region(s) have no matching GSP ID in gsp_metadata:`,
        unresolved
      );
    }
  });
});
