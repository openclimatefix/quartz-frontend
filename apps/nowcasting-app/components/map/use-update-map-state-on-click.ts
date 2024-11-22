import { useEffect, useRef } from "react";
import useGlobalState from "../helpers/globalState";
import { NationalAggregation } from "./types";

type UseUpdateMapStateOnClickProps = {
  map?: mapboxgl.Map;
  isMapReady: boolean;
};
const useUpdateMapStateOnClick = ({ map, isMapReady }: UseUpdateMapStateOnClickProps) => {
  const [clickedGspId, setClickedGspId] = useGlobalState("clickedGspId");
  const [nationalAggregationLevel] = useGlobalState("nationalAggregationLevel");

  const clickedGspIdRef = useRef(clickedGspId);
  const isEventRegistertedRef = useRef(false);
  useEffect(() => {
    if (clickedGspIdRef.current) {
      map?.setFeatureState(
        {
          source: "latestPV",
          id:
            clickedGspId && nationalAggregationLevel === NationalAggregation.GSP
              ? clickedGspIdRef.current
              : clickedGspIdRef.current
        },
        { click: false }
      );
    }

    if (clickedGspId) {
      console.log("map", map?.getFeatureState({ source: "latestPV", id: clickedGspId }));
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
    if (map && !isEventRegistertedRef.current) {
      isEventRegistertedRef.current = true;
      map.on("click", "latestPV-forecast", (e) => {
        const clickedFeature = e.features && e.features[0];
        if (clickedFeature) {
          const id =
            nationalAggregationLevel === NationalAggregation.GSP
              ? clickedFeature.properties?.id
              : clickedFeature.properties?.id;
          if (id !== clickedGspIdRef.current) setClickedGspId(id);
          else setClickedGspId(undefined);
        }
      });
    }
  }, [map, isMapReady]);
};
export default useUpdateMapStateOnClick;
