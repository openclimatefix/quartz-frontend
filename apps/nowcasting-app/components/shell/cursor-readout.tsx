import { FC } from "react";

import useGlobalState from "../helpers/globalState";
import { useEnabledCountries, useFocusedCountry } from "../../hooks/data";
import { getCountryConfig } from "../../config/countries";
import { finestCadenceMinutes, slotForInstant } from "../../lib/time/cursor";
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE, formatISODateStringAsZonedTime } from "../helpers/utils";

/**
 * The shared cursor, said out loud.
 *
 * Contract §4: with the map and the chart reading one instant, the cursor is what makes them
 * one instrument, so the control belongs to the shell rather than to either pane. This is the
 * readout half of that. The *inputs* have not moved — clicking the chart, the arrow keys and
 * the play button all still write `selectedISOTime` — and per §4 they must not have to: any
 * input snapping to the same grid is what keeps chart and map from ever being a slot apart.
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
      className="flex flex-none flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-white/10 bg-black px-4 py-2 text-xs text-ocf-gray-300"
    >
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
    </footer>
  );
};

export default CursorReadout;
