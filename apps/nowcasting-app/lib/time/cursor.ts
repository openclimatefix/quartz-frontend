import { DateTime } from "luxon";

import { getCountryConfig, SlotLabelling } from "../../config/countries";

/**
 * The shared cursor's arithmetic. Phase 6, Track B — see `docs/phase6-layout-contract.md` §4.
 *
 * The cursor is **one UTC instant**, shared by the chart and the map: moving it on either
 * repaints the other, which is what makes the two panes one instrument. Countries publish on
 * different steps (GB every 30 minutes, NL every 15), so that single instant has to be
 * resolved to a *slot* per country before anything can look data up at it. Two rules, and
 * they are separate on purpose:
 *
 *   1. **The cursor lives on the finest enabled country's grid.** With NL enabled the step is
 *      15 minutes, so NL is exact and GB rounds; with only GB enabled it is 30 and GB is
 *      exact. Every cursor position is therefore a real published instant for at least one
 *      country. A fully continuous cursor was prototyped and rejected — it puts the cursor on
 *      an instant that is real for nobody.
 *   2. **Each country resolves the cursor to its own slot**, by the labelling rule below.
 *
 * ### Why the resolution is a ceiling or a floor, and never "nearest"
 *
 * A timestamp names one end of the period it covers, and *which* end is a per-country
 * convention. GB follows PV Live and labels the **end**: its 16:00 covers 15:30–16:00, so the
 * slot containing an instant is the next label at or after it. NL's provider (NED) labels the
 * **start**: its 16:00 covers 16:00–16:15, so the containing slot is the last label at or
 * before it —
 *
 * ```
 * cursor ------> 16:15 UTC
 *   GB  30-min   16:30 slot  (covers 16:00-16:30)  period-end   -> ceiling
 *   NL  15-min   16:15 slot  (covers 16:15-16:30)  period-start -> floor
 * ```
 *
 * Either way the answer is the slot whose period *contains* the cursor. "Nearest", which is
 * what anyone reaches for by default, is wrong by up to half a period in a way that still looks
 * entirely plausible on screen. The invariant was only ever written down in user-facing copy
 * (`ChartInfo.tsx`, the legend's `i` tooltip); it is written here because this is the code that
 * depends on it.
 *
 * It has not bitten before because the old slider stepped through `times_utc` exactly, so no
 * rounding ever happened. A cursor shared across two cadences is what makes it live.
 *
 * Which end a country labels is a per-country fact, not a universal one, so it is a registry
 * field (`CountryConfig.slotLabelling`) rather than an assumption baked in here. NL's value was
 * an assumption until the provider confirmed period-start; see `config/countries.ts`.
 *
 * ### Why the grid is anchored in UTC
 *
 * Rounding runs in epoch milliseconds, which means the grid is anchored to the Unix epoch and
 * therefore to the UTC hour. Every cadence in use divides 60, so a country whose offset is a
 * whole or half hour sees the same grid on its own wall clock — and, critically, the grid does
 * not move when that country enters or leaves DST. Anchoring in local time would shift every
 * slot by an hour twice a year, on different dates in different countries, which is exactly
 * the class of bug that passes its tests and is quietly wrong for a season.
 */

/** Cadence assumed for a country the registry has no entry for. */
export const FALLBACK_CADENCE_MINUTES = 30;

/** Labelling assumed for a country the registry has no entry for. */
export const DEFAULT_SLOT_LABELLING: SlotLabelling = "period-end";

const MS_PER_MINUTE = 60_000;

/** Anything that names an instant. Strings are read as UTC when they carry no offset. */
export type Instant = string | Date | DateTime;

const toUtc = (instant: Instant): DateTime => {
  const dt =
    instant instanceof DateTime
      ? instant
      : instant instanceof Date
      ? DateTime.fromJSDate(instant)
      : DateTime.fromISO(instant, { zone: "utc" });

  if (!dt.isValid) {
    throw new Error(
      `Invalid instant: ${JSON.stringify(instant)}${
        dt.invalidReason ? ` (${dt.invalidReason})` : ""
      }`
    );
  }
  return dt.toUTC();
};

