import { useMemo } from "react";

import { getCountryConfig } from "../../config/countries";
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from "../../components/helpers/utils";
import { useFocusedCountry } from "./use-countries";

/**
 * The zone and locale every date helper is rendered in, for the country currently selected.
 *
 * Phase 3 parameterised each helper as `(…, timezone = "Europe/London", locale = "en-GB")`
 * and left the call sites on those defaults. This is the single place the defaults are
 * replaced by the registry's values, so a call site reads
 * `formatISODateStringHuman(t, timezone, locale)` and needs to know nothing about countries.
 *
 * A country with no registry entry falls back to the helper defaults rather than throwing.
 * That state is legal — `/countries` returns every country the API serves, including ones
 * this build has no config for — and `useEntitledCountries` already refuses to make such a
 * country selectable, so the fallback is a safety net rather than a supported mode.
 */
export type CountryFormatting = {
  timezone: string;
  locale: string;
};

export const useCountryFormatting = (): CountryFormatting => {
  const country = useFocusedCountry();
  return useMemo(() => {
    const config = getCountryConfig(country);
    return {
      // The country's zone, so a Dutch slot is shown at Dutch wall-clock time...
      timezone: config?.timezone ?? DEFAULT_TIMEZONE,
      // ...but never the country's locale. `config.locale` is "nl-NL" for NL, which rendered
      // the chart's own axis in Dutch ("di 11", "wo 12") while the scrub track directly below
      // it read "Tue 12:00" — two time axes, one screen, two languages. Dates and times are
      // written the GB way throughout until a per-user preference lands; `DEFAULT_LOCALE` is
      // re-exported from `lib/time/display.ts`, which is that seam. The registry keeps
      // `locale` for that day.
      locale: DEFAULT_LOCALE
    };
  }, [country]);
};
