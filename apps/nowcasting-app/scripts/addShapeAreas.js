// Adds `areaKm2` to every region in `public/geo/**`, for the MW/km² map view.
// Re-run with `yarn shape-areas` whenever a shape file changes.
const fs = require("fs");
const path = require("path");
const { area } = require("@turf/turf");

const GEO_DIR = path.join(__dirname, "..", "public", "geo");

for (const file of fs.readdirSync(GEO_DIR, { recursive: true })) {
  if (!file.endsWith(".json")) continue;
  const filePath = path.join(GEO_DIR, file);
  const shapes = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!shapes.features?.some((f) => f.geometry?.type.endsWith("Polygon"))) continue;

  for (const feature of shapes.features) {
    feature.properties.areaKm2 = Number((area(feature) / 1_000_000).toFixed(3));
  }
  fs.writeFileSync(filePath, JSON.stringify(shapes));
  console.log(`${file}: ${shapes.features.length} areas`);
}
