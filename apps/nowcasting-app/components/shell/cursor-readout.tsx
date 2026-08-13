import { FC } from "react";
import { DateTime } from "luxon";

import useGlobalState from "../helpers/globalState";
import { useEnabledCountries, useFocusedCountry } from "../../hooks/data";
import { getCountryConfig } from "../../config/countries";
import { cursorCadenceMinutes, slotForInstant } from "../../lib/time/cursor";
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE, formatISODateStringAsZonedTime } from "../helpers/utils";
import ScrubTrack from "./scrub-track";

/**
 * The shared cursor, said out loud — and, since the Phase 6 live pass, moved as well.
 *
 * Contract §4: with the map and the chart reading one instant, the cursor is what makes them
 * one instrument, so the control belongs to the shell rather than to either pane. Track D
 * shipped the readout and deferred the track; `scrub-track.tsx` is the interaction half, added
 * at Brad's request and mounted below. This followup (Track N) does two things to the footer:
 *
 * 1. **One row, not two.** The readout used to stack above the track as its own full-height
 *    row; it now sits inline to the track's left, with the track filling whatever width is
 *    left. That row's second visual line — the tick labels — belongs to the track alone
 *    (`ScrubTrack`/`TrackTicks`), not to the readout, so it is only as wide as the track and
 *    the footer is shorter for it. `ScrubTrack`'s own horizontal padding was dropped in favour
 *    of this footer's, so the two stay flush.
 * 2. **The axis reads in the focused country's local time, not UTC.** A reader locates a time
 *    of day — dawn, peak, dusk — against a local clock; a UTC axis makes every reading an
 *    arithmetic problem. The zone is reached the same way the rest of this file already reaches
 *    country facts: `getCountryConfig(useFocusedCountry())`. Changing focus changes the zone
 *    (and, via `cursorCadenceMinutes`, the step) together, which is what keeps the handle from
 *    jumping — both come from one call and change on one render.
 *
 * **Track O moved the focused country's primary reading again — off this row entirely.**
 * Sitting at a fixed spot left of the track (Track N's placement, described below for history)
 * did not read as tethered to the handle: Brad's words were "the times changing on one side of
 * the footer don't immediately click as tethered to where the cursor is on the scrub line." The
 * reading now renders inside `ScrubTrack` itself, positioned at the handle's own x and moving
 * with it at pointer rate — see that file. This component no longer computes or renders it;
 * `otherCountries` still excludes the focused country from the secondary list below, since the
 * reading has not stopped being "shown once", it has only moved where that once is.
 *
 * What is on screen, and why each fact earns its place:
 *
 * - **UTC, demoted but not dropped.** It is the one unambiguous instant on screen and the
 *   canonical value everything else derives from; it stays, in the smaller gray type the
 *   country chip used to have, alongside the cadence and the "live" flag.
 * - **every other enabled country's slot**, unchanged in substance from before — its own local
 *   time and the `+15m`-style lag where its cadence is coarser than the cursor grid, which is
 *   the honest signal that two countries are not looking at the same instant. The focused
 *   country no longer appears in this list: it would be the same fact shown twice, once here
 *   and once as the primary reading.
 * - **the grain**, because the cursor steps on the *focused* country's grid. Changing focus
 *   changes the step — GB publishes every 30 minutes, NL every 15 — and the readout is where
 *   that becomes visible rather than mysterious.
 *
 * The arithmetic is entirely Track B's (`lib/time/cursor.ts`); nothing here rounds anything.
 */

