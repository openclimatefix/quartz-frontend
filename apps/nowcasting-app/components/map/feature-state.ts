import type { Expression } from "mapbox-gl";

import { COUNTRY_CONFIG, type MapBandThresholds } from "../../config/countries";
import { DELTA_BUCKET, DELTA_BUCKET_OPACITIES } from "../../constant";
import { theme } from "../../tailwind.config";
import type { MapFeatureState } from "../helpers/data";
import { REGION_COUNTRY_PROPERTY } from "./country-features";
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
export const BAND_OPACITIES = [0.03, 0.2, 0.4, 0.6, 0.8, 1];

/**
 * Percentage mode is a **continuous ramp**, not bands (2026-08-15).
 *
 * Six fixed bands could not serve a quantity whose distribution moves this much across the year.
 * Measured over six days, two countries and two seasons: at 06:00 in August every GB region sat
 * inside the bottom band while genuinely spanning 0–16%; at noon in December roughly half the
 * country sat there all day, with the top three bands never reached. Re-placing the thresholds
 * helped, but every candidate set was tuned to whichever days it was fitted on — and December's
 * median (6% of capacity) against August's (35%) means no single set is right year-round.
 *
 * A ramp has no thresholds to mistune. It also serves what the map is *for*: the control room
 * describes the value as watching brightening "moving across the country", and banding turns
 * travel into a series of jumps as regions cross a threshold.
 *
 * Two properties are deliberately preserved from the banded version:
 *
 * - **`ZERO_OPACITY` is the ramp's bottom stop**, so a region generating a real 0 still draws at
 *   3% rather than vanishing — audit B8's distinction, and the reason a night map reads as dark
 *   rather than empty. Brad's call to keep 3% rather than raise it.
 * - **The ramp saturates at `PERCENT_RAMP_TOP`**, matching the old top band, so anything at or
 *   above 70% of capacity is full strength. GB reaches this rarely and NL routinely; both are
 *   correct, and `interpolate` clamps beyond its last stop.
 */
export const ZERO_OPACITY = BAND_OPACITIES[0];

/** Fraction of installed capacity at which the percentage ramp reaches full opacity. */
export const PERCENT_RAMP_TOP = 0.7;

/**
 * Reference values marked on the percentage legend, as fractions.
 *
 * These are *annotations on the ramp*, not thresholds — nothing in the paint expression steps at
 * them. They exist so the legend can still be read as numbers: matching a discrete swatch to a
 * polygon across two different backgrounds is a hard perceptual task, whereas reading a position
 * along a ramp is not, and ticks give the eye somewhere to land. Chosen as round numbers because
 * a measured comparison found rounding free: only the lowest value is load-bearing (moving it
 * from 3% to 5% doubled December's bottom-of-scale crowding), and it is kept low for that reason.
 */
export const NORMALIZED_TICKS = [0.03, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7];

/**
 * Opacity for a feature whose country this build has no bands for.
 *
 * `match` needs a fallback and this is it. It should be unreachable: the map's source is fed
 * by `stampCountryFeatures`, which stamps `country` on every feature, and the fan-out draws
 * `useEnabledCountries()`, which is enabled ∩ *configured*. Full opacity is chosen so that if
 * it ever is reached the map is conspicuously, uniformly wrong rather than plausibly faint —
 * the failure being fixed here was a country rendering as "almost nothing" and nobody
 * noticing, so the fallback must not be able to look like a quiet answer.
 */
export const UNBANDED_COUNTRY_OPACITY = 1;

/**
 * The MW thresholds for one country at one tier, or `undefined` if there are none.
 *
 * The single lookup both halves of the feature go through: the paint expression below builds
 * its steps from it, and `ColorGuideBar` labels its pills from it. `undefined` for a country
 * with no registry entry, and for the grouped tier of a country with no groupings — which is a
 * real answer ("this country has no such level"), not a reason to borrow another country's.
 */
export const mapBandsFor = (
  country: string | null | undefined,
  grouped: boolean
): MapBandThresholds | undefined => {
  if (typeof country !== "string") return undefined;
  const bands = COUNTRY_CONFIG[country.toUpperCase()]?.mapBands;
  if (!bands) return undefined;
  return grouped ? bands.grouped ?? undefined : bands.region;
};

/** `1500` -> `"1.5k"`, `4000` -> `"4k"`, `450` -> `"450"`. Presentation only. */
const formatBand = (value: number): string =>
  value < 1000 ? String(value) : `${Number((value / 1000).toFixed(1))}k`;

