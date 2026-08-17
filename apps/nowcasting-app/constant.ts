// export const API_PREFIX = "http://localhost:8000/v0";
export const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX || "https://api-dev.quartz.solar/v0";
export const SITES_API_PREFIX =
  process.env.NEXT_PUBLIC_SITES_API_PREFIX || "https://api-site-dev.quartz.solar";
// Production is the only host the current token works against — dev hosts sit behind a
// different Auth0 tenant, so there is no working dev default to fall back to here.
export const API_V1_PREFIX = process.env.NEXT_PUBLIC_API_V1_PREFIX || "https://api.quartz.solar/v1";
export const MAX_POWER_GENERATED = 500;
export const MAX_NATIONAL_GENERATION_MW = 13500;

// Static constant below of this function so we don't call dynamically unnecessarily.
// import { generateYMaxTickArray } from "./components/helpers/chartUtils";
// console.log("Y_MAX_TICKS", generateYMaxTickArray());
//
// We want to have the yMax of the graph to be related to the capacity of the GspPvRemixChart.
// If we use the raw values, the graph looks funny, i.e y major ticks are 0 100 232
// So, we round these up to the following numbers, which hopefully split nicely into the y-axis.
// Uncomment the above function to get updated values should we need to change these
export const Y_MAX_TICKS = [
  1, 2, 3, 4, 5, 6, 9, 10, 12, 15, 18, 20, 25, 30, 40, 45, 50, 60, 75, 80, 90, 100, 150, 200, 250,
  300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000,
  6000, 7000, 7500, 8000, 9000, 10000, 11000, 12000, 12500, 13000, 14000, 15000
];

// The **sites view's** zoom bands. Not the region hierarchy.
//
// These were a GB-shaped shim for the region hierarchy; Phase 5 finished that migration and
// the country-derived list in `components/helpers/aggregationLevels.ts` is now the only
// source of truth for what levels a country has and at what zoom. What is left here is the
// solar-sites view, which is a genuinely different thing: it aggregates *sites* (points from
// the sites API) by zoom, not regions by hierarchy, and SITE has no region layer at all.
//
// `aggregationLevels.test.ts` still pins GB's derived bands equal to these, so the two
// cannot drift while the sites view continues to use them. Do not add new call sites outside
// the sites view — for anything region-shaped, use `AggregationLevel`.
export enum AGGREGATION_LEVELS {
  NATIONAL = "NATIONAL",
  REGION = "REGION",
  GSP = "GSP",
  SITE = "SITE"
}

export enum AGGREGATION_LEVEL_MIN_ZOOM {
  NATIONAL = 0,
  REGION = 5,
  GSP = 7,
  SITE = 8.5
}
export enum AGGREGATION_LEVEL_MAX_ZOOM {
  NATIONAL = AGGREGATION_LEVEL_MIN_ZOOM.REGION,
  REGION = AGGREGATION_LEVEL_MIN_ZOOM.GSP,
  GSP = AGGREGATION_LEVEL_MIN_ZOOM.SITE,
  SITE = 14
}

export enum SORT_BY {
  NAME = "NAME",
  GENERATION = "GENERATION",
  CAPACITY = "CAPACITY",
  YIELD = "YIELD"
}

export enum DELTA_BUCKET {
  NEG4 = -100,
  NEG3 = -75,
  NEG2 = -50,
  NEG1 = -25,
  ZERO = 0,
  POS1 = 25,
  POS2 = 50,
  POS3 = 75,
  POS4 = 100
}
export const getDeltaBucketKeys = () => Object.keys(DELTA_BUCKET).filter((k) => isNaN(Number(k)));

