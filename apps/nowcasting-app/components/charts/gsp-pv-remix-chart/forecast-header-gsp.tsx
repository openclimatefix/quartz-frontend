import React from "react";
import { CloseButtonIcon } from "../../icons/icons";
import DeltaForecastHeaderUI from "../delta-view/delta-header-ui";
import GspDeltaForecastHeaderUI from "../delta-view/delta-gsp-header-ui";

type ForecastHeaderGSPProps = {
  title: string;
  mwpercent: number;
  onClose?: () => void;
  deltaView?: boolean;
};

const ForecastHeaderGSP: React.FC<ForecastHeaderGSPProps> = ({
  title,
  mwpercent,
  children,
  deltaView,
  onClose
}) => {
  return (
    <div id="x" className={"flex content-between flex-wrap mb-3.5 bg-ocf-gray-800 h-12 dash:h-16"}>
      <div
        className={`text-white text-base md:text-lg lg:text-xl dash:text-4xl dash:tracking-wide font-bold flex-[2] ml-5 m-auto py-2`}
      >
        {title}
      </div>
      <div className="flex flex-row justify-between flex-initial m-auto px-6">
        <div className="lg:text-lg md:text-lg dash:text-2xl pr-8">
          <span className="font-semibold text-md dash:text-5xl text-ocf-yellow-500 pr-0.5">
            {mwpercent}
          </span>
          <span className="text-xs dash:text-3xl text-ocf-gray-300">%</span>
        </div>
        <div>{children}</div>
      </div>
      <div></div>
      <button
        type="button"
        onClick={onClose}
        className="font-bold items-center px-3 text-2xl border-l-2 border-mapbox-black-500 text-white bg-ocf-gray-800 hover:bg-ocf-gray-700 focus:z-10 focus:text-white h-full"
      >
        <CloseButtonIcon />
      </button>
    </div>
  );
};

export default ForecastHeaderGSP;
