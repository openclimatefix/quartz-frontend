import { FC } from "react";

import useGlobalState from "../helpers/globalState";
import { useEnabledCountries, useFocusedCountry } from "../../hooks/data";
import { getCountryConfig } from "../../config/countries";
import { finestCadenceMinutes, slotForInstant } from "../../lib/time/cursor";
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE, formatISODateStringAsZonedTime } from "../helpers/utils";
import ScrubTrack from "./scrub-track";

/**
 * The zone the footer's own axis is written in.
 *
 * The readout leads with UTC and names each country's slot alongside, so the track's ticks are
 * UTC too — an axis in one zone and a cursor in another is a readout you have to do arithmetic
 * on. Whether the footer should lead with the focused country's local time instead is Brad's
 * open decision; this constant is the whole of the change if it goes the other way, since the
 * track takes the zone as a prop and holds no timezone of its own.
 */
const READOUT_ZONE = "UTC";

/**
 * The shared cursor, said out loud — and, since the Phase 6 live pass, moved as well.
 *
 * Contract §4: with the map and the chart reading one instant, the cursor is what makes them
 * one instrument, so the control belongs to the shell rather than to either pane. Track D
 * shipped the readout and deferred the track; `scrub-track.tsx` below is the interaction half,
 * added at Brad's request. The three existing inputs are untouched — clicking the chart, the
 * arrow keys and the play button all still write `selectedISOTime` — and the track is a fourth
 * peer rather than a replacement: it reads the same state, so it follows them and they follow
 * it with nothing to keep in step.
 *
 * Three things are on screen because each is a different fact:
 *
 * - **the cursor itself, in UTC.** One truth, named once. Everything else is a rendering of it.
 * - **the slot each enabled country published for it**, in that country's own local time.
 *   Ambiguity displayed rather than hidden — "GB 16:00 · NL 17:00" — which is also what
 *   survives DST landing on different dates in different countries. Note that these are *not*
 *   the same instant rendered twice: a country whose cadence is coarser than the cursor grid
 *   resolves to a later slot, which is what the `+15m` lag says.
 * - **the grain**, because the cursor steps on the finest *enabled* country's grid. Enabling
 *   or disabling a country changes the step, and the readout is where that becomes visible
 *   rather than mysterious.
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
  const local = formatISODateStringAsZonedTime(
    slot,
    config?.timezone ?? DEFAULT_TIMEZONE,
    config?.locale ?? DEFAULT_LOCALE
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
      <span
        className={`text-2xs font-bold uppercase tracking-wider ${
          focused ? "text-ocf-yellow" : "text-ocf-gray-600"
        }`}
      >
        {code}
      </span>
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

  const cadenceMinutes = finestCadenceMinutes(enabledCountries);
  const utc = formatISODateStringAsZonedTime(selectedISOTime, "UTC");

  return (
    <footer
      aria-label="Time cursor"
      className="flex flex-none flex-col border-t border-white/10 bg-black text-xs text-ocf-gray-300"
    >
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-4 pb-1.5 pt-2">
        <span className="flex items-baseline gap-1.5">
          <span className="text-2xs font-semibold uppercase tracking-wider text-ocf-gray-600">
            Cursor
          </span>
          <span className="font-semibold text-white">{utc}</span>
          <span className="text-ocf-gray-600">UTC</span>
          {selectedISOTime === timeNow && (
            <span className="text-2xs font-semibold uppercase tracking-wider text-ocf-yellow">
              live
            </span>
          )}
        </span>
        <span className="text-2xs text-ocf-gray-600">{`${cadenceMinutes}-minute steps`}</span>
        <div className="ml-auto flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {enabledCountries.map((code) => (
            <CountrySlot
              key={code}
              code={code}
              cursor={selectedISOTime}
              focused={code === focusedCountry}
            />
          ))}
        </div>
      </div>
      <ScrubTrack zone={READOUT_ZONE} />
    </footer>
  );
};

export default CursorReadout;
