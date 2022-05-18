import { Dispatch, SetStateAction } from "react";
import { ActiveUnit } from "./types";

const MeasuringUnit = ({ activeUnit, setActiveUnit}: { activeUnit: ActiveUnit, setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>}) => (
  <div className="mt-1">
    <p className="text-gray-400 inline-block text-sm mr-2">SHOWING:</p>
    <div className="inline-block">
    <button
        onClick={() => setActiveUnit(ActiveUnit.percentage)}
        type="button"
        className={`relative inline-flex items-center px-3 py-1 text-sm font-extrabold ${activeUnit === "%"? "text-black bg-amber-400" : "text-white bg-black"} hover:bg-amber-400`}
      >
        %
      </button>
      <button
        onClick={() => setActiveUnit(ActiveUnit.MV)}
        type="button"
        className={`relative inline-flex items-center px-3 py-1 ml-px text-sm font-extrabold  ${activeUnit === "MV"? "text-black bg-amber-400" : "text-white bg-black"} hover:bg-amber-400`}
      >
        MW
      </button>
    </div>
   
  </div>
);

export default MeasuringUnit;
