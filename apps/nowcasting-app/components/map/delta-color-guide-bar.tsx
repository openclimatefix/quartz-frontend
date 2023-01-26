import { useMemo } from "react";
import { ActiveUnit } from "./types";

type DeltaColorGuideBarProps = { unit: ActiveUnit };

const DeltaColorGuideBar: React.FC<DeltaColorGuideBarProps> = ({ unit }) => {
  const values = useMemo(() => {
    return [
      { value: "-80", background: "bg-ocf-delta-100", opacity: 3, textColor: "black" },
      { value: "-60", background: "bg-ocf-delta-200", opacity: 20, textColor: "black" },
      { value: "-40", background: "bg-ocf-delta-300", opacity: 40, textColor: "ocf-gray-300" },
      { value: "-20", background: "bg-ocf-delta-400", opacity: 60, textColor: "ocf-gray-300" },
      { value: "0", background: "bg-ocf-delta-500", opacity: 80, textColor: "ocf-gray-300" },
      { value: "+20", background: "bg-ocf-delta-600", opacity: 100, textColor: "ocf-gray-300" },
      { value: "+40", background: "bg-ocf-delta-700", opacity: 100, textColor: "black" },
      { value: "+60", background: "bg-ocf-delta-800", opacity: 100, textColor: "black" },
      { value: "+80", background: "bg-ocf-delta-900", opacity: 100, textColor: "black" }
    ];
  }, [unit]);
  let unitText = "MW";
  return (
    <div className="absolute bg-mapbox-black-700 bottom-10 flex left-0 ml-8 z-20">
      <div className="flex justify-between h-full text-ocf-black-600 font-bold relative items-end text-xs">
        {values.map((value, index) => (
          <div
            key={value.value}
            className={`px-3 py-[1px] ${value.background} whitespace-nowrap ${
              index !== 0 ? "border-l border-ocf-black-100" : ""
            } text-${value.textColor}`}
          >
            {value.value}
            {index === 0 && (
              <span
                className={`font-normal ${
                  value.textColor === "black" ? "text-ocf-black-500" : "text-ocf-gray-600"
                } text-xs`}
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
