import type { Expression } from "mapbox-gl";

import { COUNTRY_CONFIG, type MapBandThresholds } from "../../config/countries";
import { DELTA_BUCKET, DELTA_BUCKET_OPACITIES } from "../../constant";
import {
  DELTA_COOL,
  DELTA_COOL_MID,
  DELTA_MID_STOP,
  DELTA_NEUTRAL,
  DELTA_WARM,
  DELTA_WARM_MID,
  deltaExtent,
  deltaTopFor
} from "../../lib/domain/delta-ramp";
import { theme } from "../../tailwind.config";
import type { MapFeatureState } from "../helpers/data";
import { REGION_COUNTRY_PROPERTY } from "./country-features";
import { ActiveUnit } from "./types";
import { CapacityUnit, type OutputUnit } from "../helpers/map-mode";

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

const yellow = theme.extend.colors.solar.DEFAULT;

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
 * - **The ramp saturates at `PERCENT_RAMP_TOP`**, so anything at or above it is full strength,
 *   and `interpolate` clamps beyond its last stop.
 */
export const ZERO_OPACITY = BAND_OPACITIES[0];

/**
 * Fraction of installed capacity at which the percentage ramp reaches full opacity.
 *
 * **One value for every country, deliberately.** Percentage is *normalised* — it exists so a
 * region in Zeeland and a region in Devon can be read against each other — and a per-country top
 * would make 50% of capacity paint at two different opacities depending on which side of the
 * North Sea it fell on. That was proposed on 2026-08-17 (by analogy with `mapBands`, which *is*
 * per country) and rejected: megawatts are absolute and region sizes differ 48×, so MW bands have
 * no cross-country comparability to lose. This is the exact inverse case. Do not make it a
 * registry field.
 *
 * A consequence worth expecting rather than correcting: with both countries in frame **NL reads
 * systematically brighter than GB**, because its median capacity factor genuinely is higher (29%
 * against 21%). That is the signal, not an artefact.
 *
 * **Raised 0.7 → 0.8 on 2026-08-17.** Measured over every daytime region-slot of 14–16 Aug:
 *
 * | top | GB clamps | GB p99 as % of ramp | NL clamps | NL p99 as % of ramp |
 * |---|---|---|---|---|
 * | 0.70 | 0.1% | 92% | **7.5%** | 114% |
 * | 0.80 | 0.0% | 80% | 0.7% | 100% |
 *
 * At 0.7 NL clamped 7.5% of its daylight slots — hours around midday where every province
 * rendered identical full opacity and all spatial variation was lost. GB was already well
 * matched (p99 at 92% of the ramp; an earlier claim that GB's top third was "dead" was wrong,
 * and confused "rarely clamps" with "unused"). The trade is deliberate and asymmetric: clamping
 * *destroys* information, while the dimming GB pays for it (brightest regions at ~80% opacity
 * rather than ~92%) merely rescales what is still all there.
 *
 * **Still an August fit.** GB's December median is 6% of capacity against August's 35%, so no
 * single top serves both seasons — a winter map renders uniformly faint. Known and accepted
 * (Brad, 2026-08-17): the next move is either a seasonal amendment or making this user-settable,
 * and both are their own change. If it becomes user-settable it stays *one* setting, not one per
 * country, for the reason above.
 */
export const PERCENT_RAMP_TOP = 0.8;

/**
 * Reference values marked on the percentage legend, as fractions.
 *
 * These are *annotations on the ramp*, not thresholds — nothing in the paint expression steps at
 * them. They exist so the legend can still be read as numbers: matching a discrete swatch to a
 * polygon across two different backgrounds is a hard perceptual task, whereas reading a position
 * along a ramp is not, and ticks give the eye somewhere to land. Chosen as round numbers because
 * a measured comparison found rounding free: only the lowest value is load-bearing (moving it
 * from 3% to 5% doubled December's bottom-of-scale crowding), and it is kept low for that reason.
 *
 * The **last entry is `PERCENT_RAMP_TOP` itself**, referenced rather than repeated: it is the one
 * tick that is not an annotation but the end of the scale, and the legend places ticks at
 * `fraction / PERCENT_RAMP_TOP`, so a literal here would silently drift off the end of the ramp
 * the day the top moves. It did move (0.7 → 0.8) on 2026-08-17.
 */
