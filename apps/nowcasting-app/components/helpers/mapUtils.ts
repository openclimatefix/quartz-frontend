import mapboxgl from "mapbox-gl";
import type { FeatureCollection } from "geojson";
import { ActiveUnit } from "../map/types";

const MAP_UPDATE_RETRY_MS = 500;

// Updates deferred while a map is loading, per map instance. Each update is keyed by its kind
// and a newer one of the same kind replaces the one waiting, so the replay applies the latest
// requested values and never an older render's closure. Held in memory: it belongs to this map
// and must not outlive it (the sessionStorage marker this replaces survived a reload).
type PendingMapUpdates = {
  updates: Map<string, (map: mapboxgl.Map) => void>;
};
const pendingUpdatesByMap = new WeakMap<mapboxgl.Map, PendingMapUpdates>();

const isMapReadyForUpdate = (map: mapboxgl.Map) =>
  typeof map === "object" &&
  typeof map.getSource === "function" &&
  // @ts-ignore
  !map._removed &&
  map.isStyleLoaded();

export const safelyUpdateMapData = (
  map: mapboxgl.Map,
  updateMapData: (map: mapboxgl.Map) => void,
  updateKind = "data"
) => {
  const mapTitle = map.getContainer().dataset.title;
  const pending = pendingUpdatesByMap.get(map);
  if (isMapReadyForUpdate(map)) {
    // This update supersedes any of its kind still waiting.
    pending?.updates.delete(updateKind);
    updateMapData(map);
    return;
  }
  console.warn(`📍${mapTitle} map & style not loaded yet, deferring update`);
  if (pending) {
    pending.updates.set(updateKind, updateMapData);
    return;
  }
  const entry: PendingMapUpdates = { updates: new Map([[updateKind, updateMapData]]) };
  pendingUpdatesByMap.set(map, entry);
  const replay = () => {
    // @ts-ignore
    if (map._removed) {
      pendingUpdatesByMap.delete(map);
      return;
    }
    if (!isMapReadyForUpdate(map)) {
      setTimeout(replay, MAP_UPDATE_RETRY_MS);
      return;
    }
    pendingUpdatesByMap.delete(map);
    entry.updates.forEach((update) => update(map));
  };
  setTimeout(replay, MAP_UPDATE_RETRY_MS);
};

// The boundary collection last handed to each boundary source, keyed by the source instance.
// `/sites`' `addOrUpdateMapGroup` runs on every cursor step; re-sending the 9 MB GSP and 1.4 MB DNO files
// to the Mapbox worker each time stalled playback. A style reload drops the source, so the new
// instance is absent here and is given the data again when it is re-added.
const boundaryDataBySource = new WeakMap<object, FeatureCollection>();

/**
 * Add a boundary source, or give it `shapeData` once that has arrived. The source is added
 * empty when the fetch has not resolved yet, so the layer naming it always has it to point at,
 * and is populated on the first pass after the data arrives.
 */
export const setBoundarySourceData = (
  map: mapboxgl.Map,
  sourceId: string,
  shapeData: FeatureCollection | undefined
) => {
  const source = map.getSource(sourceId) as unknown as mapboxgl.GeoJSONSource | undefined;
  if (!source) {
    map.addSource(sourceId, {
      type: "geojson",
      data: shapeData ?? { type: "FeatureCollection", features: [] }
    });
    const added = map.getSource(sourceId);
    if (added && shapeData) boundaryDataBySource.set(added, shapeData);
    return;
  }
  if (!shapeData || boundaryDataBySource.get(source) === shapeData) return;
  source.setData(shapeData);
  boundaryDataBySource.set(source, shapeData);
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
