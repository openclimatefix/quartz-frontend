import { Dispatch, SetStateAction, useEffect } from "react";
import { ActiveUnit } from "./types";
const MeasuringUnit = ({
  map,
  activeUnit,
  setActiveUnit,
  updateFCData,
  isLoading,
  setIsLoading,
  foreCastData,
}: {
  map: mapboxgl.Map;
  activeUnit: ActiveUnit;
  setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>;
  updateFCData: (map: any) => void;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  foreCastData: any;
}) => {
  useEffect(() => {
    if (foreCastData && isLoading) {
      updateFCData(map);
    }
  }, [foreCastData]);

  const onToggle = async (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    unit: ActiveUnit,
  ) => {
    event.preventDefault();
    setIsLoading(true);
    setActiveUnit(unit);
  };

  return (
    <div className="mt-1">
      <p className="text-gray-400 inline-block text-sm mr-2">SHOWING:</p>
      <div className="inline-block">
        <button
          onClick={(event) => onToggle(event, ActiveUnit.percentage)}
          disabled={isLoading}
          type="button"
          className={`relative inline-flex items-center px-3 py-1 text-sm font-extrabold ${
            activeUnit === "%" ? "text-black bg-amber-400" : "text-white bg-black"
          }  ${isLoading ? "cursor-wait" : ""} hover:bg-amber-400`}
        >
          %
        </button>
        <button
          onClick={(event) => onToggle(event, ActiveUnit.MW)}
          disabled={isLoading}
          type="button"
          className={`relative inline-flex items-center px-3 py-1 ml-px text-sm font-extrabold  ${
            activeUnit === "MW" ? "text-black bg-amber-400" : "text-white bg-black"
          } ${isLoading ? "cursor-wait" : ""} hover:bg-amber-400`}
        >
          MW
        </button>
      </div>
    </div>
  );
};

export default MeasuringUnit;
