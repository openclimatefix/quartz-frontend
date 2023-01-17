import { useMemo } from "react";
import { ActiveUnit } from "./types";

type DeltaColorGuideBarProps = { unit: ActiveUnit };

const DeltaColorGuideBar: React.FC<DeltaColorGuideBarProps> = ({ unit }) => {
  const values = useMemo(() => {
    if (unit === ActiveUnit.MW) {
      return [
        { value: "-80", background: "100", opacity: 3, textColor: "black" },
        { value: "-60", background: "200", opacity: 20, textColor: "black" },
        { value: "-40", background: "300", opacity: 40, textColor: "ocf-gray-300" },
        { value: "-20", background: "400", opacity: 60, textColor: "ocf-gray-300" },
        { value: "0", background: "500", opacity: 80, textColor: "ocf-gray-300" },
        { value: "+20", background: "600", opacity: 100, textColor: "ocf-gray-300" },
        { value: "+40", background: "700", opacity: 100, textColor: "ocf-gray-300" },
        { value: "+60", background: "800", opacity: 100, textColor: "black" },
        { value: "+80", background: "900", opacity: 100, textColor: "ocf-gray-300" }
      ];
    } else if (unit === ActiveUnit.capacity) {
      return [
        { value: "-80", background: "100", opacity: 3, textColor: "ocf-gray-300" },
        { value: "-60", background: "200", opacity: 20, textColor: "ocf-gray-300" },
        { value: "-40", background: "300", opacity: 40, textColor: "ocf-gray-300" },
        { value: "300-400", background: "400", opacity: 60, textColor: "black" },
        { value: "400-500", background: "500", opacity: 80, textColor: "black" },
        { value: "500+", background: "600", opacity: 100, textColor: "black" },
        { value: "500+", background: "700", opacity: 100, textColor: "black" },
        { value: "500+", background: "800", opacity: 100, textColor: "black" },
        { value: "500+", background: "900", opacity: 100, textColor: "black" }
      ];
    } else {
      return [
        { value: "0-10", background: "100", opacity: 3, textColor: "ocf-gray-300" },
        { value: "10-30", opacity: 20, textColor: "ocf-gray-300" },
        { value: "30-50", opacity: 40, textColor: "ocf-gray-300" },
        { value: "50-70", opacity: 60, textColor: "black" },
        { value: "70-90", opacity: 80, textColor: "black" },
        { value: "90+", opacity: 100, textColor: "black" }
      ];
    }
  }, [unit]);
  let unitText = unit === ActiveUnit.MW ? "MW" : "%";
  if (unit === ActiveUnit.capacity) {
    unitText = "MW";
  }
  return (
    <div className="absolute bg-mapbox-black-700 bottom-10 flex left-0 ml-8 z-20">
      <div className="flex justify-between h-full text-ocf-black-600 font-bold relative items-end text-xs">
        {values.map((value, index) => (
          <div
            key={value.value}
            className={`px-3 py-[1px] bg-ocf-delta-${value.background} whitespace-nowrap ${
              index !== 0 ? "border-l border-ocf-black-100" : ""
            } text-${value.textColor}`}
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

export default DeltaColorGuideBar;
