import mapboxgl from "mapbox-gl";

export const safelyUpdateMapData = (
  map: mapboxgl.Map,
  updateMapData: (map: mapboxgl.Map) => void
) => {
  if (
    typeof map !== "object" ||
    typeof map.getSource !== "function" ||
    // @ts-ignore
    map._removed ||
    !map.isStyleLoaded()
  ) {
    if (!map.isStyleLoaded()) {
      console.warn("📍map style not loaded yet, skipping update");
      // -- Check if we've already set a timeout for this map and therefore a check is already pending
      const existingTimeout = localStorage.getItem(
        `MapTimeoutId-${map.getContainer().dataset.title}`
      );
      // -- If we have, skip the update and return
      if (existingTimeout) {
        console.debug("existing timeout running, skipping");
        return;
      }
      // -- Set a new timeout to check whether the map is ready and update the data
      console.debug(`setting new map timeout for ${map.getContainer().dataset.title}`);
      const newTimeout = setTimeout(() => {
        safelyUpdateMapData(map, updateMapData);
        // console.log(`clearing new map timeout for ${map.getContainer().dataset.title}`);
        localStorage.removeItem(`MapTimeoutId-${map.getContainer().dataset.title}`);
      }, 500);
      // -- Save the timeout id to local storage
      console.debug(
        `saving new map timeout id for ${map.getContainer().dataset.title}`,
        newTimeout
      );
      localStorage.setItem(
        `MapTimeoutId-${map.getContainer().dataset.title}`,
        newTimeout.toString()
      );
    }
    return;
  } else {
    console.debug("🎉 map is ready, updating data");
    updateMapData(map);
  }
};
