import React from "react";
import { theme } from "../../../tailwind.config";
const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;

const PVNumber: React.FC<{ pv: string; time: string; color?: string }> = ({
  pv,
  time,
  color = yellow
}) => {
  return (
    <div className="flex-[1] m-auto">
      <div className="">
        <p className="">
          <svg
            viewBox="0 0 48 48"
            width="2rem"
            height="2rem"
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
          {time}
        </p>
        <p
          className={`lg:text-xl md:text-lg text-sm font-semibold text-center text-${color}`}
          style={{ color: color }}
        >
          {pv}
          <span className="text-xs text-ocf-gray-300 font-normal">GW</span>
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
    <div className={"flex content-between bg-ocf-gray-800 flex-wrap h-auto"}>
      <div className={`text-white lg:text-2xl md:text-lg text-sm font-black m-auto ml-5 flex-[2]`}>
        National
      </div>
      <PVNumber
        pv={
          <div>
            <span className="text-ocf-yellow font-semibold">{forcastPV}</span>
            <span className="text-white font-semibold">/</span>
            {actualPV}
          </div>
        }
        time={`${pvTimeOnly}`}
        color="black"
      />
      {/* <PVNumber pv={forcastPV} time={`${selectedTimeOnly}`} color="ocf-yellow" /> */}
      <PVNumber pv={forcastNextPV} time={`${forecastNextTimeOnly}`} color="ocf-yellow" />
      <div className="inline-flex items-center h-full">{children}</div>
    </div>
  );
};

export default ForecastHeaderUI;
