import { useEffect, useRef } from "react";
import useGlobalState, { focusAndSelectRegions, useCountryState } from "../helpers/globalState";
import { useFocusedCountry } from "../../hooks/data/use-countries";
import { PointLike } from "mapbox-gl";

type UseUpdateMapStateOnClickProps = {
  map?: mapboxgl.Map;
  isMapReady: boolean;
};

/**
 * The feature property naming the country a region belongs to.
 *
 * Contract §1: every enabled country's regions are clickable and clicking one focuses its
 * country — one gesture, no inert map. That needs the clicked feature to say whose it is.
 *
 * Nothing stamps it yet: the map still draws one country at a time (`useMapGeometry` is
 * scoped to the focused country), so today every feature is unambiguously the focused
 * country's and the fallback below is always taken. **Track D stamps this when it fans the
 * map out over `useEnabledCountryListings()`, and cross-country focus then works with no
 * further change here.**
 */
export const REGION_COUNTRY_PROPERTY = "country";

const setMapFilterSelectedIds = (map: mapboxgl.Map, ids: string[] | number[]) => {
  if (!map) return;

  const selectBordersLayer = map.getLayer("latestPV-forecast-select-borders");
  if (!selectBordersLayer) return;

  if (ids.length === 0) {
    map.setFilter("latestPV-forecast-select-borders", ["in", "id", ""]);
    return;
  }
  map.setFilter("latestPV-forecast-select-borders", ["in", "id", ...ids]);
};

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
  const nationalAggregationLevelRef = useRef(nationalAggregationLevel);
  nationalAggregationLevelRef.current = nationalAggregationLevel;
  // Read through a ref for the same reason as the level above: the click handler is
  // registered once and would otherwise close over the country the map had on first render.
  const focusedCountry = useFocusedCountry();
  const focusedCountryRef = useRef(focusedCountry);
  focusedCountryRef.current = focusedCountry;

  useEffect(() => {
    if (!map || !clickedMapRegionIds) return;

    const selectBordersLayer = map.getLayer("latestPV-forecast-select-borders");
    if (!selectBordersLayer) return;

    let currentlySelectedIds = map.getFilter("latestPV-forecast-select-borders");
    if (!currentlySelectedIds) return;
    if (
      selectedMapRegionIds?.join() == currentlySelectedIds?.slice(2).join() &&
      !clickedMapRegionIds
    )
      return;

    if (selectedMapRegionIds?.length === 0 && !clickedMapRegionIds.length) {
      setMapFilterSelectedIds(map, []);
      return;
    }

    let selectedIds = (currentlySelectedIds?.slice(2) as string[]) || [];

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

    // Force ids to be numbers if national aggregation level is GSP for the map filter.
    // `gsp` is the only region type whose feature ids are numeric (the API's `gsp_id`) —
    // every other region type (DNO/zone groupings, NL's provinces) is keyed on a name, so
    // this is a genuine identity check, not a stand-in for `derived`.
    if (nationalAggregationLevel === "gsp") {
      setMapFilterSelectedIds(
        map,
        selectedMapRegionIds.map((id) => Number(id))
      );
    } else {
      setMapFilterSelectedIds(map, selectedMapRegionIds);
    }
  }, [selectedMapRegionIds]);

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
          // Whose region was clicked. Absent until Track D fans the map out, at which point
          // every branch below is already country-aware.
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
            const clickedIds = clickedFeatures.map((feature) => feature.properties?.id);
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
            let ids: string[] | number[];
            // Same `gsp`-is-the-only-numeric-id-type rule as above, read off the ref because
            // this handler is registered once (see the `isEventRegistertedRef` guard below).
            if (nationalAggregationLevelRef.current === "gsp") {
              ids = [Number(clickedFeature.properties?.id)];
            } else {
              ids = [String(clickedFeature.properties?.id)];
            }
            //  if there is one selected region, and it is the same as the clicked region, then deselect it
            if (
              selectedMapRegionIdsRef.current &&
              selectedMapRegionIdsRef.current.length === 1 &&
              selectedMapRegionIdsRef.current[0] === String(clickedFeature.properties?.id)
            ) {
              ids = [];
            }
            setMapFilterSelectedIds(map, ids);
            setSelectedMapRegionIds([...ids.map((id) => String(id))]);
          }
        }
      });
    }
  }, [map, isMapReady]);
};
export default useUpdateMapStateOnClick;
