import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";

import { getCountryConfig, type GeoLayerConfig } from "../../config/countries";
import { buildMapGeometry, regionAreasKm2 } from "../../components/helpers/data";
import type { AggregationLevel } from "../../components/helpers/aggregationLevels";
import { loadGeoAsset } from "../../lib/geo/assets";
import type { Region } from "../../lib/domain/types";
import { useFocusedCountry } from "./use-countries";

// Boundary geometry — and the grouping files — for the level the map is showing.
//
// This is what replaces the seven `require`d `data/*.json` files. It resolves the asset URLs
// from the registry, fetches them through the module-level cache in `lib/geo/assets.ts`, and
// hands the result to the (now pure) `buildMapGeometry`.
//
// A derived level needs TWO assets: its own polygons (`derivedRegionTypes[x].geometry`) and
// its name-keyed grouping file (`derivedRegionTypes[x].groupings`), which decides the values
// rolled onto them. A non-derived level needs only `geo[regionType]`.
//
// ---------------------------------------------------------------------------------------
// THE OUT-OF-ORDER RESOLVE
// ---------------------------------------------------------------------------------------
// Geometry used to be synchronous, so a level switch was atomic. It is not any more: GB's
// GSP file is 9 MB and its DNO file is 1.4 MB, so switching gsp -> dno while the GSP fetch
// is still in flight resolves them in the wrong order roughly every time. Applying the stale
// response paints one level's polygons and leaves the other level's numbers on them —
// plausible-looking data, no error, and nothing on screen says which level you are reading.
//
// The guard is structural rather than defensive: `useGeoAsset` stores the URL **alongside**
// the parsed asset and compares it at RENDER time, so an asset can only ever be read back
// under the URL it was fetched for. A stale resolve that gets past the effect's own cleanup
// (React 18 StrictMode double-invokes effects; two mounts of the same map interleave) still
// cannot be returned, because by then the requested URL has moved on. The `cancelled` flag
// and the `latestUrl` ref only save a wasted render — the render-time check is what makes
// the wrong answer unrepresentable.
//
// Keying on the URL alone is sufficient and is deliberate: asset paths are country-scoped
// (`/geo/gb/national.json` vs `/geo/nl/national.json`), so a country switch that lands on
// the same region type name is still a different key.

type GeoAssetResult<T> = { data: T | undefined; isLoading: boolean; error: unknown };

// A failed fetch is retried here: `loadGeoAsset` evicts a rejection, but nothing else would
// ask again, and one CDN blip would leave a country without polygons until a reload. Three
// attempts with backoff, then `error` is set; if the asset is still missing when the tab
// regains focus or comes back online, another round starts. `error` stays set through that
// round, so it does not flicker back to loading, and is cleared when the asset arrives.
const GEO_ASSET_ATTEMPTS = 3;
const GEO_ASSET_RETRY_BASE_MS = 1000;

const useGeoAsset = <T>(url: string | undefined): GeoAssetResult<T> => {
  const [entry, setEntry] = useState<{ url: string; data: T } | undefined>(undefined);
  // Keyed by URL like `entry`, so a failure for the previous URL is never reported under this one.
  const [failure, setFailure] = useState<{ url: string; error: unknown } | undefined>(undefined);
  const latestUrl = useRef(url);

  useEffect(() => {
    latestUrl.current = url;
    if (!url) return;
    let cancelled = false;
    let arrived = false;
    let inFlight = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const attempt = (attemptIndex: number) => {
      inFlight = true;
      loadGeoAsset<T>(url)
        .then((data) => {
          inFlight = false;
          if (cancelled || latestUrl.current !== url) return;
          arrived = true;
          setEntry({ url, data });
          setFailure(undefined);
        })
        .catch((err) => {
          inFlight = false;
          if (cancelled || latestUrl.current !== url) return;
          if (attemptIndex + 1 < GEO_ASSET_ATTEMPTS) {
            retryTimer = setTimeout(() => {
              retryTimer = undefined;
              attempt(attemptIndex + 1);
            }, GEO_ASSET_RETRY_BASE_MS * 2 ** attemptIndex);
            return;
          }
          setFailure({ url, error: err });
        });
    };

    const retryIfMissing = () => {
      if (cancelled || arrived || inFlight || retryTimer !== undefined) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      attempt(0);
    };

    attempt(0);
    window.addEventListener("focus", retryIfMissing);
    window.addEventListener("online", retryIfMissing);
    document.addEventListener("visibilitychange", retryIfMissing);
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      window.removeEventListener("focus", retryIfMissing);
      window.removeEventListener("online", retryIfMissing);
      document.removeEventListener("visibilitychange", retryIfMissing);
    };
  }, [url]);

  // The load-bearing guard. An entry fetched for a different URL is simply not this URL's
  // answer, whatever order the promises settled in.
  const data = entry && entry.url === url ? entry.data : undefined;
  const error = failure && failure.url === url && data === undefined ? failure.error : undefined;
  return { data, isLoading: !!url && data === undefined && error === undefined, error };
};

/** The registry entries backing a level: its polygons, and its groupings if it is derived. */
const assetsFor = (
  country: string | null,
  level: AggregationLevel | undefined
): { layer: GeoLayerConfig | undefined; groupingsUrl: string | undefined } => {
  const config = getCountryConfig(country);
  if (!config || !level) return { layer: undefined, groupingsUrl: undefined };
  if (level.derived) {
    const derived = config.derivedRegionTypes[level.regionType];
    return { layer: derived?.geometry, groupingsUrl: derived?.groupings };
  }
  return { layer: config.geo[level.regionType], groupingsUrl: undefined };
};

