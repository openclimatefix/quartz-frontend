import React from "react";
import { theme } from "../../../tailwind.config";
import { UpArrow, DownArrow } from "../../icons/icons";
import ForecastLabel from "../../national_forecast_labels";
import useFormatChartData from "../use-format-chart-data";
import { CloseButtonIcon } from "../../icons/icons";

const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;
const delta100 = theme.extend.colors["ocf-delta"]["100"];
const delta200 = theme.extend.colors["ocf-delta"]["200"];
const delta300 = theme.extend.colors["ocf-delta"]["300"];
const delta400 = theme.extend.colors["ocf-delta"]["400"];
const delta500 = theme.extend.colors["ocf-delta"]["500"];
const delta600 = theme.extend.colors["ocf-delta"]["600"];
const delta700 = theme.extend.colors["ocf-delta"]["700"];
const delta800 = theme.extend.colors["ocf-delta"]["800"];
const delta900 = theme.extend.colors["ocf-delta"]["900"];

const GSPForecastWithActualPV: React.FC<{
  forecast: string;
  pvUpdated: string;
  time: string;
  text: string;
  color?: string;
  onClose?: () => void;
}> = ({ forecast, color = yellow, text }) => {
  return (
    <div className="flex flex-col m-auto h-10 justify-between">
      <div className="flex items-center -ml-[2px]">
        <p className="text-2xs ml-0.5 uppercase leading-tight text-ocf-black w-10 tracking-wider">
          {text}
        </p>
      </div>
      <div>
        <p
          // className={`text-lg font-semibold leading-none text-center text-${color}`}
          className={`text-xl font-semibold leading-none mt-0.5 text-center text-${color}`}
          style={{ color: color }}
        >
          {forecast}
          <span className="text-xs text-ocf-black font-normal"> MW</span>
        </p>
      </div>
    </div>
  );
};

const FourHourForecast: React.FC<{
  pv: string;
  time: string;
  color?: string;
  text: string;
}> = ({ pv, text, color = yellow }) => {
  return (
    <div className="flex flex-col m-auto h-10 justify-between">
      <div className="flex items-center -ml-[2px]">
        <p className="text-2xs ml-0.5 uppercase leading-tight text-ocf-black w-14 tracking-wider">
          {text}
        </p>
      </div>
      <div>
        <p
          // className={`text-lg font-semibold leading-none text-center text-${color}`}
          className={`text-xl font-semibold leading-none mt-0.5 text-center text-${color}`}
          style={{ color: color }}
        >
          {pv}
          <span className="text-xs text-ocf-black font-normal"> MW</span>
        </p>
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
  deltaValue: string;
  timeNow: string;
  installedCapacity?: number;
  title: string;
  onClose?: () => void;
};

const GSPDeltaForecastHeader: React.FC<ForecastHeaderProps> = ({
  forecastNextPV,
  forecastPV,
  title,
  installedCapacity,
  timeNow,
  actualPV,
  pvTimeOnly,
  forecastNextTimeOnly,
  deltaValue,
  onClose
}) => {
  // const deltacolor = delta200

  let deltacolor = `delta100`;
  if (Number(deltaValue) < -60) {
    deltacolor = `ocf-delta-100`;
  } else if (-60 <= Number(deltaValue) && Number(deltaValue) < -40) {
    deltacolor = `ocf-delta-200`;
  } else if (-40 <= Number(deltaValue) && Number(deltaValue) < -20) {
    deltacolor = `ocf-delta-300`;
  } else if (-20 <= Number(deltaValue) && Number(deltaValue) < -2) {
    deltacolor = `ocf-delta-400`;
  } else if (-2 <= Number(deltaValue) && Number(deltaValue) < 2) {
    deltacolor = `ocf-black-800`;
  } else if (2 <= Number(deltaValue) && Number(deltaValue) < 20) {
    deltacolor = `ocf-delta-600`;
  } else if (20 <= Number(deltaValue) && Number(deltaValue) < 40) {
    deltacolor = `ocf-delta-700`;
  } else if (40 <= Number(deltaValue) && Number(deltaValue) < 60) {
    deltacolor = `ocf-delta-800`;
  } else if (60 <= Number(deltaValue) && Number(deltaValue) < 200) {
    deltacolor = `ocf-delta-900`;
  }

  // (Number(deltaValue) > 0 ? deltaPos : deltaNeg;
  //add color gradient here
  const svg = Number(deltaValue) > 0 ? <UpArrow /> : <DownArrow />;
  const noDelta = Number(deltaValue) === 0;
  return (
    <div className="flex content-between bg-ocf-gray-800 h-16">
      <div className="text-white lg:text-xl md:text-lg text-lg font-black m-auto ml-5 flex justify-evenly">
        {title}
      </div>
      <div className="flex justify-between flex-2 my-2 px-6 pb-2">
        <div className="pr-8">
          <GSPForecastWithActualPV
            forecast={`${forecastPV}`}
            text={`Latest Forecast`}
            pvUpdated={`${actualPV}`}
            time={`${pvTimeOnly}`}
            color="ocf-yellow"
          />
        </div>
        <div>
          <FourHourForecast
            pv={forecastNextPV}
            time={`${forecastNextTimeOnly}`}
            text={`Next forecast`}
            color={"ocf-yellow"}
          />
        </div>
      </div>
      <div
        className={`bg-${deltacolor} flex flex-col justify-between pl-3 pr-4 py-2 text-left text-ocf-black uppercase`}
        style={{ background: deltacolor }}
      >
        <p className="leading-tight tracking-wider">Delta</p>
        <div className="flex items-end">
          <div className="pr-2 pt-1"> {noDelta ? "" : svg}</div>
          <p className={`text-xl font-semibold leading-none mt-0.5 text-center`}>
            {deltaValue}
            <span className="text-xs text-ocf-black font-normal"> MW</span>
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="font-bold items-center p-4 text-2xl border-ocf-gray-800 text-white bg-ocf-gray-800 hover:bg-ocf-gray-700 focus:z-10 focus:text-white h-auto"
      >
        <CloseButtonIcon />
      </button>
    </div>
  );
};

export default GSPDeltaForecastHeader;
