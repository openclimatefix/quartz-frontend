import { useEffect, useMemo } from "react";
import { SITES_API_PREFIX } from "../../constant";
import { useFocusedCountry } from "../../hooks/data";
import type { Scope } from "../../lib/domain/types";
import { useLoadDataFromApi } from "./useLoadDataFromApi";
import { useAggregateSitesDataForTimestamp } from "./useAggregateSitesDataForTimestamp";
import { getSitesLoadingState } from "../helpers/utils";
import useGlobalState from "../helpers/globalState";
import {
  AggregatedSitesCombinedData,
  AllSites,
  CombinedSitesData,
  SitePvActual,
  SitePvForecast,
  SitesCombinedErrors,
  SitesPvActual,
  SitesPvForecast
} from "../types";

/**
 * The Solar Sites view's data, lifted whole out of `pages/index.tsx`.
 *
 * This is deliberately still the **v0** shape — sites are Phase 5 by design (`SITES_API_PREFIX`,
 * `sitesMap.tsx`, `solar-site-view/*` and `satelliteLayer.ts` all stay on v0 until then). Pulling
 * it into one hook is the point: when Phase 5 migrates sites there is a single file holding every
 * v0 sites fetch, rather than a slice of the page component.
 *
 * It owns the `sitesLoadingState` global write, because the effect that computes it needs all
 * three fetches' loading/validating/error triples and nothing outside this hook has them.
 */
export const useSitesViewData = (
  selectedISOTime: string
): {
  sitesData: CombinedSitesData;
  sitesErrors: SitesCombinedErrors;
  aggregatedSitesData: AggregatedSitesCombinedData;
} => {
  const [, setSitesLoadingState] = useGlobalState("sitesLoadingState");

  // Sites stays on its v0 backend this phase (see the module doc comment), but every fetch
  // still carries a Scope — see useLoadDataFromApi's doc comment for why that matters even
  // though SITES_API_PREFIX is GB-only and ignores it.
  const country = useFocusedCountry();
  const scope: Scope = { country, source: "solar", regionType: "site" };

  const {
    data: allSitesData,
    isLoading: allSitesLoading,
    isValidating: allSitesValidating,
    error: allSitesError
  } = useLoadDataFromApi<AllSites>(`${SITES_API_PREFIX}/sites`, {
    isPaused: () => false,
    scope
  });
  const slicedSitesData = useMemo(
    () => allSitesData?.site_list.slice(0, 100) || [],
    [allSitesData]
  );

  // Remove NL sites.
  // NOTE: pinned as-is from `pages/index.tsx` — splicing the array being iterated skips the
  // element after each removal, so two adjacent `nl_` sites leave one behind. Phase 5's problem.
  slicedSitesData.forEach((site, index) => {
    if (site.client_site_name.startsWith("nl_")) {
      slicedSitesData.splice(index, 1);
    }
  });

  const siteUuidsString = slicedSitesData.map((site) => site.site_uuid).join(",");
  const {
    data: sitePvForecastData,
    isLoading: sitePvForecastLoading,
    isValidating: sitePvForecastValidating,
    error: sitePvForecastError
  } = useLoadDataFromApi<SitesPvForecast>(
    `${SITES_API_PREFIX}/sites/pv_forecast?site_uuids=${siteUuidsString}`,
    { scope }
  );
  const {
    data: rawSitesPvActualData,
    isLoading: sitePvActualLoading,
    isValidating: sitePvActualValidating,
    error: sitePvActualError
  } = useLoadDataFromApi<SitesPvActual>(
    `${SITES_API_PREFIX}/sites/pv_actual?site_uuids=${siteUuidsString}`,
    { scope }
  );

  const sitesPvForecastData = useMemo(
    () => sitePvForecastData?.filter((d): d is SitePvForecast => !!d) || [],
    [sitePvForecastData]
  );
  const sitesPvActualData = useMemo(
    () => rawSitesPvActualData?.filter((d): d is SitePvActual => !!d) || [],
    [rawSitesPvActualData]
  );
  const sitesData: CombinedSitesData = useMemo(
    () => ({ allSitesData: slicedSitesData, sitesPvForecastData, sitesPvActualData }),
    [slicedSitesData, sitesPvForecastData, sitesPvActualData]
  );

  const sitesCombinedLoading = useMemo(
    () => ({ allSitesLoading, sitePvForecastLoading, sitePvActualLoading }),
    [allSitesLoading, sitePvForecastLoading, sitePvActualLoading]
  );
  const sitesCombinedValidating = useMemo(
    () => ({ allSitesValidating, sitePvForecastValidating, sitePvActualValidating }),
    [allSitesValidating, sitePvForecastValidating, sitePvActualValidating]
  );
  const sitesErrors: SitesCombinedErrors = useMemo(
    () => ({
      allSitesError,
      sitesPvForecastError: sitePvForecastError,
      sitesPvActualError: sitePvActualError
    }),
    [allSitesError, sitePvForecastError, sitePvActualError]
  );

  const aggregatedSitesData = useAggregateSitesDataForTimestamp(sitesData, selectedISOTime);

  const sitesErrorsLength = Object.values(sitesErrors).filter((e) => !!e).length;
  useEffect(() => {
    setSitesLoadingState(
      getSitesLoadingState(sitesCombinedLoading, sitesCombinedValidating, sitesErrors, sitesData)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitesCombinedLoading, sitesCombinedValidating, sitesErrorsLength, setSitesLoadingState]);

  return { sitesData, sitesErrors, aggregatedSitesData };
};