/**
 * The legend's six labels for a threshold set: `["0-50", "50-150", …, "450+"]`.
 *
 * Lives here, next to `bandExpression`, because it exists to make the legend and the paint
 * expression incapable of disagreeing. They were two hand-maintained copies of the same five
 * numbers — the map could be drawn one way and explained another, and with per-country bands
 * that stops being a theoretical risk. One array in, both the steps and the labels out.
 */
export const bandLabels = (thresholds: readonly number[]): string[] => [
  `0-${formatBand(thresholds[0])}`,
  ...thresholds
    .slice(1)
    .map((value, index) => `${formatBand(thresholds[index])}-${formatBand(value)}`),
  `${formatBand(thresholds[thresholds.length - 1])}+`
];

/** The percentage legend's tick labels — `["3", "10", …, "70"]`, to sit under the ramp. */
export const normalizedTickLabels = (): string[] =>
  NORMALIZED_TICKS.map((fraction) => String(Math.round(fraction * 100)));

/**
 * The percentage ramp: linear from a real zero at `ZERO_OPACITY` to full at `PERCENT_RAMP_TOP`.
 *
 * `interpolate` clamps outside its stops, so a region above 70% of capacity draws at 1 rather
 * than overshooting — which matters because capacity registers lag and observed values above
 * 100% do occur.
 */
const continuousOpacity = (input: Expression): Expression =>
  ["interpolate", ["linear"], input, 0, ZERO_OPACITY, PERCENT_RAMP_TOP, 1] as unknown as Expression;

const bandExpression = (input: Expression, thresholds: readonly number[]): Expression => {
  const expression: unknown[] = ["step", input, BAND_OPACITIES[0]];
  thresholds.forEach((threshold, index) => {
    expression.push(threshold, BAND_OPACITIES[index + 1]);
  });
  return expression as unknown as Expression;
};

const state = (key: keyof MapFeatureState): Expression =>
  ["coalesce", ["feature-state", key], 0] as unknown as Expression;

/**
 * Pick a band expression per feature: first on the feature's country, then on the
 * feature-state `grouped` flag.
 *
 * Both choices are per feature, and for the same reason. The map draws every *enabled*
 * country in one source, each at its own aggregation level, so a single frame can hold a GB
 * DNO rollup (thousands of MW) next to an NL province (also thousands, but on NL's scale) next
 * to a GB GSP (hundreds). Neither an `isGrouped` argument nor a per-country layer can describe
 * that: an argument gets one of them wrong, and a layer per country makes the count of
 * countries visible to the click handler, the select-borders filter and the `beforeId` search
 * (see `use-enabled-country-map-data.tsx`). Adding to the expression is free; adding a layer
 * is not.
 *
 * The country comes from `["get", REGION_COUNTRY_PROPERTY]` — a feature *property*, stamped by
 * `stampCountryFeatures`, not feature state. It is already there, it never changes while the
 * feature exists, and it costs nothing per tick. `grouped` genuinely does change (the user
 * switches level) and stays in feature state.
 *
 * A country with no grouped tier emits no `case` at all, so it is structurally incapable of
 * picking up another country's grouped numbers.
 */
const countryAwareBands = (input: Expression): Expression => {
  const arms: unknown[] = [];
  Object.entries(COUNTRY_CONFIG).forEach(([code, config]) => {
    const { region, grouped } = config.mapBands;
    arms.push(
      code,
      grouped
        ? [
            "case",
            ["==", ["feature-state", "grouped"], true],
            bandExpression(input, grouped),
            bandExpression(input, region)
          ]
        : bandExpression(input, region)
    );
  });
  return [
    "match",
    ["get", REGION_COUNTRY_PROPERTY],
    ...arms,
    UNBANDED_COUNTRY_OPACITY
  ] as unknown as Expression;
};

/**
 * `fill-opacity` for the forecast layer.
 *
 * Capacity mode is not gated on `dataState`: installed capacity is known for every region
 * whether or not it has published a reading, so gating it would blank the capacity view
 * every time the newest slot was mid-fill.
 */
