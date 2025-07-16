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
  const [clickedMapRegionIds, setClickedMapRegionIds] = useGlobalState("clickedMapRegionIds");
  const [selectedMapRegionIds, setSelectedMapRegionIds] = useGlobalState("selectedMapRegionIds");
  const [nationalAggregationLevel] = useGlobalState("nationalAggregationLevel");
  const [, setVisibleLines] = useGlobalState("visibleLines");

  const clickedMapRegionIdsRef = useRef(clickedMapRegionIds);
  const isEventRegistertedRef = useRef(false);

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
            setMapFilterSelectedIds(map, ids);
            setSelectedMapRegionIds([String(clickedFeature.properties?.id)]);
          }
        }
      });
    }
  }, [map, isMapReady]);
};
export default useUpdateMapStateOnClick;
