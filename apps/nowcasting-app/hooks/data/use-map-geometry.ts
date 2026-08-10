import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";

import { getCountryConfig, type GeoLayerConfig } from "../../config/countries";
import { buildMapGeometry } from "../../components/helpers/data";
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

const useGeoAsset = <T>(url: string | undefined): GeoAssetResult<T> => {
  const [entry, setEntry] = useState<{ url: string; data: T } | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const latestUrl = useRef(url);

  useEffect(() => {
    latestUrl.current = url;
    if (!url) {
      setError(undefined);
      return;
    }
    let cancelled = false;
    setError(undefined);
    loadGeoAsset<T>(url)
      .then((data) => {
        if (cancelled || latestUrl.current !== url) return;
        setEntry({ url, data });
      })
      .catch((err) => {
        if (cancelled || latestUrl.current !== url) return;
        setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  // The load-bearing guard. An entry fetched for a different URL is simply not this URL's
  // answer, whatever order the promises settled in.
  const data = entry && entry.url === url ? entry.data : undefined;
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
  level: AggregationLevel | undefined
): GeoAssetResult<Record<string, string[]>> => {
  const country = useFocusedCountry();
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
  isLoading: boolean;
  error: unknown;
};

export const useMapGeometry = (
  level: AggregationLevel | undefined,
  regions: Region[] | undefined
): MapGeometryResult => {
  const country = useFocusedCountry();
  // Both come out of the static registry, so these identities are stable for the life of the
  // module and are safe as `useMemo` dependencies.
  const { layer, groupingsUrl } = useMemo(() => assetsFor(country, level), [country, level]);

  const shapes = useGeoAsset<FeatureCollection>(layer?.url);
  const groupings = useGeoAsset<Record<string, string[]>>(groupingsUrl);

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
    // A level with no boundaries configured is not "loading" — it will never arrive, and it
    // is not an error either: `deriveAggregationLevels` gates the level list on the registry's
    // `geo` block, so the only way here is a derived level whose `geometry` entry is missing,
    // which is a config bug the level list would already have hidden.
    isLoading: shapes.isLoading || groupings.isLoading,
    error: shapes.error ?? groupings.error
  };
};

export default useMapGeometry;
