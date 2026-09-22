import { FC, useState } from "react";
import { MdKeyboardArrowDown } from "@react-icons/all-files/md/MdKeyboardArrowDown";
import { MdKeyboardArrowRight } from "@react-icons/all-files/md/MdKeyboardArrowRight";

import useGlobalState, { toggleCountryEnabled } from "../helpers/globalState";
import { useEnabledCountries, useEntitledCountries, useFocusedCountry } from "../../hooks/data";
import { getCountryConfig } from "../../config/countries";
import Toggle from "../Toggle";
import { CookieStorageKeys, setBooleanSettingInLocalStorage } from "../helpers/cookieStorage";

/**
 * Settings that belong to the MAP, in the map's own column.
 *
 * The display panel moved onto the chart's edge, which made it the chart's panel — and left
 * the constraint-boundary toggle, which draws on the map, sitting inside it. This is where
 * that kind of setting goes now: one small drawer under the encoding controls, shut by
 * default, because nothing in it is looked at often enough to spend column height on.
 *
 * "Map settings" rather than "Map layers": the dock already has a LAYERS row a few pixels
 * above (clouds and PV), which is the one people actually reach for, and two things called
 * layers in one column is a question the reader has to stop and answer.
 *
 * It holds the country switches too. Which countries the map DRAWS had no control at all —
 * the header's toggle chooses which one you READ, and the enabled set was pinned to "every
 * entitled country" by a stand-in hook. So there was no way to take one off the map, which is
 * what a demo of two countries needs. This is the "moving to a sidebar" control the layout
 * contract promised, in the map's own column because it is a question about the map.
 *
 * With one country entitled there is nothing to choose, so those rows do not render.
 */
const MapExtrasDrawer: FC = () => {
  const [open, setOpen] = useState(false);
  const [showConstraints, setShowConstraints] = useGlobalState("showConstraints");
  const focusedCountry = useFocusedCountry();
  const overlays = getCountryConfig(focusedCountry)?.overlays ?? [];
  const enabled = useEnabledCountries();
  const { countries: entitled } = useEntitledCountries();
  const countryRows = entitled.length > 1 ? entitled : [];

  if (!overlays.length && !countryRows.length) return null;

  return (
    <div className="flex shrink-0 flex-col rounded-lg border border-content/10 bg-surface-panel/95 text-content shadow-2xl">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="map-extras"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex items-center gap-1 px-2 py-1.5 text-2xs font-semibold uppercase tracking-wider text-content-secondary transition-colors hover:text-content focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-interactive"
      >
        {open ? <MdKeyboardArrowDown size={14} /> : <MdKeyboardArrowRight size={14} />}
        Map settings
      </button>
      {open && (
        <div id="map-extras" className="flex flex-col px-2 pb-2">
          {countryRows.map((country) => (
            <div
              key={`country-${country.code}`}
              className="flex items-center justify-between py-0.5 text-2xs uppercase tracking-wider"
            >
              <button
                type="button"
                className="flex-1 text-left text-content"
                onClick={() => toggleCountryEnabled(country.code)}
              >
                {country.config?.displayName ?? country.code}
              </button>
              <Toggle
                onClick={() => toggleCountryEnabled(country.code)}
                visible={enabled.includes(country.code)}
              />
            </div>
          ))}
          {overlays.length > 0 && (
            <div className="flex items-center justify-between py-0.5 text-2xs uppercase tracking-wider">
              <button
                type="button"
                className="flex-1 text-left text-content"
                onClick={() => {
                  setShowConstraints(!showConstraints);
                  setBooleanSettingInLocalStorage(CookieStorageKeys.CONSTRAINTS, !showConstraints);
                }}
              >
                Constraint boundaries
              </button>
              <Toggle
                onClick={() => {
                  setShowConstraints(!showConstraints);
                  setBooleanSettingInLocalStorage(CookieStorageKeys.CONSTRAINTS, !showConstraints);
                }}
                visible={showConstraints}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MapExtrasDrawer;
