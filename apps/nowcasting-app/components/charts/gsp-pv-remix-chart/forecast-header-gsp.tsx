import { CloseButtonIcon, DownArrow, UpArrow } from "../../icons/icons";
import { ForecastHeadlineFigure } from "../forecast-header/ui";
import { DeltaHeaderBlock } from "../delta-view/delta-header-block";
import React, { FC } from "react";
import ForecastLabel from "../../national_forecast_labels";

type ForecastHeaderGSPProps = {
  title: string;
  mwpercent: number;
  onClose?: () => void;
  deltaView?: boolean;
  deltaValue?: string;
  pvTimeOnly: string;
  /** The period that instant names, stacked under the clock. See `ForecastHeadlineFigure`. */
  pvTimeRange?: [string, string];
  pvValue?: string;
  forecastPV?: string;
  forecastNextTimeOnly?: string;
  forecastNextTimeRange?: [string, string];
  forecastNextPV?: string;
  children?: React.ReactNode;
  titleTooltipText?: string[];
};

const ForecastHeaderGSP: FC<ForecastHeaderGSPProps> = ({
  title,
  deltaView,
  deltaValue,
  forecastPV,
  pvTimeOnly,
  pvTimeRange,
  pvValue,
  forecastNextPV,
  forecastNextTimeOnly,
  forecastNextTimeRange,
  onClose,
  titleTooltipText = []
}) => {
  const titleTooltipContent = (
    <ul className="text-left">
      {titleTooltipText.map((gspName) => (
        <li key={gspName} className="text-content text-xs font-normal">
          {gspName}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="mx-2 mb-1.5 flex flex-initial content-between rounded-md">
      <div className="mx-auto my-0 ml-0 flex items-center gap-2">
        <span className="text-base leading-tight text-content lg:text-lg dash:text-2xl">
          {titleTooltipText.length ? (
            <ForecastLabel className="" position={"left"} tip={titleTooltipContent}>
              {title}
            </ForecastLabel>
          ) : (
            title
          )}
        </span>
      </div>
      <div className="flex flex-2 items-center justify-between">
        {forecastPV && (
          <>
            <div className={deltaView ? "" : "pr-3 lg:pr-4"}>
              <ForecastHeadlineFigure
                gsp={true}
                tip={"Latest PV Actual / OCF Forecast"}
                time={pvTimeOnly}
                times={pvTimeRange}
                unit={"MW"}
                color={"solar"}
              >
                <span className="text-solar-light">{pvValue}</span>
                <span className="text-content mx-1"> / </span>
                {forecastPV}
              </ForecastHeadlineFigure>
            </div>
            <div>
              {!deltaView && forecastNextPV && (
                <ForecastHeadlineFigure
                  gsp={true}
                  tip={"Next OCF Forecast"}
                  time={forecastNextTimeOnly}
                  times={forecastNextTimeRange}
                  unit={"MW"}
                  color={"solar"}
                >
                  {/*<span className="text-content-on-accent">{actualPV}</span>*/}
                  {/*<span className="text-content mx-1"> / </span>*/}
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
        aria-label="Close regional chart"
        className="flex items-center self-center rounded-md p-2 -mr-3 leading-none transition-colors text-interactive focus:z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-interactive"
      >
        <CloseButtonIcon />
      </button>
    </div>
  );
};

export default ForecastHeaderGSP;
