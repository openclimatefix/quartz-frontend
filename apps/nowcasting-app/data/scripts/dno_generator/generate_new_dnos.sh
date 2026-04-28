#!/usr/bin/env bash
set -euo pipefail

# Generate full DNO -> [GSP IDs] mapping directly from:
# 1) source.geojson
# 2) gsp_id_mapping.json
# 3) dno_gsp_groupings.json
#
# Default output: new_gsps.json
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GEOJSON_FILE="${1:-$SCRIPT_DIR/source.geojson}"
GSPIDMAPPING_FILE="${2:-$SCRIPT_DIR/gsp_id_mapping.json}"
DNO_GROUPINGS_FILE="${3:-$SCRIPT_DIR/dno_gsp_groupings.json}"
OUTPUT_FILE="${4:-$SCRIPT_DIR/new_gsps.json}"
MIN_MATCH="${5:-5}"

for f in "$GEOJSON_FILE" "$GSPIDMAPPING_FILE" "$DNO_GROUPINGS_FILE"; do
  if [[ ! -f "$f" ]]; then
    echo "Input file not found: $f" >&2
    exit 1
  fi
done

node - "$GEOJSON_FILE" "$GSPIDMAPPING_FILE" "$DNO_GROUPINGS_FILE" "$OUTPUT_FILE" "$MIN_MATCH" <<'NODE'
const fs = require('fs');

const geojsonFile = process.argv[2];
const gspidmappingFile = process.argv[3];
const dnoGroupingsFile = process.argv[4];
const outputFile = process.argv[5];
const minMatch = Number(process.argv[6]);

if (!Number.isFinite(minMatch) || minMatch < 1) {
  console.error('MIN_MATCH must be a positive integer.');
  process.exit(1);
}

const geo = JSON.parse(fs.readFileSync(geojsonFile, 'utf8'));
const gspidmapping = JSON.parse(fs.readFileSync(gspidmappingFile, 'utf8'));
const dnoGroupings = JSON.parse(fs.readFileSync(dnoGroupingsFile, 'utf8'));

// Build GSPGroup -> set of GSP name strings from GeoJSON.
const groupToGsps = new Map();
for (const feature of geo.features || []) {
  const props = feature && feature.properties ? feature.properties : {};
  const group = props.GSPGroup;
  const gsps = props.GSPs;
  if (!group || !gsps) continue;

  if (!groupToGsps.has(group)) groupToGsps.set(group, new Set());
  groupToGsps.get(group).add(gsps);
}

// Build gspName -> numeric GSP id using labels like GSP_123.
const gspNameToId = new Map();
for (const row of gspidmapping || []) {
  const gspName = row && row.gspName;
  const label = row && row.label;
  if (!gspName || !label) continue;

  const m = String(label).match(/^GSP_(\d+)$/);
  if (!m) continue;
  gspNameToId.set(gspName, Number(m[1]));
}

// Convert GeoJSON groups to numeric IDs.
const groupToIds = new Map();
for (const [group, gspsSet] of groupToGsps.entries()) {
  const ids = new Set();
  for (const gspName of gspsSet) {
    const id = gspNameToId.get(gspName);
    if (Number.isFinite(id)) ids.add(id);
  }
  groupToIds.set(group, ids);
}

// Prepare DNO sets.
const dnoToSet = new Map(
  Object.entries(dnoGroupings).map(([dno, ids]) => [
    dno,
    new Set((ids || []).map(Number).filter(Number.isFinite)),
  ])
);

// Match each group to a DNO by best unique overlap and threshold.
const groupToDno = new Map();
const unresolved = [];

for (const [group, idsSet] of groupToIds.entries()) {
  let bestDno = null;
  let bestOverlap = -1;
  let tie = false;

  for (const [dno, dnoSet] of dnoToSet.entries()) {
    let overlap = 0;
    for (const id of idsSet) {
      if (dnoSet.has(id)) overlap += 1;
    }

    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestDno = dno;
      tie = false;
    } else if (overlap === bestOverlap) {
      tie = true;
    }
  }

  if (bestDno && bestOverlap >= minMatch && !tie) {
    groupToDno.set(group, bestDno);
  } else {
    unresolved.push({ group, bestOverlap, tie });
  }
}

// Build final full DNO -> IDs map from matched groups.
const dnoToIds = new Map();
for (const [group, idsSet] of groupToIds.entries()) {
  const dno = groupToDno.get(group);
  if (!dno) continue;

  if (!dnoToIds.has(dno)) dnoToIds.set(dno, new Set());
  const outSet = dnoToIds.get(dno);
  for (const id of idsSet) outSet.add(id);
}

const finalObj = Object.fromEntries(
  Array.from(dnoToIds.entries())
    .map(([dno, idsSet]) => [dno, Array.from(idsSet).sort((a, b) => a - b)])
    .sort(([a], [b]) => a.localeCompare(b))
);

fs.writeFileSync(outputFile, JSON.stringify(finalObj, null, 2) + '\n');

const totalIds = Object.values(finalObj).reduce((n, ids) => n + ids.length, 0);
console.log(`Wrote ${outputFile}`);
console.log(`DNO groups: ${Object.keys(finalObj).length}`);
console.log(`Total IDs: ${totalIds}`);
console.log(`Groups unresolved: ${unresolved.length}`);
if (unresolved.length > 0) {
  console.log(JSON.stringify(unresolved, null, 2));
}
NODE
