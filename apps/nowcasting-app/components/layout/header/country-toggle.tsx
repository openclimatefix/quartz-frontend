import React from "react";

import { setCurrentCountry } from "../../helpers/globalState";
import { useCountries, useCurrentCountry } from "../../../hooks/data/use-countries";
import type { CountryListing } from "../../../lib/domain/types";

// Country switcher for the header menu.
//
// Adapted from `country-toggle.tsx` on the `feat/NL-toggle` branch, with the hardcoded
// ["GB","NL"] replaced by the manifest. `/countries` returns every country the API serves,
// by design, so prospects can see what exists before a subscription completes — which is
// why an unentitled country is rendered *disabled* rather than hidden.
//
// Selecting one calls `setCurrentCountry`, whose whole contract is: normalise the code,
// write `currentCountry`, persist the cookie. Nothing is reset on switch — every
// country-scoped key (viewport, region selection, aggregation level) keeps its own slice,
// so switching back restores what the user was looking at.

const BUTTON_BASE =
  "px-2 py-0.5 text-sm font-bold rounded transition-colors first:rounded-l last:rounded-r";
const BUTTON_SELECTED = "bg-ocf-yellow text-black";
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
 * greyed out.
 */
const CountryOption: React.FC<{
  country: CountryListing;
  selected: boolean;
  onSelect: (code: string) => void;
}> = ({ country, selected, onSelect }) => {
  const selectable = isSelectable(country);
  const stateClasses = selected
    ? BUTTON_SELECTED
    : selectable
    ? BUTTON_SELECTABLE
    : BUTTON_DISABLED;

  return (
    <button
      type="button"
      disabled={!selectable}
      aria-pressed={selected}
      title={selectable ? country.name : `${country.name} — ${unselectableReason(country)}`}
      onClick={() => onSelect(country.code)}
      className={`${BUTTON_BASE} ${stateClasses}`}
    >
      {country.code}
    </button>
  );
};

/** The current country with no choice attached, for the states where a choice is a lie. */
const CurrentCountryLabel: React.FC<{ code: string; title: string }> = ({ code, title }) => (
  <span
    title={title}
    className="px-2 py-0.5 text-sm font-bold rounded bg-mapbox-black text-ocf-gray-400"
  >
    {code}
  </span>
);

const CountryToggle: React.FC = () => {
  const { countries, isLoading, error } = useCountries();
  const currentCountry = useCurrentCountry();

  // The manifest is an hour-cached request that can also cold-start with a retryable 503.
  // A momentarily empty toggle would read as "your countries went away", so both the
  // in-flight and the failed case fall back to naming where the user actually is. The app
  // is fully usable in either: the current country comes from the cookie, not the manifest.
  if (isLoading) {
    return (
      <div className="flex items-center px-2" role="group" aria-label="Country" aria-busy="true">
        <CurrentCountryLabel code={currentCountry} title="Loading countries" />
      </div>
    );
  }

  if (error || countries.length === 0) {
    return (
      <div className="flex items-center px-2" role="group" aria-label="Country">
        <CurrentCountryLabel code={currentCountry} title="Country list unavailable" />
      </div>
    );
  }

  // One country is not a choice. Rendering a lone highlighted button looks like a toggle
  // that has lost its other half; a plain label says the same thing without the affordance.
  if (countries.length === 1) {
    const only = countries[0];
    return (
      <div className="flex items-center px-2" role="group" aria-label="Country">
        <CurrentCountryLabel code={only.code} title={only.name} />
      </div>
    );
  }

  return (
    <div className="flex items-center px-2" role="group" aria-label="Country">
      {countries.map((country) => (
        <CountryOption
          key={country.code}
          country={country}
          selected={country.code === currentCountry}
          onSelect={setCurrentCountry}
        />
      ))}
    </div>
  );
};

export default CountryToggle;
