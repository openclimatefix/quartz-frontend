import React from "react";
import { theme } from "../../../tailwind.config";
import { ClockIcon } from "../../icons";
import ForecastLabel from "../../national_forecast_labels";
const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;

const ForecastWithActualPV: React.FC<{
  forecast: string;
  pv: string;
  time: string;
  tip: string;
  color?: string;
}> = ({ forecast, pv, time, tip, color = yellow }) => {
  return (
    <div className="flex flex-col m-auto h-10">
      <div className="flex justify-items-start">
        <ClockIcon />
        <p className="text-xs">{time}</p>
      </div>
      <div>
        <ForecastLabel
          tip={
            <div className="w-36">
              <p>{tip}</p>
            </div>
          }
        >
          <p className={`text-lg font-semibold text-center text-${color}`} style={{ color: color }}>
            {forecast}
            <span className="text-ocf-gray-300">/</span>
            <span className="text-black">{pv}</span>
            <span className="text-xs text-ocf-gray-300 font-normal"> GW</span>
          </p>
        </ForecastLabel>
      </div>
    </div>
  );
};

const NextForecast: React.FC<{ pv: string; tip: string; time: string; color?: string }> = ({
  pv,
  time,
  tip,
  color = yellow
}) => {
  return (
    <div className="flex flex-col m-auto h-10">
      <div className="flex justify-items-start">
        <ClockIcon />
        <p className="text-xs">{time}</p>
      </div>
      <ForecastLabel
        tip={
          <div className="w-24">
            <p>{tip}</p>
          </div>
        }
      >
        <div>
          <p className={`text-lg font-semibold text-center text-${color}`} style={{ color: color }}>
            {pv}
            <span className="text-xs text-ocf-gray-300 font-normal"> GW</span>
          </p>
        </div>
      </ForecastLabel>
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
          <ForecastWithActualPV
            forecast={`${forcastPV}`}
            pv={`${actualPV}`}
            tip={`OCF Forecast / PV Live`}
            time={`${pvTimeOnly}`}
            color="ocf-yellow"
          />
        </div>
        <div>
          <NextForecast
            pv={forcastNextPV}
            time={`${forecastNextTimeOnly}`}
            tip={`OCF Forecast`}
            color="ocf-yellow"
          />
        </div>
      </div>
      <div className="inline-flex h-full">{children}</div>
    </div>
  );
};

export default ForecastHeaderUI;
