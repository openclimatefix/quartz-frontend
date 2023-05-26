import React from "react";
import { CloseButtonIcon, DownArrow, UpArrow } from "../../icons/icons";
import { ForecastHeadlineFigure } from "../forecast-header/ui";
import { DeltaHeaderBlock } from "../delta-view/delta-header-ui";

type ForecastHeaderGSPProps = {
  title: string;
  mwpercent: number;
  onClose?: () => void;
  deltaView?: boolean;
  deltaValue?: string;
  pvTimeOnly: string;
  pvValue?: string;
  forecastPV?: string;
  forecastNextTimeOnly?: string;
  forecastNextPV?: string;
};

const ForecastHeaderGSP: React.FC<ForecastHeaderGSPProps> = ({
  title,
  deltaView,
  deltaValue,
  forecastPV,
  pvTimeOnly,
  pvValue,
  forecastNextPV,
  forecastNextTimeOnly,
  onClose
}) => {
  const height = title.length < 12 ? "dash:h-[4.25rem]" : "dash:h-[5.5rem]";
  return (
    <div className={`flex content-between bg-ocf-gray-800 h-12 mb-4 ${height}`}>
      <div className="dash:text-3xl dash:3xl:text-4xl text-white lg:text-xl md:text-lg text-lg font-black m-auto ml-5 flex justify-evenly">
        {title}
      </div>
      <div className="flex justify-between items-center flex-2 my-2 dash:3xl:my-3 px-2 2xl:px-4 3xl:px-6">
        {forecastPV && (
          <>
            <div className={deltaView ? "" : "pr-2 xl:pr-4 3xl:pr-6"}>
              <ForecastHeadlineFigure
                gsp={true}
                tip={"Latest PV Actual / OCF Forecast"}
                time={pvTimeOnly}
                unit={"MW"}
                color={"ocf-yellow"}
              >
                <span className="text-black">{pvValue}</span>
                <span className="text-ocf-gray-300 mx-1"> / </span>
                {forecastPV}
              </ForecastHeadlineFigure>
            </div>
            <div>
              {!deltaView && forecastNextPV && (
                <ForecastHeadlineFigure
                  gsp={true}
                  tip={"Next OCF Forecast"}
                  time={forecastNextTimeOnly}
                  unit={"MW"}
                  color={"ocf-yellow"}
                >
                  {/*<span className="text-black">{actualPV}</span>*/}
                  {/*<span className="text-ocf-gray-300 mx-1"> / </span>*/}
                  {forecastNextPV}
                </ForecastHeadlineFigure>
              )}
            </div>
          </>
        )}
      </div>
      {deltaView && <DeltaHeaderBlock deltaValue={deltaValue || "-"} unit={"MW"} />}
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

export default ForecastHeaderGSP;
