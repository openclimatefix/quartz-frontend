import type { Expression } from "mapbox-gl";

import { DELTA_BUCKET } from "../../constant";
import { theme } from "../../tailwind.config";
import type { MapFeatureState } from "../helpers/data";
import { ActiveUnit } from "./types";

/**
 * How values reach Mapbox.
 *
 * The map used to rebuild the whole FeatureCollection and call `setData` every time a number
 * moved, so Mapbox re-parsed and re-tessellated unchanged geometry on every scrub tick. Now
 * the geometry is handed over once and the numbers travel as **feature state**, with the
 * colour and opacity ramps expressed as `step` expressions over `["feature-state", …]`.
 *
 * The source declares `promoteId: FEATURE_KEY_PROPERTY`, so a feature's Mapbox id is its
 * **country-qualified** key (`"GB:5"`, `"NL:groningen"`) rather than its bare region id. That
 * changed in Phase 6 Track F, when the source started carrying every enabled country at once
 * and a bare `5` stopped being unique. `components/map/country-features.ts` is the other half
 * of the agreement — it stamps the key, and `namespaceFeatureStates` re-keys the value map
 * that arrives here.
 */
export const PV_SOURCE_ID = "latestPV";

const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;

/**
 * A region that is in the payload but reported nothing. Deliberately not the same as a
 * region that has not published yet (drawn as nothing at all) and not the same as a genuine
 * zero (drawn as the faintest yellow band).
 */
export const NO_DATA_COLOR = "#6b7280";
export const NO_DATA_OPACITY = 0.25;

/**
 * The six opacity bands `ColorGuideBar` draws, and the thresholds that select them.
 *
 * These reproduce `getOpacityValueFromPVNormalized`'s table exactly, moved out of JS and into
 * the paint expression. The first band is **0.03, not 0** — a region generating 0 MW at
 * midnight has published a real value and must not be indistinguishable from one that has
 * published nothing. The old `interpolate` ramp started at opacity 0 and erased it, which is
 * audit B8's bug class and is what the legend has always claimed ("0-50" at 3%).
 */
const BAND_OPACITIES = [0.03, 0.2, 0.4, 0.6, 0.8, 1];
const NORMALIZED_THRESHOLDS = [0.1, 0.2, 0.35, 0.5, 0.7];
/** GSP level, MW. Matches `ColorGuideBar`'s 0-50 / 50-150 / … labels. */
const MW_THRESHOLDS_GSP = [50, 150, 250, 350, 450];
/** Zone and DNO levels, MW. Ten times the GSP bands, as the legend says. */
const MW_THRESHOLDS_GROUPED = [500, 1500, 2500, 3500, 4500];

const bandExpression = (input: Expression, thresholds: number[]): Expression => {
  const expression: unknown[] = ["step", input, BAND_OPACITIES[0]];
  thresholds.forEach((threshold, index) => {
    expression.push(threshold, BAND_OPACITIES[index + 1]);
  });
  return expression as unknown as Expression;
};

const state = (key: keyof MapFeatureState): Expression =>
  ["coalesce", ["feature-state", key], 0] as unknown as Expression;

/**
 * Pick a band expression per feature, on the feature-state `grouped` flag.
 *
 * Grouped-ness used to be an argument, because the map drew one country at one level. Since
 * Phase 6 Track F it draws every *enabled* country in one source, and each country picks its
 * own aggregation level — GB can be on its DNO rollup (bands ten times higher) while NL is on
 * provinces in the same frame. A single `isGrouped` argument cannot describe that frame: one
 * of the two countries gets the other's thresholds, which is not an error, just a map where
 * every NL province sits in the faintest band. So the choice moves into the expression, where
 * it is made per feature. `namespaceFeatureStates` stamps the flag.
 */
const groupedAwareBands = (input: Expression): Expression =>
  [
    "case",
    ["==", ["feature-state", "grouped"], true],
    bandExpression(input, MW_THRESHOLDS_GROUPED),
    bandExpression(input, MW_THRESHOLDS_GSP)
  ] as unknown as Expression;

/**
 * `fill-opacity` for the forecast layer.
 *
 * Capacity mode is not gated on `dataState`: installed capacity is known for every region
 * whether or not it has published a reading, so gating it would blank the capacity view
 * every time the newest slot was mid-fill.
 */
export const fillOpacityExpression = (unit: ActiveUnit): Expression => {
  if (unit === ActiveUnit.capacity) {
    return groupedAwareBands(state("capacity"));
  }

  const valueOpacity =
    unit === ActiveUnit.percentage
      ? bandExpression(state("normalized"), NORMALIZED_THRESHOLDS)
      : groupedAwareBands(state("power"));

  return [
    "case",
    ["==", ["feature-state", "dataState"], "value"],
    valueOpacity,
    ["==", ["feature-state", "dataState"], "no-data"],
    NO_DATA_OPACITY,
    // "unpublished": nothing to draw. The border still outlines the region, so the map reads
    // as "waiting" rather than as "zero".
    0
  ] as unknown as Expression;
};

export const fillColorExpression = (unit: ActiveUnit): Expression => {
  if (unit === ActiveUnit.capacity) return yellow as unknown as Expression;
  return [
    "case",
    ["==", ["feature-state", "dataState"], "no-data"],
    NO_DATA_COLOR,
    yellow
  ] as unknown as Expression;
};

const delta = theme.extend.colors["ocf-delta"];

/**
 * `fill-color` for the delta layer, as a `step` over the pre-computed bucket.
 *
 * `hasDelta` is false for a future slot and for a region where either side is missing; those
 * are drawn as nothing rather than as a delta of zero, which is what the v0 code showed.
 */
export const deltaFillColorExpression = (): Expression =>
  [
    "case",
    ["!=", ["feature-state", "hasDelta"], true],
    "transparent",
    [
      "step",
      ["coalesce", ["feature-state", "deltaBucket"], 0],
      delta[100],
      DELTA_BUCKET.NEG4,
      delta[200],
      DELTA_BUCKET.NEG3,
      delta[300],
      DELTA_BUCKET.NEG2,
      delta[400],
      DELTA_BUCKET.NEG1,
      "transparent",
      DELTA_BUCKET.POS1,
      delta[600],
      DELTA_BUCKET.POS2,
      delta[700],
      DELTA_BUCKET.POS3,
      delta[800],
      DELTA_BUCKET.POS4,
      delta[900]
    ]
  ] as unknown as Expression;

/**
 * Push a whole value set onto the source's features.
 *
 * Returns `false` — having changed nothing — when the source is not ready. A GeoJSON source
 * silently discards feature state set before it has finished loading, so the caller re-runs
 * this from the source's `sourcedata` event rather than assuming the first attempt landed.
 *
 * The previous set is cleared in one call before the new one is written, so a region that
 * dropped out of the payload does not keep rendering the value it had last tick.
 */
export const applyFeatureStates = (
  map: mapboxgl.Map,
  states: Map<string | number, MapFeatureState>
): boolean => {
  if (!map.getSource(PV_SOURCE_ID)) return false;
  if (!map.isSourceLoaded(PV_SOURCE_ID)) return false;

  map.removeFeatureState({ source: PV_SOURCE_ID });
  states.forEach((featureState, id) => {
    map.setFeatureState({ source: PV_SOURCE_ID, id }, featureState);
  });
  return true;
};