/**
 * The name-keyed grouping file behind a derived level (`{ "UKPN (East)": ["citr_1", …] }`),
 * or `undefined` for a level the API serves directly.
 *
 * Exported separately from `useMapGeometry` because the GSP chart needs the groupings and
 * nothing else: resolving a DNO selection to its member regions must not drag GB's 9 MB GSP
 * boundary file in behind it. The grouping assets are 3 KB and are shared with the map
 * through `loadGeoAsset`'s cache, so the chart and the map fetch one copy between them.
 *
 * There is no region-type-name lookup table anywhere in this path. The level is read for
 * `derived`, and the URL comes from `config/countries.ts` keyed by the level's own
 * `regionType` — so the `"DNO"` vs `"dno"` case mismatch that silently disabled the grouped
 * chart path mid-Phase-5 has nowhere left to live.
 */
export const useLevelGroupings = (
  level: AggregationLevel | undefined,
  countryCode?: string
): GeoAssetResult<Record<string, string[]>> => {
  const focusedCountry = useFocusedCountry();
  const country = countryCode ?? focusedCountry;
  const { groupingsUrl } = useMemo(() => assetsFor(country, level), [country, level]);
  return useGeoAsset<Record<string, string[]>>(groupingsUrl);
};

export type MapGeometryResult = {
  geometry: FeatureCollection | undefined;
  /**
   * The derived level's grouping file, `undefined` for a non-derived level.
   *
   * Not in the contract's return type; added because the grouping file decides the level's
   * *values* and the polygons decide its *shapes*, and those two must never come from
   * different levels. Returning them together from one URL-keyed resolve is what makes that
   * structurally impossible.
   */
  groupings: Record<string, string[]> | undefined;
  /**
   * Area in km² per region name, for the capacity density fill — `undefined` until the file it
   * is measured from has arrived. Always the level's SOURCE regions (a GSP, a province), never
   * a derived level's own polygons: a rollup's area is the sum of its members', so the rollup
   * sums these the way it sums their capacity (`rollUpRegionValues`).
   *
   * Memoised with the geometry and measured once per boundary file (`featureAreasKm2`), so a
   * value tick never reaches `turf.area`.
   */
  regionAreasKm2: Map<string, number> | undefined;
  isLoading: boolean;
  error: unknown;
};

/**
 * The layer a level's region areas are measured from: the level's own for an API-served level,
 * the level it rolls up for a derived one.
 */
const areaLayerFor = (
  country: string | null,
  level: AggregationLevel | undefined
): GeoLayerConfig | undefined => {
  const config = getCountryConfig(country);
  if (!config || !level) return undefined;
  if (!level.derived) return config.geo[level.regionType];
  const source = config.derivedRegionTypes[level.regionType]?.source;
  return source ? config.geo[source] : undefined;
};

/**
 * `countryCode` defaults to the focused country. The map passes it explicitly: since Phase 6
 * Track F it draws every *enabled* country, one instance of this hook per country, each
 * resolving its own level's assets. Nothing is fetched eagerly — enabling two countries
 * fetches two countries' boundaries and no more, which is the Phase 5 property this had to
 * preserve.
 */
export const useMapGeometry = (
  level: AggregationLevel | undefined,
  regions: Region[] | undefined,
  countryCode?: string,
  options: {
    /**
     * Fetch a derived level's SOURCE boundaries for their areas. Off unless capacity is on the
     * map: on GB's DNO level it is the 9 MB GSP file, which Phase 5 made sure nothing fetches
     * for a level that does not draw it. An API-served level measures its own polygons, which
     * are already here, so this changes nothing for one.
     */
    sourceAreas?: boolean;
  } = {}
): MapGeometryResult => {
  const focusedCountry = useFocusedCountry();
  const country = countryCode ?? focusedCountry;
  // Both come out of the static registry, so these identities are stable for the life of the
  // module and are safe as `useMemo` dependencies.
  const { layer, groupingsUrl } = useMemo(() => assetsFor(country, level), [country, level]);

  const shapes = useGeoAsset<FeatureCollection>(layer?.url);
  const groupings = useGeoAsset<Record<string, string[]>>(groupingsUrl);

  const areaLayer = useMemo(() => areaLayerFor(country, level), [country, level]);
  const sourceShapes = useGeoAsset<FeatureCollection>(
    level?.derived && options.sourceAreas ? areaLayer?.url : undefined
  );
  const areaShapes = level?.derived ? sourceShapes.data : shapes.data;
  const areas = useMemo(() => {
    if (!areaLayer || !areaShapes) return undefined;
    return regionAreasKm2({
      shapes: areaShapes,
      regions,
      joinProperty: areaLayer.joinProperty,
      joinTransform: areaLayer.joinTransform,
      country
    });
  }, [areaLayer, areaShapes, regions, country]);

  const geometry = useMemo(() => {
    if (!level || !layer || !shapes.data) return undefined;
    return buildMapGeometry({
      level,
      shapes: shapes.data,
      groupings: groupings.data,
      regions,
      joinProperty: layer.joinProperty,
      joinTransform: layer.joinTransform,
      country
    });
  }, [level, layer, shapes.data, groupings.data, regions, country]);

  return {
    geometry,
    groupings: groupings.data,
    regionAreasKm2: areas,
    // A level with no boundaries configured is not "loading" — it will never arrive, and it
    // is not an error either: `deriveAggregationLevels` gates the level list on the registry's
    // `geo` block, so the only way here is a derived level whose `geometry` entry is missing,
    // which is a config bug the level list would already have hidden.
    isLoading: shapes.isLoading || groupings.isLoading || sourceShapes.isLoading,
    error: shapes.error ?? groupings.error ?? sourceShapes.error
  };
};

export default useMapGeometry;
