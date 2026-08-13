import { DateTime } from "luxon";

import { Instant, snapDownToCadence, snapToCadence } from "../../lib/time/cursor";

/**
 * The scrub track's arithmetic — pixels ↔ instants, and nothing else.
 *
 * Phase 6 followup, Track H. `docs/phase6-layout-contract.md` §4 makes the cursor shell chrome;
 * Track D shipped the readout half and deferred the track itself. This is the geometry the
 * track needs, kept pure and separate from the component because **an off-by-one-slot scrubber
 * looks entirely correct on screen**. It is the same silent-plausible class as the resolution
 * rule in `lib/time/cursor.ts`, so it gets the same treatment: the arithmetic lives on its own,
 * with the awkward cases pinned by tests.
 *
 * Three things this module refuses to do, each deliberately:
 *
 * 1. **It does not round.** Every snap goes through Track B's `snapToCadence`, so the track
 *    obeys exactly the same ceiling rule as the chart click, the arrow keys and the play
 *    button. A local `Math.round(ms / step) * step` — which is what the prototype used and what
 *    anyone writing a slider reaches for — is *nearest*, and nearest is wrong by up to half a
 *    period against a timestamp that labels the end of its period.
 * 2. **It does not know a timezone.** Every value is an epoch millisecond off a UTC instant, so
 *    the scale is unaffected by either country's DST transition. A range crossing the last
 *    Sunday in October contains exactly `duration / cadence` slots, not one more; a local-time
 *    scale would give 49 slots for a 24-hour day and put every mark after the transition in the
 *    wrong place, in one country and not the other.
 * 3. **It does not invent a range.** `scrubScale` takes the window the data establishes and
 *    returns `null` when there is not one, rather than defaulting to a horizon nobody published.
 */

/** The window the track spans: the first and last instant the app has values for. */
export type CursorRange = { start: string; end: string };

/**
 * A range with a grid laid over it.
 *
 * `startMs`/`endMs` are the raw data window and are what positions map onto — the track is
 * honest about the window rather than about the slots inside it, so the "now" mark and the
 * handle share one scale and neither moves when the grain changes underneath them.
 *
 * `firstMs`/`lastMs` are the reachable slots: the first *at or after* the start and the last
 * *at or before* the end. They are where the cursor clamps. The two pairs coincide whenever
 * the window's own endpoints sit on the grid, which is the normal case — the window comes off
 * a country's published axis — and differ by less than one step when a finer country is
 * enabled alongside a coarser one.
 */
export type ScrubScale = {
  startMs: number;
  endMs: number;
  firstMs: number;
  lastMs: number;
  cadenceMinutes: number;
  /** How many steps fit between `firstMs` and `lastMs`; the slider's `aria-valuemax`. */
  slotCount: number;
};

/** A stretch of the strip where the focused country's forecast is above zero. */
export type DaylightWindow = { startMs: number; endMs: number };

/** The shape `deriveDaylightWindows` needs from a forecast point — not the full `TimeSeriesPoint`. */
type DaylightPoint = { timeUtc: string; powerMw: number | null };

const MS_PER_MINUTE = 60_000;

const msOf = (instant: Instant): number => {
  if (instant instanceof DateTime) return instant.toMillis();
  if (instant instanceof Date) return instant.getTime();
  const dt = DateTime.fromISO(instant, { zone: "utc" });
  if (!dt.isValid) throw new Error(`Invalid instant: ${instant}`);
  return dt.toMillis();
};

const toIso = (ms: number): string => DateTime.fromMillis(ms, { zone: "utc" }).toISO() as string;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

/**
 * Lay the cursor grid over a data window.
 *
 * Returns `null` when the window is missing, inverted, or too short to contain a single slot —
 * all three mean "there is nothing to scrub", and the caller renders an inert track rather than
 * a handle that can only sit in one place. A window whose ends are one step apart is fine; a
 * degenerate one is not.
 */
export const scrubScale = (
  range: CursorRange | null | undefined,
  cadenceMinutes: number
): ScrubScale | null => {
  if (!range?.start || !range?.end) return null;
  if (!Number.isFinite(cadenceMinutes) || cadenceMinutes <= 0) return null;

  const startMs = msOf(range.start);
  const endMs = msOf(range.end);
  if (!(endMs > startMs)) return null;

  const firstMs = msOf(snapToCadence(range.start, cadenceMinutes));
  const lastMs = msOf(snapDownToCadence(range.end, cadenceMinutes));
  if (lastMs < firstMs) return null;

  const step = cadenceMinutes * MS_PER_MINUTE;
  return {
    startMs,
    endMs,
    firstMs,
    lastMs,
    cadenceMinutes,
    slotCount: Math.round((lastMs - firstMs) / step)
  };
};

