import { DateTime } from "luxon";

/**
 * The time window every **region time-series** request is made over — in one place, applied by
 * the query layer rather than by each caller.
 *
 * ## Why this exists
 *
 * The v1 endpoints do not share a default window, and nothing said so at the call site:
 *
 * | endpoint | server default if no `start_utc` |
 * |---|---|
 * | `/regions/{region}/forecast` | **now → +48h** (no past at all) |
 * | `/regions/{region}/generation` | **the last 24h** |
 * | `/forecasts/period`, `/generation/period` | ±2 days, floored to 6h |
 *
 * So a caller that passed no window got a forecast with no history, a generation series with a
 * day of it, and a period request with two — three different answers to "the recent past",
 * decided by which endpoint happened to be involved. The national chart worked around this by
 * pinning `start` on every call; the selected-GSP chart did not, and drew no forecast history at
 * all while its PV Live line had a full day behind it. That is the bug this replaces
 * (2026-08-16), and the reason the fix is *here*: a convention that lives in a comment on the
 * one caller who read it will be missed by the next caller, and was.
 *
 * ## What it does not cover
 *
 * **The `period` endpoints deliberately send no window and must keep sending none.** Their
 * default *is* the window their cache is pre-warmed on ("served entirely from a pre-warmed
 * cache, one key per region"), so pinning our own risks missing the warm path as well as
 * truncating. Applying this default there would be a regression, not a tidy-up — see the notes
 * in `use-map-region-values.ts` and `use-gsp-deltas.ts`.
 *
 * ## The end of the window is never pinned
 *
 * The forecast horizon is a per-country fact — GB publishes 36h ahead, NL 48 — so any constant
 * end truncates somebody. `getFurthestForecastTimestamp` (now +1 day) used to do exactly that,
 * clipping 6–12h off GB and 18–24h off NL before it was deleted. Omit `end_utc` and take
 * whatever the API has. A caller may still pass an explicit `end`; nothing here supplies one.
 *
 * ## Making the window selectable later
 *
 * This is the seam for it. `resolveSeriesWindow` fills only what the caller left undefined, so
 * an explicit window always wins — which means a future "show me the last N days" control needs
 * to change what is passed *in*, not to find and update every call site. Point it at this
 * resolver (or thread a chosen start through the hooks into it) and every region time-series
 * follows at once, consistently, including endpoints added after the control was built.
 */

/**
 * How far back a region time-series reaches by default.
 *
 * Two days matches the `period` endpoints' own default, so the map and the charts describe the
 * same stretch of history rather than two slightly different ones.
 */
export const SERIES_HISTORY_DAYS = 2;

/**
 * Rounds a DateTime down to the 6-hour boundary at or before it (00:00, 06:00, 12:00, 18:00
 * UTC). Idempotent on a boundary.
 */
const floorToSixHoursUtc = (dt: DateTime<true>): DateTime<true> => {
  const utc = dt.toUTC();
  return utc.startOf("hour").minus({ hours: utc.hour % 6 }) as DateTime<true>;
};

/**
 * The default start: `SERIES_HISTORY_DAYS` before now, rounded **down** to a 6-hour UTC
 * boundary, as an ISO-8601 UTC string.
 *
 * The flooring is not cosmetic — it is what keeps the SWR cache key stable while the user
 * scrubs. An unfloored "now minus two days" changes every render and would refetch every series
 * on every tick.
 *
 * B2: this used to round in the *viewer's* local timezone before converting to UTC, so a viewer
 * in Los Angeles asked for a different window than one in the UK at the same instant. The API
 * works entirely in UTC, so the rounding does too, and every viewer gets the same window — and
 * therefore the same cache entry.
 *
 * @example
 * // now === 2025-12-07T14:45:00Z
 * defaultSeriesStart(); // "2025-12-05T12:00:00.000Z"
 */
export const defaultSeriesStart = (): string =>
  floorToSixHoursUtc(DateTime.now().toUTC().minus({ days: SERIES_HISTORY_DAYS })).toISO();

/** A window with a start and an end, both optional, in whatever form the caller had them. */
export type SeriesWindow = {
  start?: Date | string;
  end?: Date | string;
};

/**
 * Fill in the window a region time-series request should use.
 *
 * Only `start` is supplied, and only when the caller did not give one — an explicit `start`
 * always wins, including a deliberate one that reaches further back. `end` is passed through
 * untouched (usually `undefined`, see above).
 */
export const resolveSeriesWindow = <T extends SeriesWindow>(window: T): T => ({
  ...window,
  start: window.start ?? defaultSeriesStart()
});
