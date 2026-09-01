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

export type TickDensity = "six-hourly" | "midday-midnight" | "midnight-only";

export type AxisTickSelection = {
  density: TickDensity;
  /** Epoch milliseconds, ascending, each inside [startMs, endMs]. */
  ticks: number[];
};

/** Local-clock hours labelled at each density. */
const HOURS_BY_DENSITY: Record<TickDensity, number[]> = {
  "six-hourly": [0, 6, 12, 18],
  "midday-midnight": [0, 12],
  "midnight-only": [0]
};

/**
 * Densest first. The ladder is walked in this order and the first density with room wins, so
 * adding a step is one entry here and one in the table above.
 */
const DENSITY_LADDER: TickDensity[] = ["six-hourly", "midday-midnight", "midnight-only"];

/**
 * Below this many pixels between adjacent 6-hourly labels they start to crowd, so we fall back
 * to midnight/midday.
 *
 * Sized to the *widest* label, not the average one. Only the first tick of each day carries the
 * day name — "Mon 00:00" against a bare "06:00" — and adjacent labels are centred on their
 * ticks, so the space two of them need is half of each plus a gap. At 10px Matter Semi Mono
 * that is roughly 54px and 30px of text, i.e. 42px of label with nothing between them. The old
 * 44px threshold was measuring the bare times only and let a day-prefixed label run into its
 * neighbour before anything collapsed, which is what "Mon 00:0006:00" was.
 */
const NARROW_THRESHOLD_PX = 56;

/**
 * Space has to climb past this wider threshold before switching back up to 6-hourly. The gap
 * between the two is the hysteresis band: a resize has to cross a real amount of pixels, not a
 * rounding error, before the density flips either way.
 */
const WIDE_THRESHOLD_PX = 76;

/**
 * The local-calendar instants for a density, within [startMs, endMs].
 *
 * Walks whole calendar days in `zone` and constructs each candidate hour directly with `.set`,
 * so a day that is 23 or 25 real hours long (a DST transition) still gets its labelled hours in
 * the right places rather than sliding by the hour the clocks moved.
 */
/**
 * Walk whole calendar days in `zone` between `startMs` and `endMs`, constructing each candidate
 * hour directly with `.set` rather than adding a fixed duration — the shared machinery behind
 * both `tickInstants` (which hours depends on density) and `midnightInstants` (always hour 0,
 * regardless of whatever density the axis has chosen). A day that is 23 or 25 real hours long
 * (a DST transition) still gets its labelled hours in the right places rather than sliding by
 * the hour the clocks moved.
 */
const walkDays = (startMs: number, endMs: number, zone: string, hours: number[]): number[] => {
  if (!(endMs > startMs)) return [];

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

export const tickInstants = (
  startMs: number,
  endMs: number,
  zone: string,
  density: TickDensity
): number[] => walkDays(startMs, endMs, zone, HOURS_BY_DENSITY[density]);

/**
 * Local midnight in `zone` for every calendar day the range touches — **independent of tick
 * density**. The scrub track's hairlines mark hard calendar edges regardless of whether the
 * axis below is currently labelled 6-hourly or midnight/midday, and they must agree with
 * whichever midnight labels are showing rather than compute the boundary a second, possibly
 * different, way. Track O.
 */
export const midnightInstants = (startMs: number, endMs: number, zone: string): number[] =>
  walkDays(startMs, endMs, zone, [0]);

/**
 * Local midday, on the same terms as `midnightInstants` — density-independent, walked as a
 * calendar hour so a DST day puts it in the right place rather than 11:00 or 13:00.
 *
 * Midday is a *softer* boundary than midnight: it divides a day rather than separating two, so
 * the scrub track draws it at half the hairline's height and dimmer (see `scrub-track.tsx`'s
 * layer 3). Nothing above midnight in the ranked hierarchy may be pushed down to make room for
 * it — it is the weakest mark on the strip that is still a mark.
 */
export const middayInstants = (startMs: number, endMs: number, zone: string): number[] =>
  walkDays(startMs, endMs, zone, [12]);

/**
 * The Schmitt trigger, walked down a ladder: take the densest set of ticks that has room.
 *
 * Each rung is measured on *its own* spacing rather than the six-hourly one, because the whole
 * question is how far apart that density's own labels would sit. The hysteresis is in which
 * threshold applies: a density already on screen only has to clear the narrow one, while moving
 * to a different density has to clear the wider one. So a resize hovering on a boundary keeps
 * what it has instead of relabelling every frame, in either direction and at every rung.
 *
 * With no prior density (first render) every rung sees the wide threshold, so an unmeasured or
 * first-paint width — which reads as 0px — starts at the sparsest rung rather than flashing a
 * dense label set it may not have room for.
 */
const chooseDensity = (
  spacingFor: (density: TickDensity) => number,
  previous: TickDensity | null
): TickDensity => {
  for (const density of DENSITY_LADDER) {
    const threshold = previous === density ? NARROW_THRESHOLD_PX : WIDE_THRESHOLD_PX;
    if (spacingFor(density) >= threshold) return density;
  }
  // The last rung is the floor: one label a day is the sparsest an axis can be and still be a
  // time axis, so below this there is nothing left to drop.
  return DENSITY_LADDER[DENSITY_LADDER.length - 1];
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

  const ticksByDensity = new Map<TickDensity, number[]>(
    DENSITY_LADDER.map((density) => [density, tickInstants(startMs, endMs, zone, density)])
  );
  const spacingFor = (density: TickDensity): number => {
    const gaps = Math.max(1, (ticksByDensity.get(density)?.length ?? 0) - 1);
    return Number.isFinite(widthPx) && widthPx > 0 ? widthPx / gaps : 0;
  };

  const density = chooseDensity(spacingFor, previousDensity);
  const ticks = ticksByDensity.get(density) ?? [];
  return { density, ticks };
};