/**
 * Daylight windows for the strip's shading — derived from the series `useCursorRange` already
 * fetches for the range, never a separate request or an astronomical calculation. Track O.
 *
 * **Daylight is exactly "forecast > 0"**, the honest proxy the brief asked for — not sunrise,
 * not sunset, just whatever the focused country's own forecast says. Points label the *end* of
 * their period (Track B), so a run of positive values covers the span from the point *before*
 * the run started (its period's start) to the last positive point (that period's own end):
 *
 * ```
 * powerMw   0    0    12   40   55   20   0    0
 * timeUtc   t0   t1   t2   t3   t4   t5   t6   t7
 *                     └────── window: t1 to t5 ──────┘
 * ```
 *
 * **A `null` or non-positive value breaks a run.** A gap in the data reads as "no known
 * daylight here", not as darkness and not as an assumed continuation across whatever the gap
 * covers — the same caution `RegionSnapshot`'s three-way absent/null/zero split takes elsewhere
 * in this app, applied to a single series instead of a region set.
 */
export const deriveDaylightWindows = (values: readonly DaylightPoint[]): DaylightWindow[] => {
  const windows: DaylightWindow[] = [];
  let runStart: number | null = null;

  for (let index = 1; index < values.length; index++) {
    const previousMs = msOf(values[index - 1].timeUtc);
    const isDaylight = (values[index].powerMw ?? 0) > 0;

    if (isDaylight) {
      if (runStart === null) runStart = previousMs;
    } else if (runStart !== null) {
      windows.push({ startMs: runStart, endMs: previousMs });
      runStart = null;
    }
  }

  if (runStart !== null) {
    windows.push({ startMs: runStart, endMs: msOf(values[values.length - 1].timeUtc) });
  }

  return windows;
};

/**
 * Put an instant on the grid and inside the track — the one function every input goes through.
 *
 * Ceiling first (Track B's rule), then clamp. Doing it in that order matters at the top end:
 * an instant in the last part-step of the window ceilings *past* `lastMs` and is pulled back,
 * which is a cursor sitting on the final published slot. Clamping first and then ceiling would
 * push it off the end again.
 */
export const clampToScale = (instant: Instant, scale: ScrubScale): string => {
  const snapped = msOf(snapToCadence(instant, scale.cadenceMinutes));
  return toIso(clamp(snapped, scale.firstMs, scale.lastMs));
};

/** Where a raw millisecond sits along the track, 0 at the window's start and 1 at its end. */
export const fractionForMs = (ms: number, scale: ScrubScale): number =>
  clamp((ms - scale.startMs) / (scale.endMs - scale.startMs), 0, 1);

/** Where an instant sits along the track, 0 at the window's start and 1 at its end. */
export const fractionForInstant = (instant: Instant, scale: ScrubScale): number =>
  fractionForMs(msOf(instant), scale);

/** The snapped, clamped instant a fraction of the way along the track. */
export const instantForFraction = (fraction: number, scale: ScrubScale): string => {
  const safe = Number.isFinite(fraction) ? clamp(fraction, 0, 1) : 0;
  return clampToScale(toIso(scale.startMs + safe * (scale.endMs - scale.startMs)), scale);
};

/**
 * A pointer's position along an element, as a fraction.
 *
 * Split out from the component because this is half of the pixel ↔ instant conversion and it is
 * the half with an oracle. A zero-width rect answers 0 rather than `NaN`: the track is inside a
 * flex footer and is measured on the first pointer event, which can land before layout in a
 * test or on a hidden pane.
 */
export const fractionForClientX = (
  clientX: number,
  rect: { left: number; width: number }
): number => (rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0);

/**
 * The instant's index in the slot sequence — the slider's `aria-valuenow`.
 *
 * Assistive technology wants an integer it can compare, and the slot index is the honest one:
 * the control genuinely has `slotCount + 1` positions and no others. Reporting milliseconds or
 * a percentage would imply a continuum the cursor does not have.
 */
export const slotIndexOf = (instant: Instant, scale: ScrubScale): number => {
  const step = scale.cadenceMinutes * MS_PER_MINUTE;
  const index = Math.round((msOf(clampToScale(instant, scale)) - scale.firstMs) / step);
  return clamp(index, 0, scale.slotCount);
};

/** The instant at a slot index, clamped to the track. The inverse of `slotIndexOf`. */
export const instantForSlotIndex = (index: number, scale: ScrubScale): string => {
  const step = scale.cadenceMinutes * MS_PER_MINUTE;
  const safe = clamp(Math.round(index), 0, scale.slotCount);
  return toIso(scale.firstMs + safe * step);
};

/** How many slots make up `minutes` on this grid; at least one, so a nudge always moves. */
export const slotsPerMinutes = (minutes: number, scale: ScrubScale): number =>
  Math.max(1, Math.round(minutes / scale.cadenceMinutes));
