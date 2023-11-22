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
    console.log("map not ready", map);
    if (!map.isStyleLoaded()) {
      setTimeout(() => {
        // console.log("map is not style loaded, trying again");
        safelyUpdateMapData(map, updateMapData);
      }, 400);
    }
    return;
  } else {
    console.warn("🎉 map is ready, updating data");
    updateMapData(map);
  }
};
