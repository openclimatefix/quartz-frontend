import { useUser } from "@auth0/nextjs-auth0/client";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import React, { useEffect, useState } from "react";
import Cookies from "cookies";
import * as Sentry from "@sentry/nextjs";

import Layout from "../components/layout/layout";
import Header from "../components/layout/header";
import DeprecatedDomainNotice from "../components/layout/deprecated-domain-notice";
import SideLayout from "../components/side-layout";
import { PvLatestMap } from "../components/map";
import DeltaMap from "../components/map/deltaMap";
import SitesMap from "../components/map/sitesMap";
import PvRemixChart from "../components/charts/pv-remix-chart";
import DeltaViewChart from "../components/charts/delta-view/delta-view-chart";
import SolarSiteChart from "../components/charts/solar-site-view/solar-site-chart";
import useAndUpdateSelectedTime from "../components/hooks/use-and-update-selected-time";
import { useMapChrome } from "../components/hooks/use-map-chrome";
import { useSitesViewData } from "../components/hooks/useSitesViewData";
import useGlobalState, { useCountryState } from "../components/helpers/globalState";
import { VIEWS } from "../constant";
import { useAggregationLevels } from "../hooks/data";
import { defaultLevelOf } from "../components/helpers/aggregationLevels";
import {
  CookieStorageKeys,
  setArraySettingInCookieStorage
} from "../components/helpers/cookieStorage";

/**
 * The dashboard shell.
 *
 * Since Phase 4 this page fetches nothing for the national and regional views — each view owns
 * its own queries through `hooks/data/*`, so what is left here is genuinely page-level: which
 * view is showing, the layout that puts maps on one side and charts on the other, and the
 * cross-view chrome (Sentry identity, cookie-persisted settings, Mapbox resize/recentre).
 *
 * The one exception is Solar Sites, still on v0 by design and quarantined in
 * `useSitesViewData` — its map and its chart sit in different halves of the layout, so the data
 * has to be held one level above both of them.
 */
export default function Home({ dashboardModeServer }: { dashboardModeServer: string }) {
  useAndUpdateSelectedTime();
  const [view, setView] = useGlobalState("view");
  const [activeUnit, setActiveUnit] = useGlobalState("activeUnit");
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const { user, isLoading, error } = useUser();
  const [largeScreenMode] = useGlobalState("dashboardMode");
  const [visibleLines] = useGlobalState("visibleLines");
  const [nationalAggregationLevel, setNationalAggregationLevel] = useCountryState(
    "nationalAggregationLevel"
  );
  const [, setClickedGspId] = useCountryState("clickedGspId");
  // The delta view is forced onto the country's finest non-derived level — GB's `gsp`, NL's
  // `province` — the same rule `defaultAggregationLevel` uses for the state's initial value
  // (Phase 5 seam 1; was hardcoded `NationalAggregation.GSP`).
  const finestLevel = defaultLevelOf(useAggregationLevels());

  // Local state used to set initial state on server side render, then updated by global state
  const [combinedDashboardModeActive, setCombinedDashboardModeActive] = useState(
    dashboardModeServer === "true"
  );
  useEffect(() => {
    setCombinedDashboardModeActive(largeScreenMode);
  }, [largeScreenMode]);

  useEffect(() => {
    setArraySettingInCookieStorage(CookieStorageKeys.VISIBLE_LINES, visibleLines);
  }, [visibleLines]);

  // On view change, unset the clicked region if the aggregation is not GSP,
  // and set the national aggregation level to GSP if we're now on Delta view
  useEffect(() => {
    if (finestLevel && nationalAggregationLevel !== finestLevel.regionType) {
      setClickedGspId(undefined);
    }
    if (view === VIEWS.DELTA && finestLevel) {
      setNationalAggregationLevel(finestLevel.regionType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const currentView = (v: VIEWS) => v === view;

  useEffect(() => {
    if (user && !isLoading && !error) {
      Sentry.setUser({
        id: user.sub || "",
        email: user.email || "",
        username: user.nickname || "",
        name: user.name,
        locale: user.locale,
        avatar: user.picture
      });
    }
  }, [user, isLoading, error]);

  useMapChrome(view, combinedDashboardModeActive);

  const { sitesData, sitesErrors, aggregatedSitesData } = useSitesViewData(selectedISOTime);

  // const closedWidth = combinedDashboardModeActive ? "50%" : "56%";
  const closedWidth = "50%";

  return (
    <Layout>
      <div
        className={`h-full relative pt-16${
          combinedDashboardModeActive ? " @container dashboard-mode" : ""
        }`}
      >
        <Header view={view} setView={setView} />
        <div
          id="map-container"
          className={`relative float-right h-full`}
          style={{ width: closedWidth }}
        >
          <PvLatestMap
            className={currentView(VIEWS.FORECAST) ? "" : "hidden"}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
          />
          <SitesMap
            className={currentView(VIEWS.SOLAR_SITES) ? "" : "hidden"}
            sitesData={sitesData}
            aggregatedSitesData={aggregatedSitesData}
            sitesErrors={sitesErrors}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
          />
          <DeltaMap
            className={currentView(VIEWS.DELTA) ? "" : "hidden"}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
          />
        </div>

        <SideLayout
          bottomPadding={!currentView(VIEWS.SOLAR_SITES)}
          dashboardModeActive={combinedDashboardModeActive}
        >
          <PvRemixChart className={currentView(VIEWS.FORECAST) ? "" : "hidden"} />
          <SolarSiteChart
            combinedSitesData={sitesData}
            aggregatedSitesData={aggregatedSitesData}
            className={currentView(VIEWS.SOLAR_SITES) ? "" : "hidden"}
          />
          <DeltaViewChart className={currentView(VIEWS.DELTA) ? "" : "hidden"} />
        </SideLayout>
        <DeprecatedDomainNotice />
      </div>
    </Layout>
  );
}

export const getServerSideProps =
  process.env.NEXT_PUBLIC_DEV_MODE === "true"
    ? (context: any) => {
        const cookies = new Cookies(context.req, context.res);
        return {
          props: {
            dashboardModeServer: cookies.get(CookieStorageKeys.DASHBOARD_MODE) || false
          }
        };
      }
    : withPageAuthRequired({
        async getServerSideProps(context) {
          const cookies = new Cookies(context.req, context.res);
          return {
            props: {
              dashboardModeServer: cookies.get(CookieStorageKeys.DASHBOARD_MODE) || false
            }
          };
        }
      });
