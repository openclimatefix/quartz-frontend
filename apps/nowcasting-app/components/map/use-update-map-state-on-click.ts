import { useEffect, useRef } from "react";
import useGlobalState, { focusAndSelectRegions, useCountryState } from "../helpers/globalState";
import { useFocusedCountry } from "../../hooks/data/use-countries";
import { PointLike } from "mapbox-gl";
import {
  FEATURE_KEY_PROPERTY,
  REGION_COUNTRY_PROPERTY,
  featureKeyFor,
  regionIdOfFeatureKey
} from "./country-features";

type UseUpdateMapStateOnClickProps = {
  map?: mapboxgl.Map;
  isMapReady: boolean;
};

/**
 * The feature property naming the country a region belongs to, and the country-qualified
 * feature key. Both are stamped by `country-features.ts` — re-exported here because this is
 * the module that reads them, and Track A's notes name `REGION_COUNTRY_PROPERTY` from here.
 *
 * Contract §1: every enabled country's regions are clickable and clicking one focuses its
 * country — one gesture, no inert map. Since Phase 6 Track F the map draws every enabled
 * country, so the cross-country branch below is live and the fallback to the focused country
 * is only reached for a feature from some other source.
 */
export { REGION_COUNTRY_PROPERTY, FEATURE_KEY_PROPERTY };

const SELECT_BORDERS_LAYER = "latestPV-forecast-select-borders";

/**
 * Outline the selected regions.
 *
 * The filter matches on `featureKey`, not on `id`: with several countries in one source a
 * bare region id can name a region in each of them, and outlining both is a silent wrong
 * answer rather than a visible fault. Building the key from the country the selection belongs
 * to is what confines the outline to that country — and since selection always follows focus
 * (contract §1), that country is always the focused one.
 *
 * Keys are strings, always, which is why the old `Number(id)` coercion for the GSP level has
 * gone: it existed because `["in", "id", "5"]` does not match a numeric `5`, and
 * `featureKeyFor` normalises both spellings to `"GB:5"`.
 */
const setMapFilterSelectedIds = (map: mapboxgl.Map, country: string, ids: string[]) => {
  if (!map) return;

  const selectBordersLayer = map.getLayer(SELECT_BORDERS_LAYER);
  if (!selectBordersLayer) return;

  if (ids.length === 0) {
    map.setFilter(SELECT_BORDERS_LAYER, ["in", FEATURE_KEY_PROPERTY, ""]);
    return;
  }
  map.setFilter(SELECT_BORDERS_LAYER, [
    "in",
    FEATURE_KEY_PROPERTY,
    ...ids.map((id) => featureKeyFor(country, id))
  ]);
};

/** The region ids currently outlined, read back off the filter. */
const selectedIdsFromFilter = (filter: unknown): string[] =>
  Array.isArray(filter)
    ? (filter.slice(2) as string[]).map((key) => regionIdOfFeatureKey(String(key)))
    : [];

