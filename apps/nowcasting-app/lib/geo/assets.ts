/**
 * Fetching the boundary and grouping assets that used to be `require`d into the bundle.
 *
 * Phase 5 moved ~36 MB of GeoJSON out of `components/helpers/data.ts` and under
 * `public/geo/{country}/`. What replaces the `require` is this: a plain `fetch` with a
 * module-level cache, deliberately **not** SWR.
 *
 * Why not SWR, when every other fetch in this app goes through it:
 *
 *  - These are immutable build artefacts served off the CDN with a content hash in the
 *    deploy, not an API response. There is nothing to revalidate, nothing to poll, no
 *    focus-refetch behaviour that makes sense, and no error-retry policy worth having
 *    beyond "the next mount tries again".
 *  - They are consumed by a `useMemo` that has to hand Mapbox a stable object identity.
 *    An SWR record whose `data` identity survives revalidation is a property we would be
 *    relying on rather than asserting.
 *  - The parsed FeatureCollection is up to 9 MB. Caching it once per URL for the life of
 *    the tab is the whole point; SWR's cache is per-provider and the test harness swaps
 *    providers per render, which would re-parse.
 *
 * **The in-flight promise is what is cached, not just the result.** The forecast map and
 * the delta map mount at the same time and ask for the same GSP boundaries in the same
 * tick; caching only the resolved value would issue two 9 MB requests and parse twice.
 *
 * **A rejection is evicted.** A failed fetch must not poison the URL for the rest of the
 * session — a transient 502 on first load would otherwise leave the map permanently blank
 * with no way back short of a reload.
 */

const cache = new Map<string, Promise<unknown>>();

export const loadGeoAsset = <T>(url: string): Promise<T> => {
  const cached = cache.get(url);
  if (cached) return cached as Promise<T>;

  const request = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load geo asset ${url}: ${response.status}`);
      }
      return response.json() as Promise<T>;
    })
    .catch((error) => {
      // Only evict our own entry: a retry that started before this rejection landed has
      // already replaced it, and dropping that one would issue a third request.
      if (cache.get(url) === request) cache.delete(url);
      throw error;
    });

  cache.set(url, request);
  return request as Promise<T>;
};

/**
 * Drop every cached asset. Tests only — a session has no reason to forget an immutable
 * artefact, and the maps rely on the cache to mount together without double-fetching.
 */
export const clearGeoAssetCache = (): void => {
  cache.clear();
};