export const NORMALIZED_TICKS = [0.03, 0.1, 0.2, 0.3, 0.4, 0.5, PERCENT_RAMP_TOP];

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
/**
 * Where the capacity ramp saturates for a country's tier, or `undefined` for a country this
 * build has no entry for. The capacity twin of `mapBandsFor`, and read by the legend so the
 * bar cannot describe a scale the map does not paint.
 */
export const capacityTopFor = (
  country: string | null | undefined,
  grouped: boolean
): number | undefined => {
  if (!country) return undefined;
  const tops = COUNTRY_CONFIG[country.toUpperCase()]?.mapBands.capacityTop;
  if (!tops) return undefined;
  return grouped ? tops.grouped ?? undefined : tops.region;
};

/**
 * Where the MW/km² ramp saturates: one scale for every country, split only by tier.
 *
 * Density is already normalised by area, so unlike MW a fixed scale means the same thing
 * everywhere, and one shared top is what makes the countries comparable (Brad, 2026-09-28).
 * DE's control areas are country-sized and read faint against it, which is true of them.
 *
 * The tier split is not a country difference: a rollup is summed capacity over summed area,
 * which averages out the dense urban regions, so a grouped top sits below the region one.
 * Measured on real capacity and geometry: the densest GB GSP is 0.80 (p99 0.51), NL's densest
 * province 0.99 (Zuid-Holland), TenneT 0.16; three GB DNO rollups sit just over 0.2 and clamp,
 * the other eleven run 0.006-0.18. The tops come from PR 772's MW/km² view.
 */
export const CAPACITY_DENSITY_TOP = { region: 1, grouped: 0.2 } as const;

/** The density top for one tier — `CAPACITY_DENSITY_TOP`, read the way `capacityTopFor` is. */
export const capacityDensityTopFor = (grouped: boolean): number =>
  grouped ? CAPACITY_DENSITY_TOP.grouped : CAPACITY_DENSITY_TOP.region;

/**
 * `value` rounded UP to one significant figure: 0.029 -> 0.03, 0.177 -> 0.2, 0.37 -> 0.4.
 *
 * A ramp's top is also the legend's end label, so it is worth a round number — and rounding up,
 * never to nearest, keeps the largest value inside the ramp rather than clamped at its end.
 */
export const tidyCeil = (value: number): number => {
  if (!(value > 0)) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  // `toPrecision` strips the float noise `ceil(x / m) * m` leaves (0.30000000000000004).
  return Number((Math.ceil(value / magnitude - 1e-9) * magnitude).toPrecision(12));
};

/**
 * Where one country's "% of national" ramp saturates: its largest region's share, `tidyCeil`ed.
 *
 * Derived from the data rather than configured, because a share has no natural scale of its
 * own — it depends on how many regions the country is cut into (a GB GSP is ~3% of GB, an NL
 * province ~18% of NL, a German TSO ~37% of Germany) and on which level is showing. A fixed
 * top would either saturate every DE region or leave every GB GSP near-invisible.
 *
 * Read off the same feature states the map paints, so it is always the top of the tier the
 * country is actually drawn at: a GB user on the DNO rollup gets the rollups' largest share.
 * `undefined` while no region has a share yet (capacity or national total not arrived).
 */
export const capacityShareTopOf = (
  states: Iterable<Pick<MapFeatureState, "capacityShare">>
): number | undefined => {
  let largest = 0;
  for (const state of states) largest = Math.max(largest, state.capacityShare);
  return largest > 0 ? tidyCeil(largest) : undefined;
};

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

/**
 * The megawatt ramp, now continuous like the percentage one (Brad, this session: the stepped
 * version "looks and feels" worse beside it).
 *
 * The country's thresholds survive as the ramp's TOP and as the legend's tick marks: the top
 * band's floor is where the ramp saturates, so the fullest colour still means what the top
 * pill used to mean, and every value below it now reads as a position on a scale rather than
 * as one of six buckets. `interpolate` clamps past its last stop, so a region above the top
 * threshold draws at full rather than overshooting.
 */
