import { useUser } from "@auth0/nextjs-auth0/client";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import React, { useEffect, useState } from "react";
import Cookies from "cookies";
import * as Sentry from "@sentry/nextjs";
import { MdKeyboardArrowLeft } from "@react-icons/all-files/md/MdKeyboardArrowLeft";
import { MdKeyboardArrowRight } from "@react-icons/all-files/md/MdKeyboardArrowRight";

import Layout from "../components/layout/layout";
import Header from "../components/layout/header";
import DeprecatedDomainNotice from "../components/layout/deprecated-domain-notice";
import SitesMap from "../components/map/sitesMap";
import SolarSiteChart from "../components/charts/solar-site-view/solar-site-chart";
import useAndUpdateSelectedTime from "../components/hooks/use-and-update-selected-time";
import { useSitesViewData } from "../components/hooks/useSitesViewData";
import useGlobalState from "../components/helpers/globalState";
import { CookieStorageKeys } from "../components/helpers/cookieStorage";
import { VIEWS } from "../constant";

/**
 * Solar Sites, on its own route (Phase 6, Track C — `phase6-layout-contract.md` §2).
 *
 * Sites is tenancy-scoped ("does this user own sites"), never country-scoped, has its own
 * backend (v0), its own geometry (points, not regions) and no country semantics — it was never
 * really a country view, it just lived as a tab on the country dashboard. Moving it here is what
 * stops `useSitesViewData` running unconditionally on the dashboard: opening the Forecast view no
 * longer fetches the sites list, a site forecast and site actuals it never shows.
 *
 * This is a **move, not a redesign** (Brad). It reproduces today's layout — map on the right,
 * chart on the left, an expand handle between them — inline, rather than importing
 * `components/layout/*` or `components/side-layout/*`: both are being rewritten concurrently by
 * Track D for the full-bleed dashboard shell, and depending on either mid-flight would couple
 * this route to a shape that has nothing to do with sites. There is deliberately no header/nav
 * here yet — Track D owns navigation and decides how a user reaches `/sites` from the new shell.
 * Sites gets its own proper chrome when the sites v1 migration lands; this phase only needed the
 * fetch to stop running on the dashboard.
 */
export default function Sites({ dashboardModeServer }: { dashboardModeServer: string }) {
  const selectedISOTime = useAndUpdateSelectedTime();
  const [activeUnit, setActiveUnit] = useGlobalState("activeUnit");
  const { user, isLoading, error } = useUser();
  const [largeScreenMode] = useGlobalState("dashboardMode");
  const [, setView] = useGlobalState("view");

  // The route declares its view, which is how the components still keyed on `view` — the sites
  // chart's time axis, the status banner, the CSV entry in the account menu — know they are
  // here rather than on the dashboard. Track D's half of the move; the dashboard's `view` is
  // written by `setComparison` for the same reason. Wave 4 retires the key.
  useEffect(() => {
    setView(VIEWS.SOLAR_SITES);
    return () => setView(VIEWS.FORECAST);
  }, [setView]);

  // Local state used to set initial state on server side render, then updated by global state —
  // same pattern as `pages/index.tsx`.
  const [combinedDashboardModeActive, setCombinedDashboardModeActive] = useState(
    dashboardModeServer === "true"
  );
  useEffect(() => {
    setCombinedDashboardModeActive(largeScreenMode);
  }, [largeScreenMode]);

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

  const { sitesData, sitesErrors, aggregatedSitesData } = useSitesViewData(selectedISOTime);

  const [isChartOpen, setIsChartOpen] = useState(false);
  // const closedWidth = combinedDashboardModeActive ? "50%" : "56%";
  const closedWidth = "50%";

  return (
    <Layout>
      <div
        className={`h-full relative pt-16${
          combinedDashboardModeActive ? " @container dashboard-mode" : ""
        }`}
      >
        <Header />
        <div
          id="map-container"
          className="relative float-right h-full"
          style={{ width: closedWidth }}
        >
          <SitesMap
            sitesData={sitesData}
            aggregatedSitesData={aggregatedSitesData}
            sitesErrors={sitesErrors}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
          />
        </div>

        {/* The minimal equivalent of `components/side-layout` — just the positioning and the
              expand handle sites actually uses, not the info tooltip (SideLayout already hides
              that one for the Solar Sites view) or anything else D is reshaping. */}
        <div
          className="h-full pt-16 absolute top-0 left-0 z-20"
          style={{ width: isChartOpen ? "90%" : closedWidth }}
        >
          <div className="focus:outline-none h-full text-white justify-between flex flex-col bg-mapbox-black-500 z-20">
            <div className="min-h-full max-h-full flex flex-col">
              <SolarSiteChart
                combinedSitesData={sitesData}
                aggregatedSitesData={aggregatedSitesData}
              />
            </div>
          </div>
          <div className="absolute bottom-12 -right-4 h-10 z-20">
            <button
              className="items-center w-8 h-8 text-lg text-black bg-amber-400 hover:bg-amber-400 focus:bg-amber-400"
              onClick={() => setIsChartOpen((open) => !open)}
            >
              {isChartOpen ? (
                <MdKeyboardArrowLeft size={32} className="m-auto" />
              ) : (
                <MdKeyboardArrowRight size={32} className="m-auto" />
              )}
            </button>
          </div>
        </div>
        <DeprecatedDomainNotice />
      </div>
    </Layout>
  );
}

// Verbatim copy of `pages/index.tsx`'s auth gate — same DEV_MODE branch, same dashboardMode
// cookie read, so sites is gated exactly like the dashboard is.
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
