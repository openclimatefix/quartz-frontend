import { useMemo } from "react";
import { ActiveUnit } from "./types";

type ColorGuideBarProps = { unit: ActiveUnit };

const ColorGuideBar: React.FC<ColorGuideBarProps> = ({ unit }) => {
  const values = useMemo(() => {
    if (unit === ActiveUnit.MW) {
      return [500, 400, 300, 200, 100, 0];
    } else {
      return ["100%", "80%", "60%", "40%", "20%", "0%"];
    }
  }, [unit]);
  return (
    <div className="flex w-8 h-96 bg-mapbox-black-700  absolute right-3 top-1/4 z-20 ">
      <div className="flex flex-col justify-between w-0 h-full text-white relative items-end text-xs">
        {values.map((value) => (
          <div key={value} className=" mr-1">
            {value}-
          </div>
        ))}
      </div>
      <div className=" h-full w-full bg-gradient-to-b from-ocf-yellow  to-transparent "></div>
    </div>
  );
};

export default ColorGuideBar;
