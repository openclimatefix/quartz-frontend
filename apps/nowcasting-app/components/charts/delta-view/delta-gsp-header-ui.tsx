import React from "react";
import { theme } from "../../../tailwind.config";
import { UpArrow, DownArrow } from "../../icons/icons";
import { CloseButtonIcon } from "../../icons/icons";
import { DELTA_BUCKET } from "../../../constant";
import { ForecastHeadlineFigure } from "../forecast-header/ui";

const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;

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
  let deltacolor = `ocf-gray-900`;
  if (Number(deltaValue) < DELTA_BUCKET.NEG4) {
    deltacolor = `ocf-delta-100`;
  } else if (DELTA_BUCKET.NEG4 <= Number(deltaValue) && Number(deltaValue) < DELTA_BUCKET.NEG3) {
    deltacolor = `ocf-delta-200`;
  } else if (DELTA_BUCKET.NEG3 <= Number(deltaValue) && Number(deltaValue) < DELTA_BUCKET.NEG2) {
    deltacolor = `ocf-delta-300`;
  } else if (DELTA_BUCKET.NEG2 <= Number(deltaValue) && Number(deltaValue) < DELTA_BUCKET.NEG1) {
    deltacolor = `ocf-delta-400`;
  } else if (DELTA_BUCKET.NEG1 <= Number(deltaValue) && Number(deltaValue) < DELTA_BUCKET.POS1) {
    deltacolor = `ocf-gray-900`;
  } else if (DELTA_BUCKET.POS1 <= Number(deltaValue) && Number(deltaValue) < DELTA_BUCKET.POS2) {
    deltacolor = `ocf-delta-600`;
  } else if (DELTA_BUCKET.POS2 <= Number(deltaValue) && Number(deltaValue) < DELTA_BUCKET.POS3) {
    deltacolor = `ocf-delta-700`;
  } else if (DELTA_BUCKET.POS3 <= Number(deltaValue) && Number(deltaValue) < DELTA_BUCKET.POS4) {
    deltacolor = `ocf-delta-800`;
  } else if (DELTA_BUCKET.POS4 <= Number(deltaValue)) {
    deltacolor = `ocf-delta-900`;
  }

  const svg = Number(deltaValue) > 0 ? <UpArrow /> : <DownArrow />;
  const noDelta = Number(deltaValue) === 0;
  console.log("pvTimeOnly", pvTimeOnly);
  console.log("forecastNextTimeOnly", forecastNextTimeOnly);
  return (
    <div className="flex content-between bg-ocf-gray-800 h-12 dash:h-16">
      <div className="text-white lg:text-xl md:text-lg text-lg font-black m-auto ml-5 flex justify-evenly">
        {title}
      </div>
      <div className="flex justify-between items-center flex-2 my-2 dash:3xl:my-3 px-2 2xl:px-4 3xl:px-6">
        <div className="pr-2 2xl:pr-4 3xl:pr-8">
          {/*<GSPForecastWithActualPV*/}
          {/*  forecast={`${forecastPV}`}*/}
          {/*  text={`Latest Forecast`}*/}
          {/*  pvUpdated={`${actualPV}`}*/}
          {/*  time={`${pvTimeOnly}`}*/}
          {/*  color="ocf-yellow"*/}
          {/*/>*/}
          <ForecastHeadlineFigure tip={"Latest OCF Forecast"} time={pvTimeOnly}>
            {/*<span className="text-black">{actualPV}</span>*/}
            {/*<span className="text-ocf-gray-300 mx-1"> / </span>*/}
            {forecastPV}
          </ForecastHeadlineFigure>
        </div>
        <div>
          {/*<FourHourForecast*/}
          {/*  pv={forecastNextPV}*/}
          {/*  time={`${forecastNextTimeOnly}`}*/}
          {/*  text={`Next forecast`}*/}
          {/*  color={"ocf-yellow"}*/}
          {/*/>*/}
          <ForecastHeadlineFigure tip={"Next OCF Forecast"} time={forecastNextTimeOnly}>
            {/*<span className="text-black">{actualPV}</span>*/}
            {/*<span className="text-ocf-gray-300 mx-1"> / </span>*/}
            {forecastNextPV}
          </ForecastHeadlineFigure>
        </div>
      </div>
      <div
        className={`bg-${deltacolor} flex flex-col justify-between px-2 items-center text-left text-ocf-black uppercase`}
        style={{ background: deltacolor }}
      >
        <div className="flex flex-1 items-center">
          <div className="pr-1 pt-1 hidden 2xl:block"> {noDelta ? "" : svg}</div>
          <p className={`text-2xl 2xl:text-3xl font-semibold leading-none mr-2 text-center`}>
            {deltaValue}
          </p>
          <div className="flex flex-col">
            <p className="text-2xs 2xl:text-xs leading-tight tracking-wider">Delta</p>
            <span className="text-2xs 2xl:text-xs text-ocf-black font-normal"> MW</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="font-bold items-center p-2 text-2xl border-ocf-gray-800 text-white bg-ocf-gray-800 hover:bg-ocf-gray-700 focus:z-10 focus:text-white h-auto"
      >
        <CloseButtonIcon />
      </button>
    </div>
  );
};

export default GSPDeltaForecastHeader;
