import { useEffect, useRef, useState } from "react";

type UseUpdateMapStateOnClickProps = {
  map?: mapboxgl.Map;
  isMapReady: boolean;
};
const useUpdateMapStateOnClick = ({ map, isMapReady }: UseUpdateMapStateOnClickProps) => {
  const [clickedGspId, setClickedGspId] = useState<number | undefined>();
  const clickedGspIdRef = useRef(clickedGspId);
  const isEventRegistertedRef = useRef(false);
  useEffect(() => {
    if (map && !isEventRegistertedRef.current) {
      isEventRegistertedRef.current = true;
      map.on("click", "latestPV-forecast", (e) => {
        const clickedFeature = e.features && e.features[0];
        if (clickedFeature) {
          const gspId = clickedFeature.properties?.gsp_id;
          setClickedGspId(gspId);
          if (clickedGspIdRef.current) {
            map.setFeatureState(
              { source: "latestPV", id: clickedGspIdRef.current - 1 },
              { click: false },
            );
          }
          clickedGspIdRef.current = gspId;
          map.setFeatureState({ source: "latestPV", id: gspId - 1 }, { click: true });
        }
      });
    }
  }, [map, isMapReady]);
};
export default useUpdateMapStateOnClick;