const CountrySlot: FC<{ code: string; cursor: string; focused: boolean }> = ({
  code,
  cursor,
  focused
}) => {
  const config = getCountryConfig(code);
  const slot = slotForInstant(cursor, code);
  // The country's *timezone*, but not its locale: NL's slot is shown at NL's wall clock,
  // written the GB way. `config.locale` ("nl-NL") stays in the registry for when a per-user
  // display preference lands — until then every date and time in the app reads the same,
  // rather than switching convention halfway along a row. See `lib/time/display.ts`.
  const local = formatISODateStringAsZonedTime(
    slot,
    config?.timezone ?? DEFAULT_TIMEZONE,
    DEFAULT_LOCALE
  );
  // How far the country's slot sits ahead of the cursor. Zero for whichever country owns the
  // grid; a whole cadence step for one that publishes more coarsely.
  const lagMinutes = Math.round(
    (new Date(slot).getTime() - new Date(cursor).getTime()) / (60 * 1000)
  );

  return (
    <span
      className="flex items-baseline gap-1.5 text-2xs"
      title={`${code} published slot, ${config?.timezone ?? DEFAULT_TIMEZONE}${
        focused ? " — the country the cursor's grid and the axis follow" : ""
      }`}
    >
      {/* Same fixed cells as the UTC row above, so the stack is a column and not a ragged list.
          Focus is weight and colour only — the row never moves. */}
      <span
        className={`w-5 shrink-0 font-bold uppercase tracking-wider ${
          focused ? "text-ocf-yellow" : "text-ocf-gray-600"
        }`}
      >
        {code}
      </span>
      <span
        className={`w-10 shrink-0 tabular-nums ${focused ? "text-white" : "text-ocf-gray-400"}`}
      >
        {local}
      </span>
      {/* The lag slot is always rendered and always the same width, even when empty. It toggles
          on and off as the cursor steps — a country coarser than the cursor grid lags on every
          other slot — and mounting/unmounting it re-flowed the whole row on each step, which
          read as the readout jittering rather than as the number changing. */}
      <span className="inline-block w-7 shrink-0 tabular-nums text-ocf-gray-600">
        {lagMinutes > 0 ? `+${lagMinutes}m` : ""}
      </span>
    </span>
  );
};

const CursorReadout: FC = () => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const enabledCountries = useEnabledCountries();
  const focusedCountry = useFocusedCountry();

  if (!selectedISOTime) return null;

  const cadenceMinutes = cursorCadenceMinutes(focusedCountry);
  const focusedZone = getCountryConfig(focusedCountry)?.timezone ?? DEFAULT_TIMEZONE;
  const utc = formatISODateStringAsZonedTime(selectedISOTime, "UTC");

  /**
   * The stack runs west to east — in time order, not in the order countries were enabled.
   *
   * UTC is the zero mark and every European zone reads after it, so the column tells you the
   * offsets as a shape: each row is at or ahead of the one above. Sorted by the *actual* offset
   * at the cursor's instant rather than by a stored number, so a country in summer time sorts
   * where it currently is, and the order is right on both sides of a DST change — including
   * the weeks when GB and NL have already switched and one has not.
   */
  const zoneOrder = [...enabledCountries].sort((a, b) => {
    const offsetOf = (code: string) =>
      DateTime.fromISO(selectedISOTime, {
        zone: getCountryConfig(code)?.timezone ?? DEFAULT_TIMEZONE
      }).offset;
    return offsetOf(a) - offsetOf(b) || a.localeCompare(b);
  });

  return (
    <footer
      aria-label="Time cursor"
      className="flex flex-none items-center gap-4 border-t border-white/10 bg-black px-4 py-2 text-xs text-ocf-gray-300"
    >
      {/*
       * A stack of zones, not a sentence about the cursor.
       *
       * This was a wrapping row of labelled phrases — "CURSOR 18:15 UTC", "15-minute steps",
       * then each country. Three problems, all of which this shape answers: it explained more
       * than it showed; "cursor" named the thing the whole footer already is; and because the
       * focused country was filtered out of the list, changing focus *reordered* the row, so
       * the one moment you most want a stable reference was the moment it moved.
       *
       * Every zone now holds the same slot on every render — UTC first as the canonical
       * instant, then each enabled country in the enabled set's own order, focused or not.
       * Focus is a *weight* change (bright, yellow code) rather than a membership change, so a
       * focus switch reads as emphasis moving down a stable list. Every cell is fixed-width
       * and tabular, so nothing reflows as the digits or the lag marker change.
       */}
      <div className="flex flex-none flex-col justify-center gap-px leading-none">
        <span className="flex items-baseline gap-1.5 text-2xs text-ocf-gray-600">
          <span className="w-5 shrink-0 font-bold uppercase tracking-wider">utc</span>
          <span className="w-10 shrink-0 tabular-nums">{utc}</span>
        </span>
        {zoneOrder.map((code) => (
          <CountrySlot
            key={code}
            code={code}
            cursor={selectedISOTime}
            focused={code === focusedCountry}
          />
        ))}
      </div>
      {/* The grain, as a value rather than a sentence. The explanation moves to the tooltip:
          it is a thing you check once, not something to read on every glance. */}
      <span
        className="flex-none cursor-default text-2xs tabular-nums text-ocf-gray-600"
        title={`The cursor steps in ${cadenceMinutes}-minute slots — ${focusedCountry} publishes on that grid. Changing the focused country changes the step.`}
      >
        {`${cadenceMinutes}m`}
      </span>
      <div className="min-w-[140px] flex-1">
        <ScrubTrack zone={focusedZone} />
      </div>
    </footer>
  );
};

export default CursorReadout;