/**
 * The one spelling every cursor value carries: `2026-08-10T16:30:00.000Z`.
 *
 * Same shape `get30MinNow` produced and the same shape the chart click path writes
 * (`activeLabel + ":00.000Z"`), so the equality comparisons scattered through the map and the
 * satellite layer keep working unchanged.
 */
const toCursorString = (dt: DateTime): string => dt.toUTC().toISO() as string;

/**
 * Round an instant onto a cadence grid.
 *
 * `strict` decides what happens to an instant that is *already* on the grid: left where it is
 * by default, moved a whole step when strict. Both spellings are needed and the difference
 * matters —
 *
 * - resolving a given instant to its slot is **non-strict**: 16:15 on NL's 15-minute grid is
 *   the 16:15 slot, not the 16:30 one;
 * - "now" is **strict**: at exactly 16:00:00.000 the 16:00 slot has just closed, and the slot
 *   the app is watching fill is 16:30. This is what `get30MinNow` always did.
 */
const roundToCadence = (
  instant: Instant,
  cadenceMinutes: number,
  direction: "up" | "down",
  strict = false
): DateTime => {
  if (!Number.isFinite(cadenceMinutes) || cadenceMinutes <= 0) {
    throw new Error(`Cadence must be a positive number of minutes, got ${cadenceMinutes}`);
  }

  const dt = toUtc(instant);
  const step = cadenceMinutes * MS_PER_MINUTE;
  const ms = dt.toMillis();
  const remainder = ((ms % step) + step) % step;
  const stride = direction === "up" ? step : -step;

  if (remainder === 0) return strict ? DateTime.fromMillis(ms + stride, { zone: "utc" }) : dt;
  return DateTime.fromMillis(direction === "up" ? ms - remainder + step : ms - remainder, {
    zone: "utc"
  });
};

/** Minutes between a country's published values; the fallback for an unconfigured code. */
export const cadenceMinutesFor = (country: string | null | undefined): number =>
  getCountryConfig(country)?.cadenceMinutes ?? FALLBACK_CADENCE_MINUTES;

/** Whether a country's timestamps label the end or the start of their period. */
export const slotLabellingFor = (country: string | null | undefined): SlotLabelling =>
  getCountryConfig(country)?.slotLabelling ?? DEFAULT_SLOT_LABELLING;

/**
 * The grid the cursor moves on: the **focused** country's cadence.
 *
 * This used to be the finest cadence across the *enabled* set, so nothing lost resolution —
 * the fine-grid country was always exact and the coarse one rounded. Correct, and it read as
 * broken: with NL enabled the cursor stepped every 15 minutes while GB publishes every 30, so
 * scrubbing or arrow-keying moved the cursor twice for every time GB's map changed. GB had
 * genuinely nothing new to show at 14:45, but the map appeared to skip (Brad, 2026-08-13).
 *
 * Focused rather than coarsest: coarsest would fix the stutter by permanently denying NL its
 * 15-minute resolution whenever GB happened to be enabled. Keying on focus means whatever you
 * are actually reading moves on every step, and the country you are not reading resolves its
 * own slot by ceiling exactly as before — `slotForInstant` is unchanged, and the readout keeps
 * showing both countries' slots so the lag stays visible rather than hidden.
 *
 * A country with no registry entry falls back rather than throwing; `focusedCountry` is
 * invariant-checked upstream anyway.
 */
export const cursorCadenceMinutes = (country: string | null | undefined): number =>
  cadenceMinutesFor(country);

