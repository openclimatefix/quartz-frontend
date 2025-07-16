import { useEffect, useRef } from "react";
import useGlobalState from "../helpers/globalState";
import { NationalAggregation } from "./types";
import { PointLike } from "mapbox-gl";

type UseUpdateMapStateOnClickProps = {
  map?: mapboxgl.Map;
  isMapReady: boolean;
};

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
  const [clickedGspId, setClickedGspId] = useGlobalState("clickedGspId");
  const [clickedMapRegionIds, setClickedMapRegionIds] = useGlobalState("clickedMapRegionIds");
  const [selectedMapRegionIds, setSelectedMapRegionIds] = useGlobalState("selectedMapRegionIds");
  const [nationalAggregationLevel] = useGlobalState("nationalAggregationLevel");
  const [visibleLines, setVisibleLines] = useGlobalState("visibleLines");

  const clickedGspIdRef = useRef(clickedGspId);
  const clickedMapRegionIdsRef = useRef(clickedMapRegionIds);
  const isEventRegistertedRef = useRef(false);
  useEffect(() => {
    if (clickedGspIdRef.current) {
      map?.setFeatureState(
        {
          source: "latestPV",
          id: clickedGspIdRef.current
        },
        { click: false }
      );
    }

    if (clickedGspId) {
      clickedGspIdRef.current = clickedGspId;
      map?.setFeatureState(
        {
          source: "latestPV",
          id:
            nationalAggregationLevel === NationalAggregation.GSP
              ? Number(clickedGspId)
              : clickedGspId
        },
        { click: true }
      );
    } else {
      clickedGspIdRef.current = undefined;
    }
  }, [clickedGspId]);

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

    // // If multiple GSPs are selected, disable the N hour forecast
    if (selectedIds.length > 1) {
      setVisibleLines((prev) => prev.filter((line) => line !== "N_HOUR_FORECAST"));
    }
  }, [clickedMapRegionIds]);

  useEffect(() => {
    if (!map) return;
    if (!selectedMapRegionIds) return;

    // Force ids to be numbers if national aggregation level is GSP for the map filter
    if (nationalAggregationLevel === NationalAggregation.GSP) {
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
          if (e.originalEvent.shiftKey) {
            /*
             TODO: BRAD - multi select working, but remove clicked GSP stuff altogether and
              replace with clickedMapRegionIds everywhere properly; also additional API changes
              to get what we need from the frontend for multiple GSP forecasts with their history.
              This may include a new API endpoint for the GSPs that are selected, as per comments
              on Github issue about GSP forecast history from this week.
            */
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
            const ids =
              nationalAggregationLevel === NationalAggregation.GSP
                ? ([Number(clickedFeature.properties?.id)] as number[])
                : ([String(clickedFeature.properties?.id)] as string[]);
            if (ids[0] !== clickedGspIdRef.current) {
              setMapFilterSelectedIds(map, ids);
              setSelectedMapRegionIds([String(clickedFeature.properties?.id)]);
            } else {
              setMapFilterSelectedIds(map, []);
              setSelectedMapRegionIds([]);
            }
          }
        }
      });
    }
  }, [map, isMapReady]);
};
export default useUpdateMapStateOnClick;
