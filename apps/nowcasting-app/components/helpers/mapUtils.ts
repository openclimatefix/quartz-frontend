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
        safelyUpdateMapData(map, updateMapData);
      }, 200);
    }
    return;
  }
  updateMapData(map);
};
