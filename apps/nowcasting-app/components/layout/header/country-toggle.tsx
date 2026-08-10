import React from "react";

import { toggleCountryEnabled } from "../../helpers/globalState";
import { useCountries, useEnabledCountries } from "../../../hooks/data/use-countries";
import type { CountryListing } from "../../../lib/domain/types";

// Which countries draw on the map. A multi-select, and nothing else.
//
// Phase 6 split "which country" in two (`docs/phase6-layout-contract.md` §1): *enabled* is a
// set and belongs to the map, *focused* is one country and belongs to the chart. This
// control owns the first half only. Focus is picked in the chart header, next to the numbers
// it governs — see `components/charts/country-picker.tsx` — because that is where the choice
// has a visible effect, and putting both in the header made one gesture quietly do two
// things.
//
// `/countries` returns every country the API serves, by design, so prospects can see what
// exists before a subscription completes — which is why an unentitled country is rendered
// *disabled* rather than hidden. This is the one place entitlement gates a write: the
// enabled set is persisted, so it must never come to hold a country the user cannot see.

const BUTTON_BASE =
  "px-2 py-0.5 text-sm font-bold rounded transition-colors first:rounded-l last:rounded-r";
const BUTTON_ENABLED = "bg-ocf-yellow text-black";
const BUTTON_SELECTABLE = "bg-mapbox-black text-ocf-gray-400 hover:text-white";
const BUTTON_DISABLED = "bg-mapbox-black text-ocf-gray-800 cursor-not-allowed";

/**
 * A country can be chosen only if the user is entitled to it *and* this build has a
 * registry entry for it. Without an entry there are no boundaries to draw and no timezone
 * to render in, so selecting it would be a crash rather than a degraded view — the same
 * rule `useEntitledCountries` applies when fanning out.
 */
const isSelectable = (country: CountryListing): boolean => country.entitled && country.configured;

const unselectableReason = (country: CountryListing): string =>
  country.configured ? "No access" : "Not available in this build";

/**
 * One option, sized and coloured like the rest of the header.
 *
 * Rendered as a real `<button disabled>` rather than a styled `<div>` so an unentitled
 * country is unclickable, unfocusable and announced as disabled, rather than merely looking
 * greyed out. `aria-pressed` carries the enabled state — this is a set of independent
 * toggles, not a radio group.
 *
 * The last enabled country is `disabled` too: an empty set is a blank map with no way back.
 * `setEnabledCountries` refuses it as well, but the button should not pretend otherwise.
 */
const CountryOption: React.FC<{
  country: CountryListing;
  enabled: boolean;
  isLastEnabled: boolean;
  onToggle: (code: string) => void;
}> = ({ country, enabled, isLastEnabled, onToggle }) => {
  const selectable = isSelectable(country);
  const stateClasses = !selectable ? BUTTON_DISABLED : enabled ? BUTTON_ENABLED : BUTTON_SELECTABLE;

  const hint = !selectable
    ? unselectableReason(country)
    : isLastEnabled
    ? "The only country on the map"
    : enabled
    ? "Remove from the map"
    : "Add to the map";

  return (
    <button
      type="button"
      disabled={!selectable || isLastEnabled}
      aria-pressed={enabled}
      title={`${country.name} — ${hint}`}
      onClick={() => onToggle(country.code)}
      className={`${BUTTON_BASE} ${stateClasses}`}
    >
      {country.code}
    </button>
  );
};

/** A country named with no choice attached, for the states where a choice would be a lie. */
const CountryLabel: React.FC<{ code: string; title: string }> = ({ code, title }) => (
  <span
    title={title}
    className="px-2 py-0.5 text-sm font-bold rounded bg-mapbox-black text-ocf-gray-400"
  >
    {code}
  </span>
);

const CountryToggle: React.FC = () => {
  const { countries, isLoading, error } = useCountries();
  const enabledCountries = useEnabledCountries();

  // The manifest is an hour-cached request that can also cold-start with a retryable 503.
  // A momentarily empty control would read as "your countries went away", so both the
  // in-flight and the failed case fall back to naming what is actually drawn. The app is
  // fully usable in either: the enabled set comes from the cookie, not the manifest.
  if (isLoading) {
    return (
      <div className="flex items-center px-2" role="group" aria-label="Countries" aria-busy="true">
        <CountryLabel code={enabledCountries.join(" ")} title="Loading countries" />
      </div>
    );
  }

  if (error || countries.length === 0) {
    return (
      <div className="flex items-center px-2" role="group" aria-label="Countries">
        <CountryLabel code={enabledCountries.join(" ")} title="Country list unavailable" />
      </div>
    );
  }

  // One country is not a choice. Rendering a lone highlighted button looks like a toggle
  // that has lost its other half; a plain label says the same thing without the affordance.
  if (countries.length === 1) {
    const only = countries[0];
    return (
      <div className="flex items-center px-2" role="group" aria-label="Countries">
        <CountryLabel code={only.code} title={only.name} />
      </div>
    );
  }

  return (
    <div className="flex items-center px-2" role="group" aria-label="Countries">
      {countries.map((country) => (
        <CountryOption
          key={country.code}
          country={country}
          enabled={enabledCountries.includes(country.code)}
          isLastEnabled={enabledCountries.length === 1 && enabledCountries[0] === country.code}
          onToggle={toggleCountryEnabled}
        />
      ))}
    </div>
  );
};

export default CountryToggle;
