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
 * ### Why the resolution is a ceiling and not "nearest"
 *
 * A timestamp labels the **end** of the period it covers: a GB slot labelled 16:00 covers
 * 15:30–16:00. So the slot containing an instant is the next label at or after it —
 *
 * ```
 * cursor ------> 16:15 UTC
 *   GB  30-min   16:30 slot  (covers 16:00-16:30)
 *   NL  15-min   16:15 slot  (covers 16:00-16:15)
 * ```
 *
 * — and "nearest", which is what anyone reaches for by default, is wrong by up to half a
 * period in a way that still looks entirely plausible on screen. The invariant was only ever
 * written down in user-facing copy (`ChartInfo.tsx`, the legend's `i` tooltip); it is written
 * here because this is the code that depends on it.
 *
 * It has not bitten before because the old slider stepped through `times_utc` exactly, so no
 * rounding ever happened. A cursor shared across two cadences is what makes it live.
 *
 * Whether a country labels period-end is a per-country fact, not a universal one, so it is a
 * registry field (`CountryConfig.slotLabelling`) rather than an assumption baked in here.
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
 * "Now" on a cadence grid: the slot currently filling, i.e. the next one strictly ahead.
 *
 * `offsetMinutes` shifts the instant before rounding. The helper this replaces did the shift
 * with a `set({ minute })` that relied on Luxon normalising an out-of-range minute; `plus` is
 * the same thing said properly.
 */
export const cursorNow = (cadenceMinutes: number, offsetMinutes = 0): string =>
  nextSlot(DateTime.utc().plus({ minutes: offsetMinutes }), cadenceMinutes);

/**
 * The slot a country published for a given cursor instant — **the resolution rule**.
 *
 * Ceiling for a country that labels period-end, floor for one that labels period-start;
 * either way the answer is the slot whose period *contains* the cursor. Call this at every
 * boundary where the shared cursor meets one country's data: the map's value lookup, the
 * chart's now-split, a region series index. Looking data up at the raw cursor instead is a
 * blank map the moment a finer country is enabled alongside a coarser one.
 */
export const slotForInstant = (instant: Instant, country: string | null | undefined): string => {
  const cadence = cadenceMinutesFor(country);
  const direction = slotLabellingFor(country) === "period-start" ? "down" : "up";
  return toCursorString(roundToCadence(instant, cadence, direction));
};