const useUpdateMapStateOnClick = ({ map, isMapReady }: UseUpdateMapStateOnClickProps) => {
  const [clickedMapRegionIds, setClickedMapRegionIds] = useCountryState("clickedMapRegionIds");
  const [selectedMapRegionIds, setSelectedMapRegionIds] = useCountryState("selectedMapRegionIds");
  const [nationalAggregationLevel] = useCountryState("nationalAggregationLevel");
  const [, setVisibleLines] = useGlobalState("visibleLines");

  const clickedMapRegionIdsRef = useRef(clickedMapRegionIds);
  clickedMapRegionIdsRef.current = clickedMapRegionIds;
  const selectedMapRegionIdsRef = useRef(selectedMapRegionIds);
  selectedMapRegionIdsRef.current = selectedMapRegionIds;
  const isEventRegistertedRef = useRef(false);
  // The level ref this used to carry is gone with the numeric-id coercion it existed for.
  // Read through a ref because the click handler is
  // registered once and would otherwise close over the country the map had on first render.
  const focusedCountry = useFocusedCountry();
  const focusedCountryRef = useRef(focusedCountry);
  focusedCountryRef.current = focusedCountry;

  useEffect(() => {
    if (!map || !clickedMapRegionIds) return;

    const selectBordersLayer = map.getLayer(SELECT_BORDERS_LAYER);
    if (!selectBordersLayer) return;

    const currentlySelectedIds = map.getFilter(SELECT_BORDERS_LAYER);
    if (!currentlySelectedIds) return;
    // The filter now holds country-qualified keys, so it is un-namespaced before being
    // compared with — or written back into — `selectedMapRegionIds`, which is country-scoped
    // state and speaks bare region ids.
    const outlinedIds = selectedIdsFromFilter(currentlySelectedIds);
    if (selectedMapRegionIds?.join() == outlinedIds.join() && !clickedMapRegionIds) return;

    if (selectedMapRegionIds?.length === 0 && !clickedMapRegionIds.length) {
      setMapFilterSelectedIds(map, focusedCountryRef.current, []);
      return;
    }

    let selectedIds = outlinedIds;

    if (clickedMapRegionIds) {
      for (const id of clickedMapRegionIds) {
        if (!selectedIds.includes(id)) {
          selectedIds.push(id);
        } else {
          selectedIds = selectedIds.filter((i) => i !== id);
        }
      }
      setClickedMapRegionIds(undefined);
    }
    selectedIds = selectedIds.filter((i) => i !== "");
    setSelectedMapRegionIds(selectedIds);
  }, [clickedMapRegionIds]);

  useEffect(() => {
    if (!map) return;
    if (!selectedMapRegionIds) return;

    // The selection always belongs to the focused country — contract §1's "selection sets
    // focus" is what guarantees it, and `focusAndSelectRegions` is what enforces it.
    setMapFilterSelectedIds(map, focusedCountry, selectedMapRegionIds);
  }, [selectedMapRegionIds, focusedCountry]);

  useEffect(() => {
    if (!map) return;

    setSelectedMapRegionIds([]);
  }, [nationalAggregationLevel]);

  useEffect(() => {
    if (map && isMapReady && !isEventRegistertedRef.current) {
      isEventRegistertedRef.current = true;
      map.on("click", "latestPV-forecast", (e) => {
        const clickedFeature = e.features && e.features[0];
        if (clickedFeature) {
          // Whose region was clicked. Stamped onto every feature by `country-features.ts`
          // since Phase 6 Track F; the fallback is now only reached for a feature that did
          // not come through the map's own geometry path.
          const featureCountry = String(
            clickedFeature.properties?.[REGION_COUNTRY_PROPERTY] ?? focusedCountryRef.current
          );

          // A click on another country's region focuses it and starts that country's
          // selection fresh — including under shift, because a selection spanning two
          // countries is exactly what contract §1 makes unreachable. `focusAndSelectRegions`
          // owns the focus-then-select ordering; doing it by hand here would silently drop
          // the click.
          if (featureCountry.toUpperCase() !== focusedCountryRef.current.toUpperCase()) {
            focusAndSelectRegions(featureCountry, [String(clickedFeature.properties?.id)]);
            return;
          }

          if (e.originalEvent.shiftKey) {
            const bbox: [PointLike, PointLike] = [
              [e.point.x - 5, e.point.y - 5],
              [e.point.x + 5, e.point.y + 5]
            ];
            const clickedFeatures = map.queryRenderedFeatures([e.point.x, e.point.y], {
              layers: ["latestPV-forecast"]
            });
            // Confined to the focused country's features. `queryRenderedFeatures` answers for
            // the whole layer, which now carries every enabled country, and a point where two
            // countries' polygons overlap would otherwise build a selection spanning both —
            // the state contract §1 makes unreachable, arriving through the back door.
            const clickedIds = clickedFeatures
              .filter(
                (feature) =>
                  String(
                    feature.properties?.[REGION_COUNTRY_PROPERTY] ?? featureCountry
                  ).toUpperCase() === featureCountry.toUpperCase()
              )
              .map((feature) => feature.properties?.id);
            if (clickedIds.length > 0) {
              const newSelectedMapRegionIds = clickedMapRegionIdsRef?.current
                ? [...clickedMapRegionIdsRef.current]
                : [];
              clickedIds.forEach((id) => {
                if (newSelectedMapRegionIds.includes(id)) {
                  newSelectedMapRegionIds.splice(newSelectedMapRegionIds.indexOf(id), 1);
                } else {
                  newSelectedMapRegionIds.push(id);
                }
              });
              setClickedMapRegionIds(newSelectedMapRegionIds);
            } else {
              console.log("no features clicked");
            }
          } else {
            // Ids are strings throughout now. The numeric branch this used to carry existed
            // only so the `["in", "id", …]` filter would match a numeric `gsp_id`; the filter
            // matches on `featureKey`, which `featureKeyFor` normalises, so there is nothing
            // left for the coercion to fix. `selectedMapRegionIds` was already string-valued.
            let ids: string[] = [String(clickedFeature.properties?.id)];
            //  if there is one selected region, and it is the same as the clicked region, then deselect it
            if (
              selectedMapRegionIdsRef.current &&
              selectedMapRegionIdsRef.current.length === 1 &&
              selectedMapRegionIdsRef.current[0] === String(clickedFeature.properties?.id)
            ) {
              ids = [];
            }
            setMapFilterSelectedIds(map, featureCountry, ids);
            setSelectedMapRegionIds(ids);
          }
        }
      });
    }
  }, [map, isMapReady]);
};
export default useUpdateMapStateOnClick;