export const fillOpacityExpression = (unit: ActiveUnit): Expression => {
  if (unit === ActiveUnit.capacity) {
    return countryAwareBands(state("capacity"));
  }

  // Percentage is continuous; MW and capacity stay banded. They are absolute megawatts on a
  // per-country scale, so their bands are a registry fact rather than a fitted guess, and the
  // seasonal-mistuning argument above does not apply to them in the same way.
  const valueOpacity =
    unit === ActiveUnit.percentage
      ? continuousOpacity(state("normalized"))
      : countryAwareBands(state("power"));

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
 *
 * `normalized` switches which of the two pre-computed buckets is read — percentage mode steps
 * on `deltaBucketNormalized`, everything else on the megawatt `deltaBucket`. The steps, the
 * colours and the transparent middle are identical either way, because `DELTA_BUCKET`'s members
 * are ordinals here and only the *bucketer* knows they mean megawatts. Switching the unit is
 * therefore one `setPaintProperty` against feature state that is already on every feature — no
 * refetch, no value rebuild. See `DELTA_PERCENTAGE_EDGES` for why the second scale exists.
 */
export const deltaFillColorExpression = (normalized = false): Expression =>
  [
    "case",
    ["!=", ["feature-state", "hasDelta"], true],
    "transparent",
    [
      "step",
      ["coalesce", ["feature-state", normalized ? "deltaBucketNormalized" : "deltaBucket"], 0],
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
 * `fill-opacity` for the delta layer: magnitude, so the eye can rank without the legend.
 *
 * Steps on the same bucket the colour does — which means it steps on `deltaBucketNormalized` in
 * percentage mode, and the two must be built with the same `normalized` flag or a region draws
 * one scale's hue at the other scale's strength.
 *
 * The neutral bucket is `0`: a difference below the first edge is ordinary forecast noise and
 * draws as nothing, exactly as a region with no delta does. Those two look the same on purpose —
 * neither is a finding — and the popup still distinguishes them ("no delta yet" vs a figure).
 */
export const deltaFillOpacityExpression = (normalized = false): Expression =>
  [
    "step",
    ["coalesce", ["feature-state", normalized ? "deltaBucketNormalized" : "deltaBucket"], 0],
    DELTA_BUCKET_OPACITIES[3],
    DELTA_BUCKET.NEG3,
    DELTA_BUCKET_OPACITIES[2],
    DELTA_BUCKET.NEG2,
    DELTA_BUCKET_OPACITIES[1],
    DELTA_BUCKET.NEG1,
    DELTA_BUCKET_OPACITIES[0],
    DELTA_BUCKET.ZERO,
    0,
    DELTA_BUCKET.POS1,
    DELTA_BUCKET_OPACITIES[0],
    DELTA_BUCKET.POS2,
    DELTA_BUCKET_OPACITIES[1],
    DELTA_BUCKET.POS3,
    DELTA_BUCKET_OPACITIES[2],
    DELTA_BUCKET.POS4,
    DELTA_BUCKET_OPACITIES[3]
  ] as unknown as Expression;

/** Shallow equality over a feature state's own keys — all values are primitives. */
const sameFeatureState = (a: MapFeatureState, b: MapFeatureState): boolean => {
  const keys = Object.keys(a) as (keyof MapFeatureState)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
};

/**
 * Push a value set onto the source's features, writing only what actually changed.
 *
 * Returns `false` — having changed nothing — when the source is not ready. A GeoJSON source
 * silently discards feature state set before it has finished loading, so the caller re-runs
 * this from the source's `sourcedata` event rather than assuming the first attempt landed.
 *
 * `previous` is the set this map last had applied, or `null` when the caller cannot vouch for
 * what is on the map — a fresh source, or geometry that has just reloaded, which silently
 * drops all feature state. With `null` this does what it always did: blanket-clear, then
 * write everything.
 *
 * With a `previous` set it diffs instead, and that is the whole point. The blanket
 * `removeFeatureState` invalidates every feature in the source and is paid *in addition* to
 * rewriting them, so the old path cost two full passes over ~332 features for GB and ~664
 * with NL enabled — on every cursor tick. Holding an arrow key at the OS repeat rate made
 * that tens of times a second, which is what made the cursor feel heavy once Track F drew a
 * second country. Ids that vanish from the payload are cleared individually, which is what
 * the blanket clear was really there for.
 */
export const applyFeatureStates = (
  map: mapboxgl.Map,
  states: Map<string | number, MapFeatureState>,
  previous?: Map<string | number, MapFeatureState> | null
): boolean => {
  if (!map.getSource(PV_SOURCE_ID)) return false;
  if (!map.isSourceLoaded(PV_SOURCE_ID)) return false;

  if (!previous) {
    map.removeFeatureState({ source: PV_SOURCE_ID });
    states.forEach((featureState, id) => {
      map.setFeatureState({ source: PV_SOURCE_ID, id }, featureState);
    });
    return true;
  }

  states.forEach((featureState, id) => {
    const before = previous.get(id);
    if (before && sameFeatureState(before, featureState)) return;
    map.setFeatureState({ source: PV_SOURCE_ID, id }, featureState);
  });
  previous.forEach((_before, id) => {
    if (!states.has(id)) map.removeFeatureState({ source: PV_SOURCE_ID, id });
  });
  return true;
};
