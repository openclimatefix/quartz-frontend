import React from "react";
import { theme } from "../../../tailwind.config";
import { ClockIcon } from "../../icons/icons";
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
    <div className="flex flex-col m-auto h-10 justify-between">
      {/*<div className="flex items-center mt-0.5">*/}
      {/*  <ClockIcon />*/}
      {/*  <p className="text-xs ml-0.5">{time}</p>*/}
      {/*</div>*/}
      <div>
        <ForecastLabel
          tip={
            <div className="w-36">
              <p>{tip}</p>
            </div>
          }
        >
          <p
            // className={`text-lg font-semibold leading-none text-center text-${color}`}
            className={`text-lg font-semibold leading-none mt-0.5 text-center text-${color}`}
            style={{ color: color }}
          >
            <span className="text-black">{pv}</span>
            <span className="text-ocf-gray-300"> / </span>
            {forecast}
            <span className="text-xs text-ocf-gray-300 font-normal"> GW</span>
          </p>
        </ForecastLabel>
      </div>
      <div className="flex items-center -ml-[2px]">
        <ClockIcon />
        <p className="text-xs ml-0.5">{time}</p>
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
    <div className="flex flex-col m-auto h-10 justify-between">
      {/*<div className="flex items-center mt-0.5">*/}
      {/*  <ClockIcon />*/}
      {/*  <p className="text-xs ml-0.5">{time}</p>*/}
      {/*</div>*/}
      <ForecastLabel
        tip={
          <div className="w-28">
            <p>{tip}</p>
          </div>
        }
      >
        <div>
          <p
            // className={`text-lg font-semibold leading-none text-center text-${color}`}
            className={`text-lg font-semibold leading-none mt-0.5 text-center text-${color}`}
            style={{ color: color }}
          >
            {pv}
            <span className="text-xs text-ocf-gray-300 font-normal"> GW</span>
          </p>
        </div>
      </ForecastLabel>
      <div className="flex items-center -ml-[2px]">
        <ClockIcon />
        <p className="text-xs ml-0.5">{time}</p>
      </div>
    </div>
  );
};

type ForecastHeaderProps = {
  forecastNextPV: string;
  forecastPV: string;
  actualPV: string;
  selectedTimeOnly: string;
  pvTimeOnly: string;
  forecastNextTimeOnly: string;
};

const ForecastHeaderUI: React.FC<ForecastHeaderProps> = ({
  forecastNextPV,
  forecastPV,
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
      <div className="flex justify-between flex-2 my-2 px-6">
        <div className="pr-8">
          <ForecastWithActualPV
            forecast={`${forecastPV}`}
            pv={`${actualPV}`}
            tip={`PV Live / OCF Forecast`}
            time={`${pvTimeOnly}`}
            color="ocf-yellow"
          />
        </div>
        <div>
          <NextForecast
            pv={forecastNextPV}
            time={`${forecastNextTimeOnly}`}
            tip={`Next OCF Forecast`}
            color="ocf-yellow"
          />
        </div>
      </div>
      <div className="inline-flex h-full">{children}</div>
    </div>
  );
};

export default ForecastHeaderUI;
