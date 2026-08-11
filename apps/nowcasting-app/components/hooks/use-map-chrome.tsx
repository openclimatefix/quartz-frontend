import { useEffect } from "react";
import useGlobalState from "../helpers/globalState";

/**
 * Keeps the live Mapbox instances in step with the page chrome.
 *
 * This used to be three effects, all of them compensation for maps that were mounted but
 * hidden with a class: resize a map whose canvas reports 400px, resize them all when dashboard
 * mode changes the container width, and re-centre the *inactive* maps on a country switch so
 * they did not show the previous country when you switched view.
 *
 * Phase 6 mounts one map at a time (`components/shell/dashboard-shell.tsx`), so two of the
 * three had nothing left to compensate for: there is no hidden map to have missed a resize,
 * and no inactive map to have missed a country change — `map.tsx` moves the camera itself when
 * `focusedCountry` changes.
 *
 * What survives is the dashboard-mode resize. It is the one chrome change that can alter the
 * map's box without the map hearing about it, and it is cheap insurance on a mode that runs
 * unattended for days on a wall display. Wave 4 decides whether even that is still earned.
 */
export const useMapChrome = (dashboardModeActive: boolean) => {
  const [maps] = useGlobalState("maps");

  useEffect(() => {
    maps.forEach((map) => {
      map.resize();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardModeActive]);
};
