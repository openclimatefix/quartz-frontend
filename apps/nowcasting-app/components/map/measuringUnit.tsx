import { Dispatch, SetStateAction } from "react";
import { ActiveUnit } from "./types";

const MeasuringUnit = ({
  activeUnit,
  setActiveUnit,
  isLoading
}: {
  activeUnit: ActiveUnit;
  setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>;
  isLoading: boolean;
}) => {
  const onToggle = async (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    unit: ActiveUnit
  ) => {
    event.preventDefault();
    setActiveUnit(unit);
  };
  const buttonClasses =
    "relative inline-flex items-center px-3 py-0.5 text-sm font-extrabold hover:bg-ocf-yellow border-gray-600";

  return (
    <div className="flex justify-end mr-0">
      <div className="inline-block">
        <button
          onClick={(event) => onToggle(event, ActiveUnit.MW)}
          disabled={isLoading}
          type="button"
          className={`${buttonClasses}  ${
            activeUnit === ActiveUnit.MW
              ? "text-black bg-ocf-yellow"
              : "text-white bg-black border-r"
          } ${isLoading ? "cursor-wait" : ""}`}
        >
          MW
        </button>
        <button
          onClick={(event) => onToggle(event, ActiveUnit.percentage)}
          disabled={isLoading}
          type="button"
          className={`${buttonClasses} ${
            activeUnit === ActiveUnit.percentage
              ? "text-black bg-ocf-yellow"
              : "text-white bg-black border-r"
          }  ${isLoading ? "cursor-wait" : ""}`}
        >
          %
        </button>
        {/*<button*/}
        {/*  onClick={(event) => onToggle(event, ActiveUnit.capacity)}*/}
        {/*  disabled={isLoading}*/}
        {/*  type="button"*/}
        {/*  className={`${buttonClasses}  ${*/}
        {/*    activeUnit === ActiveUnit.capacity ? "text-black bg-ocf-yellow" : "text-white bg-black"*/}
        {/*  } ${isLoading ? "cursor-wait" : ""}`}*/}
        {/*>*/}
        {/*  Capacity*/}
        {/*</button>*/}
      </div>
    </div>
  );
};

export default MeasuringUnit;
