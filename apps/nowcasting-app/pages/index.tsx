import { useUser } from "@auth0/nextjs-auth0/client";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import React, { useEffect, useState } from "react";
import Cookies from "cookies";
import * as Sentry from "@sentry/nextjs";

import Layout from "../components/layout/layout";
import DashboardShell from "../components/shell/dashboard-shell";
import { PvLatestMap } from "../components/map";
import DeltaMap from "../components/map/deltaMap";
import PvRemixChart from "../components/charts/pv-remix-chart";
import DeltaViewChart from "../components/charts/delta-view/delta-view-chart";
import useAndUpdateSelectedTime from "../components/hooks/use-and-update-selected-time";
import useGlobalState, { useCountryState } from "../components/helpers/globalState";
import { useAggregationLevels } from "../hooks/data";
import { defaultLevelOf } from "../components/helpers/aggregationLevels";
import {
  CookieStorageKeys,
  setArraySettingInCookieStorage
} from "../components/helpers/cookieStorage";

/**
 * The dashboard.
 *
 * Since Phase 4 this page fetches nothing — each pane owns its own queries through
 * `hooks/data/*` — and since Phase 6 it does not lay anything out either: `DashboardShell`
 * owns the arrangement (contract §3, §4, §6). What is left is genuinely page-level: which pair
 * of panes is mounted, Sentry identity, and the cookie-persisted settings.
 *
 * **One map and one chart, chosen by the comparison state.** The three `hidden`-class views are
 * gone: Solar Sites moved to `/sites` (§2, Track C) and Delta stopped being a view at all — it
 * is the "vs generation" comparison preset, and the pair below is what that preset selects.
 * Because nothing is mounted-but-hidden any more, no map is ever alive at the wrong size — the
 * two `use-map-chrome` effects that compensated for that went with Track D's shell (Wave 2).
 * What was left — resizing the live map when dashboard mode changes its box — is inlined below
 * (Wave 4): a single effect with one call site does not earn a hook of its own.
 */
export default function Home({ dashboardModeServer }: { dashboardModeServer: string }) {
  useAndUpdateSelectedTime();
  const [comparison] = useGlobalState("comparison");
  const [activeUnit, setActiveUnit] = useGlobalState("activeUnit");
  const { user, isLoading, error } = useUser();
  const [largeScreenMode] = useGlobalState("dashboardMode");
  const [visibleLines] = useGlobalState("visibleLines");
  const [nationalAggregationLevel, setNationalAggregationLevel] = useCountryState(
    "nationalAggregationLevel"
  );
  const [, setClickedGspId] = useCountryState("clickedGspId");
  // A comparison is drawn on the country's finest non-derived level — GB's `gsp`, NL's
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

  // On a comparison change, unset the clicked region if the aggregation is not the finest
  // level, and snap the level to it when a comparison is turned on. Keyed on `comparison`
  // rather than on `view`, which is the same effect it always was — the delta view was
  // reachable only by the switch this state replaced.
  useEffect(() => {
    if (finestLevel && nationalAggregationLevel !== finestLevel.regionType) {
      setClickedGspId(undefined);
    }
    if (comparison && finestLevel) {
      setNationalAggregationLevel(finestLevel.regionType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparison]);

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

  // Resize the live Mapbox instance when dashboard mode changes the container's box — the one
  // chrome change that can alter it without the map hearing about it, and cheap insurance on a
  // mode that runs unattended for days on a wall display. Formerly `use-map-chrome.tsx`; with
  // exactly one effect and one caller left after Track D's shell, the hook was pure indirection.
  const [maps] = useGlobalState("maps");
  useEffect(() => {
    maps.forEach((map) => map.resize());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinedDashboardModeActive]);

  return (
    <Layout>
      <DashboardShell
        dashboardModeActive={combinedDashboardModeActive}
        comparisonActive={!!comparison}
        map={
          comparison ? (
            <DeltaMap activeUnit={activeUnit} setActiveUnit={setActiveUnit} />
          ) : (
            <PvLatestMap activeUnit={activeUnit} setActiveUnit={setActiveUnit} />
          )
        }
        chart={comparison ? <DeltaViewChart /> : <PvRemixChart />}
      />
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