/**
 * The delta scale in **fractions of installed capacity**, for percentage mode.
 *
 * `DELTA_BUCKET` above is fixed megawatts, and fixed megawatts cannot serve two countries — or,
 * as it turns out, one. Measured over 14–16 Aug 2026, every daytime region-slot in both
 * countries, against the current ±25…±100 MW edges:
 *
 * | | neutral bucket | outer buckets |
 * |---|---|---|
 * | GB (338 GSPs) | **96%** | 0.4% |
 * | NL (12 provinces) | 20% | **45.5%** |
 *
 * The GB delta map is 96% grey because 200 of 338 GSPs have less *total installed capacity*
 * than the ±25 MW first edge — they cannot leave the neutral bucket by any physically possible
 * error. NL fails the opposite way: nearly half its slots pin to the outer buckets, so the
 * extremes stop meaning "extreme". One constant, both failure modes, and no megawatt number
 * exists that fixes both. (This also answers §4 of `phase6-followup-outstanding.md`: Dan's
 * instinct that ±100 is wrong is right, but ±80 is the same mistake at a different value.)
 *
 * As a share of capacity the two countries almost agree — median |delta| is 3.2% for GB and
 * 5.1% for NL — which is what makes a *single* percentage scale possible. These edges put GB at
 * 38% neutral / 5.0% outer and NL at 27% / 7.5%, with all nine buckets populated in both.
 *
 * Chosen round and roughly doubling rather than fitted to the percentiles, because the sample is
 * three days of one season. **GB and NL only** — a third country should be checked against this,
 * not assumed onto it.
 *
 * **Widened from ±2/5/10/20% on 2026-08-16** (Brad, on seeing it live: "we're showing a little
 * too much deviation ... it's a regional forecast of weather, so there's going to be some
 * swing"). The first set was fitted to make all nine buckets busy, which is the wrong target: a
 * regional solar forecast has an irreducible noise floor, and colouring it makes ordinary
 * weather look like error. These edges put GB at 63% neutral / 1.0% outer and NL at 49% / 4.8%.
 * Paired with `DELTA_BUCKET_OPACITIES` below, which is the other half of the same fix.
 */
export const DELTA_PERCENTAGE_EDGES = [0.05, 0.1, 0.2, 0.35] as const;

/**
 * `fill-opacity` per bucket, from the first step outward. The neutral bucket is not here — it
 * paints transparent.
 *
 * Delta used to draw at a flat `0.7` on the reasoning that hue already carries both sign and
 * magnitude, so opacity was free. It is not free: at a constant opacity a region 5% off its
 * capacity is painted exactly as solidly as one 35% off, so the map reads as uniformly alarmed
 * and the eye cannot rank what it is seeing without going to the legend. The sequential map has
 * always known this — its ramp runs from 3% to full so small values recede.
 *
 * The spread is deliberately gentle (0.35→0.85, not 0.15→1). Brad's steer was "less severe":
 * the first bucket must still read as *present* — it is a real difference and often the
 * interesting one — just quieter than the extremes. Ranking, not suppression.
 */
export const DELTA_BUCKET_OPACITIES = [0.35, 0.52, 0.68, 0.85] as const;

/** The nine buckets in scale order, cold to hot. The order the ordinals actually mean. */
export const DELTA_BUCKET_ORDER: DELTA_BUCKET[] = [
  DELTA_BUCKET.NEG4,
  DELTA_BUCKET.NEG3,
  DELTA_BUCKET.NEG2,
  DELTA_BUCKET.NEG1,
  DELTA_BUCKET.ZERO,
  DELTA_BUCKET.POS1,
  DELTA_BUCKET.POS2,
  DELTA_BUCKET.POS3,
  DELTA_BUCKET.POS4
];

/**
 * The numeric edge a bucket represents, in the unit being displayed.
 *
 * Three surfaces label these buckets — the map legend, the map popup and the delta panel's
 * count tiles — and before this they each knew that a bucket's *enum value* was its megawatt
 * edge. That stops being true in percentage mode, where the enum is a bare ordinal, so the
 * lookup lives here once rather than as three copies that can disagree about the same cell.
 */
export const deltaBucketEdge = (bucket: DELTA_BUCKET, asPercentage: boolean): number => {
  if (!asPercentage) return Number(bucket);
  const index = DELTA_BUCKET_ORDER.indexOf(bucket);
  if (index === 4 || index === -1) return 0;
  return index < 4
    ? -DELTA_PERCENTAGE_EDGES[3 - index] * 100
    : DELTA_PERCENTAGE_EDGES[index - 5] * 100;
};

export const N_HOUR_FORECAST_OPTIONS = [1, 2, 4, 8];

export const P_LEVEL_OPTIONS: [number, number][] = [
  [2, 98],
  [10, 90],
  [25, 75]
];