const bandExpression = (input: Expression, thresholds: readonly number[]): Expression => {
  const top = thresholds[thresholds.length - 1];
  return ["interpolate", ["linear"], input, 0, ZERO_OPACITY, top, 1] as unknown as Expression;
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
/**
 * A capacity ramp, per country and per tier: the same shape as the output ramp, saturating at
 * the country's own top instead. Installed capacity is several times the output a region ever
 * reaches, so the two cannot share a top without one of them being useless.
 *
 * `topsOf` names the tops per country — `capacityTop` for MW, `CAPACITY_DENSITY_TOP` for MW/km²,
 * the derived share tops for "% of national". A country with no grouped top emits no `case`,
 * as in `countryAwareBands` below.
 */
const countryAwareCapacity = (
  input: Expression,
  topsOf: (code: string) => { region: number; grouped: number | null }
): Expression => {
  const arms: unknown[] = [];
  Object.keys(COUNTRY_CONFIG).forEach((code) => {
    const { region, grouped } = topsOf(code);
    const ramp = (top: number): Expression =>
      ["interpolate", ["linear"], input, 0, ZERO_OPACITY, top, 1] as unknown as Expression;
    arms.push(
      code,
      grouped
        ? ["case", ["==", ["feature-state", "grouped"], true], ramp(grouped), ramp(region)]
        : ramp(region)
    );
  });
  return [
    "match",
    ["get", REGION_COUNTRY_PROPERTY],
    ...arms,
    UNBANDED_COUNTRY_OPACITY
  ] as unknown as Expression;
};

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
 * Takes only the output units: capacity is its own mode with its own units, painted by
 * `capacityFillOpacityExpression` below. It used to be a third unit here, which is how a
 * capacity unit could be asked of a delta fill in the first place.
 */
export const fillOpacityExpression = (unit: OutputUnit): Expression => {
  // Both are continuous ramps. What differs is where each saturates: percentage at a fraction
  // of capacity, MW at the country's top output threshold.
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

export const fillColorExpression = (): Expression => {
  return [
    "case",
    ["==", ["feature-state", "dataState"], "no-data"],
    NO_DATA_COLOR,
    yellow
  ] as unknown as Expression;
};

/**
 * Where each country's "% of national" ramp saturates, by country code — `capacityShareTopOf`
 * for each enabled country. A country missing from it has no shares yet, and ramps to 100%.
 */
export type CapacityShareTops = Readonly<Record<string, number>>;

/**
 * `fill-opacity` for the capacity mode, in any of its three units.
 *
 * Not gated on `dataState`: installed capacity is known for every region whether or not it
 * has published a reading, so gating it would blank the capacity view every time the newest
 * slot was mid-fill.
 *
 * - **MW** saturates at the registry's `capacityTop`, per country and tier.
 * - **MW/km²** at `CAPACITY_DENSITY_TOP`, the same for every country, per tier. A rollup's density is summed
 *   capacity over summed area (`rollUpRegionValues`), which averages out the dense urban
 *   regions — hence a grouped top below the region one.
 * - **% of national** at the country's derived top (`capacityShareTopOf`). One arm per country
 *   with no `grouped` case: the top is read off whichever tier the country is drawn at, so it
 *   is already that tier's.
 */
export const capacityFillOpacityExpression = (
  unit: CapacityUnit,
  shareTops: CapacityShareTops = {}
): Expression => {
  switch (unit) {
    case CapacityUnit.MW:
      return countryAwareCapacity(
        state("capacity"),
        (code) => COUNTRY_CONFIG[code].mapBands.capacityTop
      );
    case CapacityUnit.density:
      return countryAwareCapacity(
        state("capacityDensity"),
        // Same tops for every country; the grouped arm only where a country has a grouped tier,
        // so the per-country `match` keeps that structural guarantee.
        (code) => ({
          region: CAPACITY_DENSITY_TOP.region,
          grouped: COUNTRY_CONFIG[code].mapBands.grouped ? CAPACITY_DENSITY_TOP.grouped : null
        })
      );
    case CapacityUnit.shareOfNational:
      return countryAwareCapacity(state("capacityShare"), (code) => ({
        region: shareTops[code] ?? 1,
        grouped: null
      }));
  }
};

/** Capacity is never "no data" — see `capacityFillOpacityExpression` — so it is one flat yellow. */
export const capacityFillColorExpression = (): Expression => yellow as unknown as Expression;

const delta = theme.extend.colors["ocf-delta"];

/** The scale's numbers and poles live in `lib/domain/delta-ramp.ts`; see there for why. */
const deltaValue = (normalized: boolean): Expression =>
  [
    "coalesce",
    ["feature-state", normalized ? "deltaNormalized" : "delta"],
    0
  ] as unknown as Expression;

/**
 * Build a delta ramp per feature on the MW scale: `match` on the feature's country, then a
 * `case` on the feature-state `grouped` flag for a country that has a grouped tier — the same
 * shape as `countryAwareBands`, and for the same reason (one source draws every enabled country,
 * each at its own level). Each arm's top is `deltaTopFor`, which the legend, the bucketer and
 * the delta panel read too, so no surface can saturate somewhere the fill does not.
 *
 * The fallback is `deltaTopFor`'s own answer for a country it does not know (the global ±100),
 * so the expression and the lookup cannot disagree even there.
 */
const countryAwareDelta = (ramp: (top: number) => Expression): Expression => {
  const arms: unknown[] = [];
  Object.entries(COUNTRY_CONFIG).forEach(([code, config]) => {
    arms.push(
      code,
      config.mapBands.grouped
        ? [
            "case",
            ["==", ["feature-state", "grouped"], true],
            ramp(deltaTopFor(code, true)),
            ramp(deltaTopFor(code, false))
          ]
        : ramp(deltaTopFor(code, false))
    );
  });
  return [
    "match",
    ["get", REGION_COUNTRY_PROPERTY],
    ...arms,
    ramp(deltaTopFor(undefined, false))
  ] as unknown as Expression;
};

/**
 * Percentage mode is one scale for every country (a fraction of each region's own capacity);
 * MW is each country's and tier's own, per feature. See `deltaTopFor` for why MW cannot be one.
 */
const deltaScale = (normalized: boolean, ramp: (top: number) => Expression): Expression =>
  normalized ? ramp(deltaExtent(true)) : countryAwareDelta(ramp);

/**
 * `fill-color` for the delta layer, as a continuous ramp over the raw delta.
 *
 * `hasDelta` is false for a future slot and for a region where either side is missing; those
 * are drawn as nothing rather than as a delta of zero, which is what the v0 code showed.
 *
 * `normalized` switches which delta is read — percentage mode ramps `deltaNormalized` against
 * a fraction of capacity, everything else the megawatt `delta` against the feature's own
 * country and tier's top (`countryAwareDelta`). The colours and the transparent middle are
 * identical either way. Switching the unit is therefore one `setPaintProperty` against feature
 * state that is already on every feature — no refetch, no value rebuild. See
 * `DELTA_PERCENTAGE_EDGES` for why the second scale exists.
 */
export const deltaFillColorExpression = (normalized = false): Expression => {
  // Five stops, following the brand kit's gradient out from zero — Blue, Sky Blue, the
  // map's own black, Yellow, Orange. `deltaRampColor` mixes the same five for every
  // surface off the map, so a chip and a region at the same delta are the same colour.
  const ramp = (extent: number): Expression =>
    [
      "interpolate",
      ["linear"],
      deltaValue(normalized),
      -extent,
      DELTA_COOL,
      -extent * DELTA_MID_STOP,
      DELTA_COOL_MID,
      0,
      DELTA_NEUTRAL,
      extent * DELTA_MID_STOP,
      DELTA_WARM_MID,
      extent,
      DELTA_WARM
    ] as unknown as Expression;
  return [
    "case",
    ["!=", ["feature-state", "hasDelta"], true],
    "transparent",
    deltaScale(normalized, ramp)
  ] as unknown as Expression;
};

/**
 * `fill-opacity` for the delta layer: magnitude, so the eye can rank without the legend.
 *
 * Reads the same delta against the same per-feature top the colour does, and the two must be
 * built with the same `normalized` flag or a region draws one scale's hue at the other scale's
 * strength.
 *
 * Zero draws as nothing: a difference too small to register is ordinary forecast noise, exactly
 * as a region with no delta is. Those two look the same on purpose — neither is a finding — and
 * the popup still distinguishes them ("no delta yet" vs a figure).
 */
export const deltaFillOpacityExpression = (normalized = false): Expression => {
  // Magnitude, continuous: nothing at zero so ordinary forecast noise stays invisible, rising
  // to the 0.85 the OUTERMOST bucket used to paint — `DELTA_BUCKET_OPACITIES[0]` is the
  // innermost 0.35, and reading the ladder from the wrong end ran the whole scale at 40% of
  // its intended strength.
  //
  // Square root rather than linear, matching `deltaRampOpacity`: on a straight line everything
  // below half the scale was too faint to read.
  const top = DELTA_BUCKET_OPACITIES[DELTA_BUCKET_OPACITIES.length - 1];
  const ramp = (extent: number): Expression =>
    [
      "interpolate",
      ["linear"],
      ["sqrt", ["/", ["abs", deltaValue(normalized)], extent]],
      0,
      0,
      1,
      top
    ] as unknown as Expression;
  return deltaScale(normalized, ramp);
};

const deltaFillOpacityStepped = (normalized = false): Expression =>
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