/**
 * The stride playback walks the cursor by: the **finest** cadence across the countries drawn.
 *
 * Deliberately not `cursorCadenceMinutes`, which keys on focus. That rule exists because a
 * cursor you are *aiming* must move the thing you are reading on every step — with GB focused
 * and a 15-minute grid, half the steps changed nothing on the GB map and the scrub read as
 * broken (Brad, 2026-08-13). Nobody aims during playback: it runs on its own, and the
 * complaint reverses — a 30-minute stride makes NL's 15-minute data play at half its
 * resolution because GB happens to be focused.
 *
 * So the two cases get the two different answers, which is only safe because every consumer
 * resolves its own slot from the instant (`slotForInstant`) rather than demanding an exact
 * match. `PlayButton` snaps the cursor back onto the focused grid when playback stops, so
 * stepping by hand resumes on the coarse grid it expects.
 */
export const playbackStrideMinutes = (countries: readonly string[]): number =>
  countries.length === 0
    ? FALLBACK_CADENCE_MINUTES
    : Math.min(...countries.map((country) => cadenceMinutesFor(country)));

/** Whether an instant already sits on a cadence grid. */
export const isOnCadence = (instant: Instant, cadenceMinutes: number): boolean =>
  toUtc(instant).toMillis() % (cadenceMinutes * MS_PER_MINUTE) === 0;

/**
 * Put an instant on the cursor grid — the ceiling, leaving an instant that is already on the
 * grid alone.
 *
 * This is what every cursor *input* goes through: a click on the chart, a scrub, a restored
 * value. Clicking the chart usually lands on the grid already and this is a no-op; it earns
 * its keep when the grid coarsens under a value (NL switched off with the cursor at 16:15) or
 * when a country's own point is not on the shared grid.
 */
export const snapToCadence = (instant: Instant, cadenceMinutes: number): string =>
  toCursorString(roundToCadence(instant, cadenceMinutes, "up"));

/**
 * The last slot at or before an instant — `snapToCadence`'s floor.
 *
 * The ceiling is the rule for a cursor *value*, and nothing here changes that. This exists for
 * the one job the ceiling cannot do: finding the far end of a **bounded** span. The scrub
 * track's last reachable slot is the last one inside the data window, and ceiling the window's
 * end would put it one slot past the last published value — a handle that can be dragged onto
 * an instant nothing has a number for. Floor at the top of a range, ceiling everywhere a
 * cursor input is resolved.
 */
export const snapDownToCadence = (instant: Instant, cadenceMinutes: number): string =>
  toCursorString(roundToCadence(instant, cadenceMinutes, "down"));

/** The next slot strictly after an instant. `get30MinNow`'s rounding, generalised. */
export const nextSlot = (instant: Instant, cadenceMinutes: number): string =>
  toCursorString(roundToCadence(instant, cadenceMinutes, "up", true));

/**
 * "Now" as a cursor value: the **start of the period currently filling**.
 *
 * A cursor value is always a period start (see `periodStartForInstant`), so this floors rather
 * than taking the next slot strictly ahead. It names the same period the old ceiling-strict
 * version did — at 09:14 on a 30-minute grid, the half hour that is filling — from the other
 * end, which is the end every cursor value is now spelled at.
 *
 * `offsetMinutes` shifts the instant before rounding. The helper this replaces did the shift
 * with a `set({ minute })` that relied on Luxon normalising an out-of-range minute; `plus` is
 * the same thing said properly.
 */
export const cursorNow = (cadenceMinutes: number, offsetMinutes = 0): string =>
  toCursorString(
    roundToCadence(DateTime.utc().plus({ minutes: offsetMinutes }), cadenceMinutes, "down")
  );

/**
 * The start of the period a cursor instant falls in, for a given country's cadence.
 *
 * **The tie-break, and the whole of the cross-country fix.** A cursor value sits exactly on a
 * boundary, so "the period containing it" is ambiguous — and the two countries used to resolve
 * that ambiguity in opposite directions: GB labels period-end so it ceilinged and took the
 * period *ending* at the cursor, NL labels period-start so it floored and took the one
 * *starting* there. Same instant, two adjacent periods, no overlap at all — two readings side
 * by side in the footer that were never about the same stretch of time.
 *
 * One rule for everyone: the period that **starts** at or before the instant. The cursor reads
 * forward, the way a scrubber does — you are at T, looking at what happens from T — and a finer
 * country's period nests inside a coarser one's instead of sitting beside it.
 *
 * Labelling is applied *after* this, never instead of it: it decides what a period is called,
 * not which period it is.
 */
