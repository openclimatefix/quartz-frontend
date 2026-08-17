import { useUser } from "@auth0/nextjs-auth0/client";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import React, { useEffect, useState } from "react";
import Cookies from "cookies";
import * as Sentry from "@sentry/nextjs";

import Layout from "../components/layout/layout";
import DashboardShell from "../components/shell/dashboard-shell";
import { PvLatestMap } from "../components/map";
import PvRemixChart from "../components/charts/pv-remix-chart";
import DeltaViewChart from "../components/charts/delta-view/delta-view-chart";
import useAndUpdateSelectedTime from "../components/hooks/use-and-update-selected-time";
import useGlobalState from "../components/helpers/globalState";
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
 * **One map, and one chart chosen by the comparison state.** The three `hidden`-class views are
 * gone: Solar Sites moved to `/sites` (§2, Track C) and Delta stopped being a view at all — it
 * is a comparison preset, and the chart below is what that preset selects.
 * Because nothing is mounted-but-hidden any more, no map is ever alive at the wrong size — the
 * two `use-map-chrome` effects that compensated for that went with Track D's shell (Wave 2).
 * What was left — resizing the live map when dashboard mode changes its box — is inlined below
 * (Wave 4): a single effect with one call site does not earn a hook of its own.
 *
 * **The map no longer swaps.** `DeltaMap` used to be mounted here in place of `PvLatestMap` on
 * a comparison, which tore down and rebuilt the whole Mapbox instance — the flash. `PvLatestMap`
 * reads `comparison` itself now and repaints; see its own doc comment. The chart genuinely is
 * two components (different series, different axes) and still swaps.
 */
export default function Home({ dashboardModeServer }: { dashboardModeServer: string }) {
  useAndUpdateSelectedTime();
  const [comparison] = useGlobalState("comparison");
  const [activeUnit, setActiveUnit] = useGlobalState("activeUnit");
  const { user, isLoading, error } = useUser();
  const [largeScreenMode] = useGlobalState("dashboardMode");
  const [visibleLines] = useGlobalState("visibleLines");

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

  // The comparison change used to snap the aggregation level to the country's finest and clear
  // any selected region. Both are gone with the map merge.
  //
  // The snap existed because `deltaMap` declared itself "single-region-level only" — but the
  // reason it gave was that this page forced the level anyway, which is a description of the
  // behaviour dressed as a rule. `rollUpRegionValues` already accumulates `delta` and `hasDelta`
  // across group members and buckets the result, so a DNO-level delta has been computed all
  // along and simply never offered. The granularity control is live in both modes now
  // (`map-encoding-controls.tsx`), so a control fighting an effect is no longer a risk worth
  // the effect: the level is the user's, whatever the fill encodes.
  //
  // Clearing the selection went with it — it only ever fired because the snap was about to move
  // the level out from under the selected region. Nothing moves the level on a comparison
  // change now, so nothing needs to invalidate the selection either.
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
        map={<PvLatestMap activeUnit={activeUnit} setActiveUnit={setActiveUnit} />}
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
