import { Dispatch, MutableRefObject, SetStateAction, useEffect, useState } from "react";
import { mutate } from "swr";
import { API_PREFIX } from "../../constant";
import { ActiveUnit, SelectedData } from "./types";

const MeasuringUnit = (
  { map, updateFCData, getFillOpacity, loading, setActiveUnit, activeUnit, foreCastData } :
  {
    activeUnit?: ActiveUnit;
    setActiveUnit?: Dispatch<SetStateAction<ActiveUnit>>;
    map?: MutableRefObject<any>;
    updateFCData?: (map: any, isNormalized: boolean, selectedData: string) => Promise<void>;
    getFillOpacity?: (data: string, percentage: boolean) => (string | number | any[])[];
    loading?: boolean;
  }
) => {
  const [isLoading, setIsLoading] = useState(false);
  // const [activeUnit, setActiveUnit] = useState<ActiveUnit>(ActiveUnit.percentage);

  useEffect(() => {
    if(foreCastData) {
      updateFCData(map);
      console.log("====", map.current.getPaintProperty('latestPV-forecast', "fill-opacity"));
    }

  }, [foreCastData])

  const onToggle = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, unit: ActiveUnit) => {
    event.preventDefault();
    setIsLoading(true);
    setActiveUnit(unit);

    // const isNormalized = unit === ActiveUnit.percentage;
    // const selectedDataName = isNormalized
    // ? SelectedData.expectedPowerGenerationNormalized
    // : SelectedData.expectedPowerGenerationMegawatts;

    // await updateFCData(map, isNormalized, selectedDataName);
    // map.current.setPaintProperty('latestPV-forecast', "fill-opacity", getFillOpacity(selectedDataName, isNormalized));
    // map.current.setLayoutProperty(
    //   "pverrorbygsp-delta-labels",
    //   "visibility",
    //   "none"
    // );
    console.log("====", map.current.getPaintProperty('latestPV-forecast', "fill-opacity"));
    setIsLoading(false);
  }

  return (
    <div className="mt-1">
      <p className="text-gray-400 inline-block text-sm mr-2">SHOWING:</p>
      <div className="inline-block">
      <button
          onClick={(event) => onToggle(event, ActiveUnit.percentage)}
          disabled={isLoading}
          type="button"
          className={`relative inline-flex items-center px-3 py-1 text-sm font-extrabold ${activeUnit === "%"? "text-black bg-amber-400" : "text-white bg-black"}  ${isLoading ? "cursor-wait": ""} hover:bg-amber-400`}
        >
          %
        </button>
        <button
          onClick={(event) => onToggle(event, ActiveUnit.MV)}
          disabled={isLoading}
          type="button"
          className={`relative inline-flex items-center px-3 py-1 ml-px text-sm font-extrabold  ${activeUnit === "MV"? "text-black bg-amber-400" : "text-white bg-black"} ${isLoading ? "cursor-wait": ""} hover:bg-amber-400`}
        >
          MW
        </button>
      </div>
    </div>
)};

export default MeasuringUnit;
