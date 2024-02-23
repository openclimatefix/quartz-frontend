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
      // Check if we've already set a timeout for this map
      const existingTimeout = localStorage.getItem(
        `MapTimeoutId-${map.getContainer().dataset.title}`
      );
      // If we have, clear it
      if (existingTimeout) {
        // console.log(`clearing existing map timeout for ${map.getContainer().dataset.title}`);
        clearTimeout(Number(existingTimeout));
      }
      // Set a new timeout to check if the map is ready and update the data
      // console.log(`setting new map timeout for ${map.getContainer().dataset.title}`, newTimeout);
      const newTimeout = setTimeout(() => {
        // console.warn("map is not style loaded, trying again");
        safelyUpdateMapData(map, updateMapData);
      }, 500);
      // Save the timeout id to local storage
      localStorage.setItem(
        `MapTimeoutId-${map.getContainer().dataset.title}`,
        newTimeout.toString()
      );
    }
    return;
  } else {
    console.warn("🎉 map is ready, updating data");
    updateMapData(map);
  }
};
