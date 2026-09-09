import { FC } from "react";

import useGlobalState from "../helpers/globalState";
import { useEnabledCountries, useFocusedCountry } from "../../hooks/data";
import { getCountryConfig, sortCountryCodes } from "../../config/countries";
import { periodForInstant, slotLabellingFor } from "../../lib/time/cursor";
import {
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  formatISODateStringAsZonedDate,
  formatISODateStringAsZonedTime
} from "../helpers/utils";

/**
 * What time it is, per zone — lifted out of the cursor footer into its own card.
 *
 * The content is unchanged from `cursor-readout.tsx`, and that file's doc comment is still the
 * account of *why* each row says what it says: a period rather than a timestamp, because GB
 * labels the end of its slot and NL the start; every enabled country present whether focused or
 * not, because focus should be a weight change and never a reordering; fixed-width tabular
 * cells, because the column is read vertically and must not shift sideways as the cursor steps.
 *
 * **What changed is where it lives, and that follows from what it is.** The footer held two
 * different kinds of thing side by side: a control (the track and playback, which you operate)
 * and a readout (this, which you read). Once the control moves into the chart to line up with
 * the chart's axis, the readout has no reason to follow it there — it describes the cursor for
 * the *map* as much as for the chart, and inside a card that is showing one country a
 * multi-country stack reads as belonging to that one country.
 *
 * The control dock is where the app already puts things that describe the map without being
 * part of it. Bottom of that column rather than top: the encoding controls above it are things
 * you reach for, this is a thing you glance at, and the glance is cheapest at the corner
 * furthest from the chart you were just reading — diagonally opposite, where nothing else
 * competes for it.
 */
const CountrySlot: FC<{ code: string; cursor: string; focused: boolean }> = ({
  code,
  cursor,
  focused
}) => {
  const config = getCountryConfig(code);
  const zone = config?.timezone ?? DEFAULT_TIMEZONE;
  const period = periodForInstant(cursor, code);
  const at = (instant: string) => formatISODateStringAsZonedTime(instant, zone, DEFAULT_LOCALE);
  const span = `${at(period.start)}–${at(period.end)}`;
  const labelsStart = slotLabellingFor(code) === "period-start";

  return (
    <span
      className="flex items-baseline gap-1.5 text-2xs"
      title={`${code} published period, ${zone} — ${code} timestamps label the ${
        labelsStart ? "start" : "end"
      } of their period, so this one is ${code}'s ${
        labelsStart ? at(period.start) : at(period.end)
      }${focused ? ". The cursor's grid and the axis follow this country" : ""}`}
    >
      <span
        className={`w-5 shrink-0 font-bold uppercase tracking-wider ${
          focused ? "text-selected" : "text-content-secondary"
        }`}
      >
        {code}
      </span>
      <span className="w-[4.5rem] shrink-0 font-mono tabular-nums text-content">{span}</span>
    </span>
  );
};

const ZoneStack: FC = () => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const enabledCountries = useEnabledCountries();
  const focusedCountry = useFocusedCountry();

  if (!selectedISOTime) return null;

  const focusedZone = getCountryConfig(focusedCountry)?.timezone ?? DEFAULT_TIMEZONE;
  const utc = formatISODateStringAsZonedTime(selectedISOTime, "UTC");
  const cursorDate = formatISODateStringAsZonedDate(selectedISOTime, focusedZone, DEFAULT_LOCALE);
  const zoneOrder = sortCountryCodes(enabledCountries, (code) => code);

  return (
    // `mt-auto` is the whole of "bottom of the column": the dock is a full-height flex column
    // anchored at both edges, so a top margin of `auto` pushes this to the bottom without the
    // dock needing to know it has a bottom-aligned child. `w-fit ml-auto` keeps the card only
    // as wide as its widest row and pinned to the dock's right edge, so it does not read as a
    // short version of the 260px panels above it.
    <div
      aria-label="Cursor time by zone"
      role="group"
      className="ml-auto mt-auto flex w-fit flex-col justify-center gap-px rounded-lg border border-content/10 bg-surface-panel/95 px-2 py-1.5 leading-none text-content shadow-2xl"
    >
      <span
        className="pb-0.5 font-mono text-2xs font-bold uppercase tracking-wider text-content"
        title={`Cursor date in ${focusedCountry}'s timezone (${focusedZone})`}
      >
        {cursorDate}
      </span>
      <span className="flex items-baseline gap-1.5 text-2xs text-content-secondary">
        <span className="w-5 shrink-0 font-bold uppercase tracking-wider">utc</span>
        <span className="w-10 shrink-0 font-mono tabular-nums">{utc}</span>
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
  );
};

export default ZoneStack;
