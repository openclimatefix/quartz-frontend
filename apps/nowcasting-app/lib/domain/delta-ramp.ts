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
// Sky Blue, not the kit's darker Blue (#4675C1): on a dark map, and at the low opacities a
// small delta draws with, that one goes muddy long before it reads as a colour. This sits
// nearer the warm pole in lightness, so the two ends carry equal weight either side of zero.
export const DELTA_COOL = "#65B0C9";
// The map's own ground, not a mid grey: the midpoint should VANISH — a delta too small to
// mean anything is not a finding, and painting it a distinct grey made it one. It also keeps
// the scale inside the reskin's blacks, where #6C6C6C was left over from the old palette.
export const DELTA_NEUTRAL = "#282A2A";
export const DELTA_WARM = "#FAA056";

/** Where the ramp saturates: fixed MW, or a fraction of installed capacity. */
export const deltaExtent = (normalized: boolean): number =>
  normalized ? DELTA_PERCENTAGE_EDGES[DELTA_PERCENTAGE_EDGES.length - 1] : DELTA_BUCKET.POS4;

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
  const [r, g, b] =
    clamped < 0
      ? mix(DELTA_NEUTRAL, DELTA_COOL, -clamped)
      : mix(DELTA_NEUTRAL, DELTA_WARM, clamped);
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Strength for one delta: nothing at zero, so ordinary forecast noise recedes, rising to
 * `topOpacity` at saturation. The same magnitude rule the map's fill opacity applies.
 */
export const deltaRampOpacity = (value: number, extent: number, topOpacity: number): number =>
  extent === 0 ? 0 : Math.min(1, Math.abs(value) / extent) * topOpacity;
