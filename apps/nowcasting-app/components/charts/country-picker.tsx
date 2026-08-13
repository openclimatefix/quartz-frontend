import React from "react";

import { sortCountryCodes } from "../../config/countries";
import { setFocusedCountry } from "../helpers/globalState";
import {
  useCountries,
  useEnabledCountries,
  useFocusedCountry
} from "../../hooks/data/use-countries";

// Which country the chart is reading. The other half of the Phase 6 country split
// (`docs/phase6-layout-contract.md` §1, §7).
//
// It sits in the chart header rather than the top nav because focus is almost entirely a
// chart concern — it owns the national series, the capacity figure, the level selector and
// the number/date formatting — and the header already carries the *enabled* set. Two
// questions, two controls, each next to the thing it changes.
//
// It offers only the enabled countries: choosing a country that is not on the map would
// silently enable it, which is the muddle this arrangement exists to avoid. Add it in the
// header first, then read it here.
//
// Contract §1 also wants this to *move* visibly when a map region click changes focus, so
// the chart changing country under the user is signalled rather than silent. The animation
// is not built yet — OPEN §3 has to settle first — but this is the element it will animate.

const OPTION_BASE =
  "px-1.5 py-0.5 text-sm font-bold rounded transition-colors first:rounded-l last:rounded-r";
const OPTION_FOCUSED = "bg-ocf-yellow text-black";
const OPTION_AVAILABLE = "bg-ocf-gray-900 text-ocf-gray-300 hover:text-white";

/** The focused country named with no choice attached, when there is only one to choose. */
const FocusedCountryLabel: React.FC<{ code: string; title: string }> = ({ code, title }) => (
  <span
    data-test="chart-country"
    title={title}
    className="px-1.5 py-0.5 text-sm font-bold rounded bg-ocf-gray-900 text-ocf-gray-300"
  >
    {code}
  </span>
);

/**
 * The country whose numbers the chart is showing, and a way to change it.
 *
 * Rendered from the enabled *codes* rather than from manifest listings, so it is correct the
 * moment the page paints — the codes are synchronous global state, whereas the manifest is
 * an hour-cached request that can cold-start with a retryable 503. The manifest is used only
 * to put a country's full name in the `title`, and its absence costs nothing but the tooltip.
 */
const ChartCountryPicker: React.FC = () => {
  const focusedCountry = useFocusedCountry();
  const enabledCountries = useEnabledCountries();
  const { countries } = useCountries();

  const nameOf = (code: string) => countries.find((country) => country.code === code)?.name ?? code;

  // One country is not a choice, and this is the common case — a lone highlighted button
  // reads as a control that has lost its other half.
  if (enabledCountries.length === 1) {
    return <FocusedCountryLabel code={focusedCountry} title={nameOf(focusedCountry)} />;
  }

  return (
    <div className="flex items-center gap-px" role="group" aria-label="Chart country">
      {sortCountryCodes(enabledCountries, (code) => code).map((code) => {
        const focused = code === focusedCountry;
        return (
          <button
            key={code}
            type="button"
            data-test="chart-country"
            aria-pressed={focused}
            title={
              focused ? `${nameOf(code)} — shown in the chart` : `${nameOf(code)} — show in chart`
            }
            onClick={() => setFocusedCountry(code)}
            className={`${OPTION_BASE} ${focused ? OPTION_FOCUSED : OPTION_AVAILABLE}`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
};

export default ChartCountryPicker;
