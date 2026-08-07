import { useEffect } from "react";
import useGlobalState, { useCountryState } from "../helpers/globalState";

/**
 * Keeps the live Mapbox instances in step with the page chrome.
 *
 * All maps stay mounted at once (hidden with a class rather than unmounted, so Mapbox never has
 * to re-initialise on a view switch), which means a map can be resized or re-centred while it is
 * off screen. These three effects are the consequence, lifted verbatim out of `pages/index.tsx`:
 *
 *  1. a map that was hidden while the container resized reports a 400px canvas — resize it;
 *  2. entering or leaving dashboard mode changes the container width for all of them;
 *  3. a country switch moves the registry's centre and zoom, which the *inactive* maps have to
 *     pick up too, or they show the previous country when you switch view.
 */
export const useMapChrome = (view: string, dashboardModeActive: boolean) => {
  const [maps] = useGlobalState("maps");
  const [lat] = useCountryState("lat");
  const [lng] = useCountryState("lng");
  const [zoom] = useCountryState("zoom");

  useEffect(() => {
    maps.forEach((map) => {
      if (map.getCanvas()?.style.width === "400px") {
        map.resize();
      }
    });
  }, [view, maps]);

  useEffect(() => {
    maps.forEach((map) => {
      map.resize();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardModeActive]);

  useEffect(() => {
    maps.forEach((map) => {
      if (map.getContainer().dataset.title === view) return;

      if (map.getCenter().lat !== lat || map.getCenter().lng !== lng) {
        map.setCenter([lng, lat]);
      }
      if (map.getZoom() !== zoom) {
        map.setZoom(zoom);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, zoom]);
};
