import mapboxgl from "mapbox-gl";
import { ActiveUnit } from "../map/types";

export const safelyUpdateMapData = (
  map: mapboxgl.Map,
  updateMapData: (map: mapboxgl.Map) => void
) => {
  const mapTitle = map.getContainer().dataset.title;
  if (
    typeof map !== "object" ||
    typeof map.getSource !== "function" ||
    // @ts-ignore
    map._removed ||
    !map.isStyleLoaded()
  ) {
    console.warn(`📍${mapTitle} map & style not loaded yet, skipping update`);
    // -- Check if we've already set a timeout for this map and therefore a check is already pending
    const existingTimeout = sessionStorage.getItem(`MapTimeoutId-${mapTitle}`);
    // -- If we have, skip the update and return
    if (existingTimeout) {
      console.debug(`existing timeout running for ${mapTitle}, skipping`);
      return;
    }
    // -- Set a new timeout to check whether the map is ready and update the data
    console.debug(`setting new map timeout for ${mapTitle}`);
    const newTimeout = setTimeout(() => {
      // console.log(`clearing new map timeout for ${map.getContainer().dataset.title}`);
      sessionStorage.removeItem(`MapTimeoutId-${mapTitle}`);
      console.log(`Timer finished, MapTimeoutId-${mapTitle} rerunning...`);
      safelyUpdateMapData(map, updateMapData);
    }, 500);
    // -- Save the timeout id to local storage
    console.debug(`saving new map timeout id for ${mapTitle}`, newTimeout);
    sessionStorage.setItem(`MapTimeoutId-${mapTitle}`, newTimeout.toString());
  } else {
    console.debug(`🎉 ${mapTitle} map is ready, updating data`);
    updateMapData(map);
  }
};

export const setActiveUnitOnMap = (mapContainer: HTMLDivElement | null, unit: ActiveUnit) => {
  if (!mapContainer) {
    console.warn("Map container not found, skipping unit update");
    return;
  }
  if (!Object.values(ActiveUnit).includes(unit)) {
    console.warn(`Invalid unit: ${unit}, skipping unit update`);
    return;
  }
  mapContainer.dataset.unit = unit;
};

export const getActiveUnitFromMap = (map: mapboxgl.Map) =>
  (map.getContainer().dataset.unit as ActiveUnit) || "MW";

export const getBoundingBoxFromPoint = (point: mapboxgl.Point, hitTolerance = 10) => {
  const bbox: [mapboxgl.PointLike, mapboxgl.PointLike] = [
    [point.x - hitTolerance, point.y - hitTolerance],
    [point.x + hitTolerance, point.y + hitTolerance]
  ];
  return bbox;
};
