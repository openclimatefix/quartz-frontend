import { Dispatch, SetStateAction, useEffect } from "react";
import { ActiveUnit } from "./types";
const MeasuringUnit = ({
  activeUnit,
  setActiveUnit,
  isLoading,
}: {
  activeUnit: ActiveUnit;
  setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>;
  isLoading: boolean;
}) => {
  const onToggle = async (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    unit: ActiveUnit,
  ) => {
    event.preventDefault();
    setActiveUnit(unit);
  };

  return (
    <div className="mt-1">
      <div className="inline-block">
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
      </div>
    </div>
  );
};

export default MeasuringUnit;
