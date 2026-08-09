import { useEffect, useRef, useState } from "react";

import { getCountryConfig } from "../../config/countries";
import { loadGeoAsset } from "../../lib/geo/assets";
import { useCurrentCountry } from "./use-countries";

/**
 * The seasonal-norm dataset behind `getCountryConfig(country).seasonalNorms` — mean and
 * p-level arrays, bucketed by [month][day], each an array of 48 UTC half-hour slots.
 *
 * Mirrors the shape of `data/national_metrics.json`, which this hook replaces as the way
 * `useFormatChartData` gets at it. See that hook for the consumer-side scaling and indexing.
 */
export type SeasonalNormsData = {
  data: Record<string, Record<string, { mean: number[]; pLevels: number[][] }>>;
  keys: { pLevels: string[] };
};

/**
 * The current country's seasonal-norm dataset, fetched through the same `loadGeoAsset`
 * module cache the map geometry uses, rather than bundled into the JS.
 *
 * `undefined` covers two cases the caller must treat identically: the fetch is still in
 * flight, or the country has no dataset (`seasonalNorms: null`, e.g. NL). Neither is an
 * error — a country with no seasonal-norm dataset must render no seasonal-norm series, not
 * another country's, and not zeros standing in for absence. Collapsing "loading" and
 * "permanently absent" into the same `undefined` is what makes that the only possible
 * outcome rather than something each caller has to remember to check for.
 *
 * URL-keyed the way `useMapGeometry`'s `useGeoAsset` is, for the same reason: switching
 * country while a fetch is in flight must not let the previous country's stale response
 * land after the switch and paint GB's norms under NL's chart.
 */
export const useSeasonalNorms = (): SeasonalNormsData | undefined => {
  const country = useCurrentCountry();
  const url = getCountryConfig(country)?.seasonalNorms ?? undefined;
  const [entry, setEntry] = useState<{ url: string; data: SeasonalNormsData } | undefined>(
    undefined
  );
  const latestUrl = useRef(url);

  useEffect(() => {
    latestUrl.current = url;
    if (!url) return;
    let cancelled = false;
    loadGeoAsset<SeasonalNormsData>(url)
      .then((data) => {
        if (cancelled || latestUrl.current !== url) return;
        setEntry({ url, data });
      })
      .catch(() => {
        // A failed fetch leaves the dataset undefined — the same "no norms" outcome as a
        // country with none configured. There is no error state to surface here: the chart
        // has one legitimate behaviour for "no norms", not two.
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return url && entry?.url === url ? entry.data : undefined;
};

export default useSeasonalNorms;
