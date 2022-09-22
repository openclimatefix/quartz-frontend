import { useEffect, useRef } from "react";
import useGlobalState from "../globalState";

type UseUpdateMapStateOnClickProps = {
  map?: mapboxgl.Map;
  isMapReady: boolean;
};
const useUpdateMapStateOnClick = ({ map, isMapReady }: UseUpdateMapStateOnClickProps) => {
  const [clickedGspId, setClickedGspId] = useGlobalState("clickedGspId");

  const clickedGspIdRef = useRef(clickedGspId);
  const isEventRegistertedRef = useRef(false);
  useEffect(() => {
    if (clickedGspIdRef.current) {
      map?.setFeatureState(
        { source: "latestPV", id: clickedGspIdRef.current - 1 },
        { click: false }
      );
    }

    if (clickedGspId) {
      clickedGspIdRef.current = clickedGspId;
      map?.setFeatureState({ source: "latestPV", id: clickedGspId - 1 }, { click: true });
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
          const gspId = clickedFeature.properties?.gsp_id;
          if (gspId !== clickedGspIdRef.current) setClickedGspId(gspId);
          else setClickedGspId(undefined);
        }
      });
    }
  }, [map, isMapReady]);
};
export default useUpdateMapStateOnClick;
