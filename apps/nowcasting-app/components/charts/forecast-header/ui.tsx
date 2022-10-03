import React from "react";
import { theme } from "../../../tailwind.config";
const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;

const PVNumber: React.FC<{ pv: string; title: string; color?: string; color2?:string }> = ({
  pv,
  title,
  color = yellow
}) => {
  return (
    <div className="flex-[1] m-auto bg-ocf-gray-900">
      <div className="">
        <div className="flex justify-center mt-1">
          <svg
            viewBox="0 0 32 24" width="1.5rem" height="2rem" xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" fill="white" clip-rule="evenodd"><path d="M12 0c6.623 0 12 5.377 12 12s-5.377 12-12 12-12-5.377-12-12 5.377-12 12-12zm0 1c6.071 0 11 4.929 11 11s-4.929 11-11 11-11-4.929-11-11 4.929-11 11-11zm0 11h6v1h-7v-9h1v8z"/></svg>
          <p className="text-white whitespace-pre text-center mt-2 text-sm">{title}</p>
        </div>
      
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
        National
      </div>
      <PVNumber pv={actualPV} title={`${pvTimeOnly} PVLive`} color="black" />
      <PVNumber pv={forcastPV} title={`${selectedTimeOnly} Forecast`} />
      <PVNumber pv={forcastNextPV} title={`${forecastNextTimeOnly} Forecast`} />
      <div className=" inline-flex bg-ocf-gray-900 items-center h-full py-2">{children}</div>
    </div>
  );
};

export default ForecastHeaderUI;
