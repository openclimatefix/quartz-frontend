import { useMemo } from "react";
import { ActiveUnit, NationalAggregation } from "./types";
import useGlobalState from "../helpers/globalState";

type ColorGuideBarProps = { unit: ActiveUnit };

const ColorGuideBar: React.FC<ColorGuideBarProps> = ({ unit }) => {
  const [nationalAggregationLevel] = useGlobalState("nationalAggregationLevel");
  const values = useMemo(() => {
    if (unit === ActiveUnit.percentage) {
      return [
        { value: "0-10", opacity: 3, textColor: "ocf-gray-300" },
        { value: "10-20", opacity: 20, textColor: "ocf-gray-300" },
        { value: "20-35", opacity: 40, textColor: "ocf-gray-300" },
        { value: "35-50", opacity: 60, textColor: "black" },
        { value: "50-70", opacity: 80, textColor: "black" },
        { value: "70+", opacity: 100, textColor: "black" }
      ];
    }
    if (nationalAggregationLevel === NationalAggregation.GSP) {
      if (unit === ActiveUnit.MW) {
        return [
          { value: "0-50", opacity: 3, textColor: "ocf-gray-300" },
          { value: "50-150", opacity: 20, textColor: "ocf-gray-300" },
          { value: "150-250", opacity: 40, textColor: "ocf-gray-300" },
          { value: "250-350", opacity: 60, textColor: "black" },
          { value: "350-450", opacity: 80, textColor: "black" },
          { value: "450+", opacity: 100, textColor: "black" }
        ];
      } else if (unit === ActiveUnit.capacity) {
        return [
          { value: "0-50", opacity: 3, textColor: "ocf-gray-300" },
          { value: "50-150", opacity: 20, textColor: "ocf-gray-300" },
          { value: "150-250", opacity: 40, textColor: "ocf-gray-300" },
          { value: "250-350", opacity: 60, textColor: "black" },
          { value: "350-450", opacity: 80, textColor: "black" },
          { value: "450+", opacity: 100, textColor: "black" }
        ];
      }
    } else if (
      [NationalAggregation.zone, NationalAggregation.DNO].includes(nationalAggregationLevel)
    ) {
      if (unit === ActiveUnit.MW) {
        return [
          { value: "0-500", opacity: 3, textColor: "ocf-gray-300" },
          { value: "500-1.5k", opacity: 20, textColor: "ocf-gray-300" },
          { value: "1.5k-2.5k", opacity: 40, textColor: "ocf-gray-300" },
          { value: "2.5k-3.5k", opacity: 60, textColor: "black" },
          { value: "3.5k-4.5k", opacity: 80, textColor: "black" },
          { value: "4.5k+", opacity: 100, textColor: "black" }
        ];
      } else if (unit === ActiveUnit.capacity) {
        return [
          { value: "0-500", opacity: 3, textColor: "ocf-gray-300" },
          { value: "500-1.5k", opacity: 20, textColor: "ocf-gray-300" },
          { value: "1.5k-2.5k", opacity: 40, textColor: "ocf-gray-300" },
          { value: "2.5k-3.5k", opacity: 60, textColor: "black" },
          { value: "3.5k-4.5k", opacity: 80, textColor: "black" },
          { value: "4.5k+", opacity: 100, textColor: "black" }
        ];
      }
    }
  }, [unit, nationalAggregationLevel]);
  let unitText = unit === ActiveUnit.MW ? "MW" : "%";
  if (unit === ActiveUnit.capacity) {
    unitText = "MW";
  }
  return (
    <div className="absolute bg-mapbox-black-700 bottom-12 flex left-0 ml-12 z-20">
      <div className="flex justify-between text-xs h-full text-ocf-black-600 font-bold relative items-end md:text-sm dash:text-xl dash:tracking-wide">
        {values?.map((value, index) => (
          <div
            key={value.value}
            className={`px-3 py-[1px] dash:px-4 dash:py-[2px] bg-ocf-yellow/${
              value.opacity
            } whitespace-nowrap ${index !== 0 ? "border-l border-ocf-black-600" : ""} text-${
              value.textColor
            }`}
          >
            {value.value}
            {index === 0 && (
              <span
                className={`font-normal ${
                  value.textColor === "black" ? "text-ocf-black-500" : "text-ocf-gray-600"
                } text-xs ml-1`}
              >
                {unitText}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ColorGuideBar;