export const periodStartForInstant = (
  instant: Instant,
  country: string | null | undefined
): string => toCursorString(roundToCadence(instant, cadenceMinutesFor(country), "down"));

/**
 * The slot a country published for a given cursor instant — **the resolution rule**.
 *
 * The period is chosen first (`periodStartForInstant`, one rule for every country) and only then
 * named the way that country names it: period-start countries by the start, period-end countries
 * by the end, a cadence later. The order is the fix — resolving by labelling direction *instead*
 * of choosing the period is what left GB and NL reading adjacent, non-overlapping spans.
 *
 * Call this at every boundary where the shared cursor meets one country's data: the map's value
 * lookup, the chart's now-split, a region series index. Looking data up at the raw cursor
 * instead is a blank map the moment a finer country is enabled alongside a coarser one.
 */
export const slotForInstant = (instant: Instant, country: string | null | undefined): string => {
  const start = periodStartForInstant(instant, country);
  if (slotLabellingFor(country) === "period-start") return start;
  return toCursorString(
    DateTime.fromISO(start, { zone: "utc" }).plus({ minutes: cadenceMinutesFor(country) })
  );
};

/** The two ends of a published period, as cursor-spelled UTC instants. */
export type Period = { start: string; end: string };

/**
 * The **span** a country's slot covers, rather than the label it goes by.
 *
 * `slotForInstant` answers "which value do I look up"; this answers "what stretch of time is
 * that value about". Both start from the same chosen period, so they cannot disagree, and the second one is what
 * the footer states out loud: with GB labelling period-end and NL period-start, two rows
 * carrying the same digits describe periods that barely overlap. A label alone cannot show
 * that; a span can, and it does so without the reader having to know the convention first —
 * which is the point, because the convention is the part nobody knows.
 *
 * Both ends are UTC instants. Rendering them in a country's own zone is the caller's job (and
 * only ever a formatting step), so no local-time arithmetic happens here — the span is a
 * fixed number of milliseconds wherever it is read, including across a DST transition, because
 * the grid is anchored in UTC. See "Why the grid is anchored in UTC" above.
 *
 * By construction the returned span contains the instant asked about, so the length of the span
 * *is* the country's cadence and the reader never needs it stated separately.
 */
/**
 * The span a **published label** covers — the mirror of `periodForInstant`, and not the same
 * question.
 *
 * `periodForInstant` takes a cursor value, which is always a period start under the one shared
 * rule, and hands back the period beginning there. This takes a *timestamp the country
 * published* — a point in a series, a key in the chart's data — and hands back the period that
 * timestamp is the name of. For a period-start country the two agree; for a period-end country
 * they are a whole cadence apart, because GB's 06:00 point is the half hour that *ended* at
 * 06:00 while a cursor at 06:00 selects the one that starts there.
 *
 * Passing a data label to `periodForInstant` is the mistake this exists to prevent, and it is
 * invisible on a period-start country — which is exactly how it got written the first time.
 */
export const periodForLabel = (label: Instant, country: string | null | undefined): Period => {
  const cadence = cadenceMinutesFor(country);
  const dt = toUtc(label);
  if (slotLabellingFor(country) === "period-start") {
    return { start: toCursorString(dt), end: toCursorString(dt.plus({ minutes: cadence })) };
  }
  return { start: toCursorString(dt.minus({ minutes: cadence })), end: toCursorString(dt) };
};

export const periodForInstant = (instant: Instant, country: string | null | undefined): Period => {
  const start = periodStartForInstant(instant, country);
  const end = toCursorString(
    DateTime.fromISO(start, { zone: "utc" }).plus({ minutes: cadenceMinutesFor(country) })
  );
  return { start, end };
};
