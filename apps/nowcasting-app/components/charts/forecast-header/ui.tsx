import React from "react";
import { theme } from "../../../tailwind.config";
const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;

const PVNumber: React.FC<{ pv: string; title: string; color?: string }> = ({
  pv,
  title,
  color = yellow
}) => {
  return (
    <div className="flex-[1] m-auto">
      <div className="">
        <p className="text-white whitespace-pre text-center ">{title}</p>
        <p
          className={`lg:text-xl md:text-lg text-sm font-bold text-center text-${color}`}
          style={{ color: color }}
        >
          {pv}
          <span className=" ml-2 text-white">GW</span>
        </p>
      </div>
    </div>
  );
};
type ForecastHeaderProps = {
  forcastNextPV: string;
  forcastPV: string;
  actualPV: string;
  selectedTimeOnly: string;
  pvTimeOnly: string;
  forecastNextTimeOnly: string;
};

const ForecastHeaderUI: React.FC<ForecastHeaderProps> = ({
  forcastNextPV,
  forcastPV,
  actualPV,
  children,
  selectedTimeOnly,
  pvTimeOnly,
  forecastNextTimeOnly
}) => {
  return (
    <div className={"flex content-between flex-wrap mt-0 h-auto"}>
      <div
        className={`bg-ocf-gray-900 text-white lg:text-2xl md:text-lg text-sm font-OCF-gray-300 p-4 py-2 flex-[2]`}
      >
        National <span className={`text-base text-ocf-gray- ml-2`}>MW</span>
      </div>
      <PVNumber title={`${pvTimeOnly} PVLive`} pv={actualPV}  color="black" />
      <PVNumber pv={forcastPV} title={`${selectedTimeOnly} Forecast`} />
      <PVNumber pv={forcastNextPV} title={`${forecastNextTimeOnly} Forecast`} />
      <div className=" inline-flex items-center h-full m-auto">{children}</div>
    </div>
  );
};

export default ForecastHeaderUI;
