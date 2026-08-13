import { DateTime } from "luxon";

/**
 * Tick selection shared by the chart's x axis and the scrub track — Phase 6 followup, Track J.
 *
 * Both surfaces label a time axis with the same rule: 6-hourly marks (00:00, 06:00, 12:00,
 * 18:00) when there is room, collapsing to midnight/midday only when there is not. This module
 * is the one place that rule is expressed, so the two surfaces cannot drift onto two slightly
 * different ideas of "enough space".
 *
 * Three things this module is deliberate about:
 *
 * 1. **Ticks are local-calendar instants, not fixed-offset arithmetic.** A day is not always
 *    24 real hours — GB and NL both observe DST — so "midnight" and "6-hourly" are built by
 *    constructing each candidate wall-clock instant (`day.set({ hour })`) in the given zone,
 *    one calendar day at a time, rather than by repeatedly adding a fixed duration to a start
 *    point. The latter would drift off the clock hour on exactly the two days a year that
 *    matter and look correct every other day, which is the same silent-plausible failure
 *    `lib/time/cursor.ts` was written to avoid.
 * 2. **The density choice has hysteresis.** `selectAxisTicks` takes the density it last
 *    rendered and only flips when the available space crosses a wider margin than the one it
 *    used to switch in the first place — a Schmitt trigger, not a bare threshold — so a resize
 *    sitting a few pixels either side of the boundary does not relabel every frame.
 * 3. **It takes a range as an argument, never assumes one.** The chart's window and the
 *    scrubber's `use-cursor-range` are different ranges computed differently; this only ever
 *    sees the numbers, not where they came from.
 */

export type TickDensity = "six-hourly" | "midday-midnight";

export type AxisTickSelection = {
  density: TickDensity;
  /** Epoch milliseconds, ascending, each inside [startMs, endMs]. */
  ticks: number[];
};

/** Local-clock hours labelled at each density. */
const HOURS_BY_DENSITY: Record<TickDensity, number[]> = {
  "six-hourly": [0, 6, 12, 18],
  "midday-midnight": [0, 12]
};

/**
 * Below this many pixels between adjacent 6-hourly labels they start to crowd a "HH:mm"-style
 * label plus breathing room, so we fall back to midnight/midday.
 */
const NARROW_THRESHOLD_PX = 44;

/**
 * Space has to climb past this wider threshold before switching back up to 6-hourly. The gap
 * between the two is the hysteresis band: a resize has to cross a real amount of pixels, not a
 * rounding error, before the density flips either way.
 */
const WIDE_THRESHOLD_PX = 60;

/**
 * The local-calendar instants for a density, within [startMs, endMs].
 *
 * Walks whole calendar days in `zone` and constructs each candidate hour directly with `.set`,
 * so a day that is 23 or 25 real hours long (a DST transition) still gets its labelled hours in
 * the right places rather than sliding by the hour the clocks moved.
 */
export const tickInstants = (
  startMs: number,
  endMs: number,
  zone: string,
  density: TickDensity
): number[] => {
  if (!(endMs > startMs)) return [];

  const hours = HOURS_BY_DENSITY[density];
  const startDay = DateTime.fromMillis(startMs, { zone }).startOf("day");
  const endDay = DateTime.fromMillis(endMs, { zone }).startOf("day");

  const out: number[] = [];
  let day = startDay;
  // A day count guard, not a millisecond one: `day` advances by calendar days, which are not a
  // fixed number of milliseconds across a DST transition, so comparing millis directly here
  // would either skip or repeat the boundary day depending on which way the clocks moved.
  while (day.toMillis() <= endDay.toMillis()) {
    for (const hour of hours) {
      const ms = day.set({ hour, minute: 0, second: 0, millisecond: 0 }).toMillis();
      if (ms >= startMs && ms <= endMs) out.push(ms);
    }
    day = day.plus({ days: 1 });
  }
  return out;
};

/**
 * The Schmitt trigger: which density to use next, given the space available for 6-hourly ticks
 * and the density last rendered.
 *
 * With no prior density (first render) the wide threshold applies, so an unmeasured or
 * first-paint width — which reads as 0px — starts narrow rather than flashing a dense label set
 * it may not have room for.
 */
const chooseDensity = (spacingPx: number, previous: TickDensity | null): TickDensity => {
  if (previous === "six-hourly") {
    return spacingPx < NARROW_THRESHOLD_PX ? "midday-midnight" : "six-hourly";
  }
  return spacingPx >= WIDE_THRESHOLD_PX ? "six-hourly" : "midday-midnight";
};

/**
 * Pick a density for a time range and pixel width, and return the tick instants for it.
 *
 * `widthPx` should be the space actually available to the axis, measured (a `ResizeObserver` or
 * the width Recharts already computes), not derived from a viewport breakpoint — this pane can
 * resize independently of the window. `previousDensity` is what makes the choice sticky; pass
 * `null` only on first render.
 */
export const selectAxisTicks = (input: {
  startMs: number;
  endMs: number;
  zone: string;
  widthPx: number;
  previousDensity?: TickDensity | null;
}): AxisTickSelection => {
  const { startMs, endMs, zone, widthPx, previousDensity = null } = input;

  const sixHourly = tickInstants(startMs, endMs, zone, "six-hourly");
  const gaps = Math.max(1, sixHourly.length - 1);
  const spacingPx = Number.isFinite(widthPx) && widthPx > 0 ? widthPx / gaps : 0;

  const density = chooseDensity(spacingPx, previousDensity);
  const ticks = density === "six-hourly" ? sixHourly : tickInstants(startMs, endMs, zone, density);
  return { density, ticks };
};
