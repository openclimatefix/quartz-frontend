import { COUNTRY_CONFIG } from "../../config/countries";
import { DELTA_BUCKET, DELTA_PERCENTAGE_EDGES } from "../../constant";

/**
 * The delta scale, as one continuous diverging ramp.
 *
 * The poles are the brand kit's Blue and Orange — the ends of its own gradient. The MIDDLE is
 * deliberately NOT the kit's teal: a diverging scale's midpoint has to be neutral, or "no
 * difference" becomes a colour in its own right and the eye cannot find zero. It is a grey
 * near the map's ground instead.
 *
 * One module because four surfaces draw this scale — the map fill, the dock legend, the delta
 * chip and the bucket rows — and they were four hand-kept copies of a nine-step palette. A
 * ramp cannot be copied by hand at all, so it has to live in one place.
 */
/**
 * The ramp follows the brand kit's own gradient on the way out from zero, rather than fading
 * a single hue: Sky Blue then Blue going cold, Yellow then Orange going hot. A delta halfway
 * to saturation therefore has a colour of its own instead of being a washed-out pole, which
 * is what made the middle of the scale unreadable.
 */
export const DELTA_COOL_MID = "#65B0C9";
export const DELTA_COOL = "#4675C1";
export const DELTA_WARM_MID = "#FFD480";
// The map's own ground, not a mid grey: the midpoint should VANISH — a delta too small to
// mean anything is not a finding, and painting it a distinct grey made it one. It also keeps
// the scale inside the reskin's blacks, where #6C6C6C was left over from the old palette.
export const DELTA_NEUTRAL = "#282A2A";
export const DELTA_WARM = "#FAA056";

/**
 * Where each side's mid stop sits, as a fraction of the way out to saturation. Exported
 * because the map builds its own Mapbox `interpolate` from the same five stops.
 */
export const DELTA_MID_STOP = 0.5;

/**
 * Where the ramp saturates: a fraction of installed capacity, or the GLOBAL ±100 MW.
 *
 * The megawatt half is now only for things that are not a country's regions — solar sites —
 * and for percentage mode's twin. Every country-facing MW surface goes through `deltaTopFor`.
 */
export const deltaExtent = (normalized: boolean): number =>
  normalized ? DELTA_PERCENTAGE_EDGES[DELTA_PERCENTAGE_EDGES.length - 1] : DELTA_BUCKET.POS4;

/**
 * The output threshold the ±100 MW delta scale was tuned against: GB's region-tier top band
 * (`mapBands.region`'s last entry). A literal, not a lookup, because it records a calibration
 * — the pairing "450 MW of output top goes with 100 MW of delta top" — and retuning GB's bands
 * later should move GB's delta scale with them, not silently re-anchor every other country.
 */
const DELTA_CALIBRATION_OUTPUT_TOP = 450;

/**
 * MW of delta saturation per MW of a tier's top output threshold: 100 / 450.
 *
 * A single global ±100 MW suits GB's GSPs and nothing else — DE's TSO regions are GW-scale, NL's
 * provinces run to thousands, and GB's own DNO / NG-zone rollups sum hundreds of GSPs. Each tier
 * already declares how big its regions get, as `mapBands`; scaling the delta top off that keeps
 * the delta ramp in the same proportion to a region's output that GB's GSPs had, with no second
 * set of per-country numbers to keep in step with the first.
 */
export const DELTA_TOP_PER_OUTPUT_TOP = DELTA_BUCKET.POS4 / DELTA_CALIBRATION_OUTPUT_TOP;

/**
 * Where the MW delta ramp saturates for one country's tier: its top output threshold ×
 * `DELTA_TOP_PER_OUTPUT_TOP`, rounded to whole MW (GB region 100, GB grouped 1000, NL 800,
 * DE 3000).
 *
 * The global ±100 for a country this build has no entry for — the same fall-through
 * `capacityTopFor` makes, except that it answers a number rather than `undefined`, because
 * every caller here draws something regardless. The grouped tier of a country with no
 * groupings cannot be on screen; asked anyway, it answers the region tier's top.
 */
export const deltaTopFor = (country: string | null | undefined, grouped: boolean): number => {
  const bands = country ? COUNTRY_CONFIG[country.toUpperCase()]?.mapBands : undefined;
  const thresholds = bands ? (grouped ? bands.grouped ?? bands.region : bands.region) : undefined;
  if (!thresholds) return DELTA_BUCKET.POS4;
  return Math.round(thresholds[thresholds.length - 1] * DELTA_TOP_PER_OUTPUT_TOP);
};

const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16)) as [
    number,
    number,
    number
  ];
};

const mix = (from: string, to: string, ratio: number): [number, number, number] => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return [0, 1, 2].map((index) => Math.round(a[index] + (b[index] - a[index]) * ratio)) as [
    number,
    number,
    number
  ];
};

/**
 * The ramp's colour for one delta, as CSS. Clamped at both ends, exactly as the map's
 * `interpolate` clamps — a region twice as far off as the scale's end paints like one at it.
 */
export const deltaRampColor = (value: number, extent: number): string => {
  const clamped = Math.max(-1, Math.min(1, extent === 0 ? 0 : value / extent));
  const magnitude = Math.abs(clamped);
  const [near, far] = clamped < 0 ? [DELTA_COOL_MID, DELTA_COOL] : [DELTA_WARM_MID, DELTA_WARM];
  const [r, g, b] =
    magnitude <= DELTA_MID_STOP
      ? mix(DELTA_NEUTRAL, near, magnitude / DELTA_MID_STOP)
      : mix(near, far, (magnitude - DELTA_MID_STOP) / (1 - DELTA_MID_STOP));
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Strength for one delta: nothing at zero, so ordinary forecast noise recedes, rising to
 * `topOpacity` at saturation.
 *
 * The climb is a square root, not a straight line. Linear left everything below about half
 * the scale too faint to read — half the magnitude is half the strength, and half of a low
 * top opacity is nothing at all. The curve gives the middle of the scale most of its colour
 * while leaving the smallest deltas where they belong, which is barely there.
 */
export const deltaRampOpacity = (value: number, extent: number, topOpacity: number): number =>
  extent === 0 ? 0 : Math.sqrt(Math.min(1, Math.abs(value) / extent)) * topOpacity;
