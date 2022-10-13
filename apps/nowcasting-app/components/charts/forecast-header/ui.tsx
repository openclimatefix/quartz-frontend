import React from "react";
import { theme } from "../../../tailwind.config";
const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;

const PVNumber: React.FC<{ pv: string; time: string; color?: string }> = ({
  pv,
  time,
  color = yellow
}) => {
  return (
    <div className="flex flex-col m-auto h-10">
      <div className="flex justify-items-start">
        <svg
          viewBox="0 0 32 32"
          width="16"
          height="16"
          xmlns="http://www.w3.org/2000/svg"
          fill-rule="evenodd"
          fill="white"
          clip-rule="evenodd"
        >
          <path
            d="M12 0c6.623 0 12 5.377 12 12s-5.377 12-12 12-12-5.377-12-12 5.377-12 12-12zm0 1c6.071
             0 11 4.929 11 11s-4.929 11-11 11-11-4.929-11-11 4.929-11 11-11zm0 11h6v1h-7v-9h1v8z"
          />
        </svg>
        <p className="text-xs">{time}</p>
      </div>
      <div>
        <p className={`text-lg font-semibold text-center text-${color}`} style={{ color: color }}>
          {pv}
          <span className="text-xs text-ocf-gray-300 font-normal"> GW</span>
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
    <div className="flex content-between bg-ocf-gray-800 h-auto">
      <div className="text-white lg:text-2xl md:text-lg text-sm font-black m-auto ml-5 flex justify-evenly">
        National
      </div>
      <div className="flex justify-between flex-2 mt-1 px-5">
        <div className="pr-10">
          <PVNumber pv={`${forcastPV}/${actualPV}`} time={`${pvTimeOnly}`} color="black" />
        </div>
        <div>
          <PVNumber pv={forcastNextPV} time={`${forecastNextTimeOnly}`} color="ocf-yellow" />
        </div>
      </div>
      <div className="inline-flex h-full">{children}</div>
    </div>
  );
};

export default ForecastHeaderUI;
