/**
 * Adds an `areaKm2` property to every region in the GSP and DNO shape files.
 *
 * The shapes are static, so their areas are measured once here and committed,
 * rather than in the browser where the (fairly slow) calculation would rerun on
 * every map update. Areas are used for the MW/km² map shading.
 *
 * Run `yarn shape-areas` after adding or updating a shape file.
 * `components/helpers/data.test.ts` fails if a shape file is missing its areas.
 */
const fs = require("fs");
const path = require("path");
const { area } = require("@turf/turf");

const SHAPE_FILES = ["GSP_regions_4326_20260209.json", "dno_regions_lat_long_converted.json"];

// Keep each file's existing layout, so adding areas doesn't rewrite the whole file
const serialize = (shapeJson, originalRaw) => {
  const indent = originalRaw.match(/^\{\n( +)"/)?.[1];
  if (indent) return JSON.stringify(shapeJson, null, indent.length) + "\n";

  // ogr2ogr style, one feature per line
  const { features, ...header } = shapeJson;
  const headerLines = Object.entries(header).map(([key, value]) => {
    return `${JSON.stringify(key)}: ${JSON.stringify(value)}`;
  });
  const featureLines = features.map((feature) => JSON.stringify(feature));
  return `{\n${headerLines.join(",\n")},\n"features": [\n${featureLines.join(",\n")}\n]\n}\n`;
};

for (const fileName of SHAPE_FILES) {
  const filePath = path.join(__dirname, "..", "data", fileName);
  const originalRaw = fs.readFileSync(filePath, "utf8");
  const shapeJson = JSON.parse(originalRaw);

  shapeJson.features = shapeJson.features.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      areaKm2: Number((area(feature) / 1_000_000).toFixed(3))
    }
  }));

  fs.writeFileSync(filePath, serialize(shapeJson, originalRaw));
  console.log(`${fileName}: added areaKm2 to ${shapeJson.features.length} regions`);
}
