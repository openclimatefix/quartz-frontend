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
 * The content came from `cursor-readout.tsx`, which is deleted; this is now the account of why
 * each row says what it says.
 *
 * **Why a period and not a timestamp.** The data provider confirmed that NED labels the *start*
 * of NL's period where PV Live labels the *end* of GB's (`config/countries.ts`,
 * `slotLabelling`). A bare `18:00` on two rows is therefore two different quarter- or
 * half-hours of the day, and nothing on screen could tell a reader which. Stating the span says
 * it without requiring the convention to be known first:
 *
 * ```
 *   cursor 17:20 UTC · GB publishes every 30m labelled at the end, NL every 15m at the start
 *
 *     UTC 17:20
 *     GB  18:00–18:30   (17:00-17:30 UTC — the period ENDS at GB's 17:30 label)
 *     NL  19:15–19:30   (17:15-17:30 UTC — the period STARTS at NL's 17:15 label)
 * ```
 *
 * Reading down the column, GB's span closes on its label and NL's opens on it. That is the
 * whole convention, taught by showing rather than by explaining, and this card is the app's one
 * place where both conventions sit side by side. It also retires the cadence/lag column this
 * replaced: every row's span contains the cursor by construction (`periodForInstant`), so there
 * is no lag left to report, and the length of the span states the cadence literally instead of
 * numerically.
 *
 * **UTC is demoted, not dropped.** It is the one unambiguous instant on screen and the
 * canonical value the rest derives from, so it keeps a single instant rather than a span — it
 * is the cursor's own value, not a publisher's period, and the one row with no convention
 * attached.
 *
 * **Every enabled country appears, focused or not**, because focus should be a weight change
 * and never a reordering — the list must not shuffle under a reader. The cells are fixed-width
 * and tabular for the same reason applied sideways: the column is read vertically and must not
 * shift as the cursor steps. The arithmetic is all `lib/time/cursor.ts`; nothing here rounds.
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
 * furthest from the chart you were just reading — diagonally opposite.
 *
 * **That corner was not empty, though.** Mapbox owned it too — the zoom pair and reset button
 * `map.tsx` added with `addControl`, and the attribution — none of it in the dock's flex flow,
 * so this card simply landed on top of the buttons and across "Improve this map". The buttons
 * have since moved into the dock (`map-zoom-controls.tsx`), which is why this file no longer
 * dodges them: they are siblings in the same column now, and that group's `mt-auto` bottom-
 * anchors both.
 *
 * The attribution cannot move — it has to sit on the map — but that clearance belongs to the
 * dock's bottom gutter rather than to this card, since this card is not always the last one in
 * the column. See `map-control-dock.tsx`.
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
    // short version of the 260px panels above it. No `mt-auto` here — `map-zoom-controls.tsx`
    // carries it for the whole bottom group, so this follows in the dock's own gap.
    <div
      aria-label="Cursor time by zone"
      role="group"
      className="ml-auto flex w-fit flex-col justify-center gap-px rounded-lg border border-content/10 bg-surface-panel/95 px-2 py-1.5 leading-none text-content shadow-2xl"
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
