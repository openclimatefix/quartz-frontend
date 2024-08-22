import mapboxgl from "mapbox-gl";

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
