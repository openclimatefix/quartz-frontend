import { useMemo } from "react";
import { ActiveUnit, NationalAggregation } from "./types";
import useGlobalState, { useCountryState } from "../helpers/globalState";
import { NO_DATA_COLOR, NO_DATA_OPACITY } from "./feature-state";

type ColorGuideBarProps = { unit: ActiveUnit };

const ColorGuideBar: React.FC<ColorGuideBarProps> = ({ unit }) => {
  const [nationalAggregationLevel] = useCountryState("nationalAggregationLevel");
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
        {/*
          The map draws three different things and the legend has to name them. A region that
          reported nothing is grey; a region that has not published this slot yet is left
          unfilled (border only); a region generating 0 MW is a real value and gets the first
          band above, which is why that band is 3% opacity rather than invisible.
        */}
        <div
          className="whitespace-nowrap border-l border-ocf-black-600 px-3 py-[1px] text-white dash:px-4 dash:py-[2px]"
          style={{ backgroundColor: NO_DATA_COLOR, opacity: NO_DATA_OPACITY + 0.4 }}
          title="Reported no value for this time. Regions still to publish are left unfilled."
        >
          no data
        </div>
      </div>
    </div>
  );
};

export default ColorGuideBar;
