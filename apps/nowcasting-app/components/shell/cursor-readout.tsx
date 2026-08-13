import { FC } from "react";

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
 * What is on screen, and why each fact earns its place:
 *
 * - **the focused country's local time, primary, closest to the track.** This is the reading
 *   the cursor and the track's own axis now agree on, so it sits immediately to the track's
 *   left — near the handle, not at the far edge — with the country's code as a small chip
 *   rather than a paragraph, since it is implied by everything else on the page.
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

const CountrySlot: FC<{ code: string; cursor: string }> = ({ code, cursor }) => {
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
      className="flex items-baseline gap-1.5"
      title={`${code} published slot, ${config?.timezone ?? DEFAULT_TIMEZONE}`}
    >
      <span className="text-2xs font-bold uppercase tracking-wider text-ocf-gray-600">{code}</span>
      <span className="text-white">{local}</span>
      {lagMinutes > 0 && <span className="text-2xs text-ocf-gray-600">{`+${lagMinutes}m`}</span>}
    </span>
  );
};

const CursorReadout: FC = () => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const [timeNow] = useGlobalState("timeNow");
  const enabledCountries = useEnabledCountries();
  const focusedCountry = useFocusedCountry();

  if (!selectedISOTime) return null;

  const cadenceMinutes = cursorCadenceMinutes(focusedCountry);
  const focusedZone = getCountryConfig(focusedCountry)?.timezone ?? DEFAULT_TIMEZONE;
  // The focused country's own slot for this cursor — the same resolution every `CountrySlot`
  // uses, so the primary reading and the track's axis (which shares this zone) agree with the
  // secondary rows about what "GB's time" means for this instant.
  const focusedLocal = formatISODateStringAsZonedTime(
    slotForInstant(selectedISOTime, focusedCountry),
    focusedZone,
    DEFAULT_LOCALE
  );
  const utc = formatISODateStringAsZonedTime(selectedISOTime, "UTC");
  const otherCountries = enabledCountries.filter((code) => code !== focusedCountry);

  return (
    <footer
      aria-label="Time cursor"
      className="flex flex-none items-center gap-4 border-t border-white/10 bg-black px-4 py-2 text-xs text-ocf-gray-300"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="flex items-baseline gap-1.5 text-2xs text-ocf-gray-600">
          <span className="font-semibold uppercase tracking-wider">Cursor</span>
          <span>{utc}</span>
          <span>UTC</span>
          {selectedISOTime === timeNow && (
            <span className="font-semibold uppercase tracking-wider text-ocf-yellow">live</span>
          )}
        </span>
        <span className="text-2xs text-ocf-gray-600">{`${cadenceMinutes}-minute steps`}</span>
        {otherCountries.map((code) => (
          <CountrySlot key={code} code={code} cursor={selectedISOTime} />
        ))}
        <span
          className="flex items-baseline gap-1.5"
          title={`${focusedCountry} focused, ${focusedZone}`}
        >
          <span className="text-2xs font-bold uppercase tracking-wider text-ocf-yellow">
            {focusedCountry}
          </span>
          <span className="text-sm font-semibold text-white">{focusedLocal}</span>
        </span>
      </div>
      <div className="min-w-[140px] flex-1">
        <ScrubTrack zone={focusedZone} />
      </div>
    </footer>
  );
};

export default CursorReadout;
