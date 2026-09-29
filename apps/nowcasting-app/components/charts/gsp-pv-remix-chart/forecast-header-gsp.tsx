import { CloseButtonIcon, DownArrow, UpArrow } from "../../icons/icons";
import { NO_VALUE } from "../../../lib/domain/power-unit";
import {
  ForecastHeadlineFigure,
  HEADER_FIGURES,
  HEADER_ROW,
  HEADER_TITLE
} from "../forecast-header/ui";
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
  /**
   * The country's display unit for the readings below, the delta chip included. The chip
   * converts back to MW for its colour buckets, so the thresholds do not move with it.
   */
  unit?: "MW" | "GW";
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
  titleTooltipText = [],
  unit = "MW"
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
    <div className={HEADER_ROW}>
      <div className={HEADER_TITLE}>
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
      <div className={HEADER_FIGURES}>
        {forecastPV && (
          <>
            <div>
              <ForecastHeadlineFigure
                gsp={true}
                tip={"Latest PV Actual / OCF Forecast"}
                time={pvTimeOnly}
                times={pvTimeRange}
                unit={unit}
                color={"solar"}
              >
                <span className="text-solar-light">{pvValue}</span>
                <span className="text-content mx-1"> / </span>
                {forecastPV}
              </ForecastHeadlineFigure>
            </div>
            {!deltaView && forecastNextPV && (
              <div>
                <ForecastHeadlineFigure
                  gsp={true}
                  tip={"Next OCF Forecast"}
                  time={forecastNextTimeOnly}
                  times={forecastNextTimeRange}
                  unit={unit}
                  color={"solar"}
                >
                  {forecastNextPV}
                </ForecastHeadlineFigure>
              </div>
            )}
          </>
        )}
        {deltaView && <DeltaHeaderBlock deltaValue={deltaValue || NO_VALUE} unit={unit} gsp />}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close regional chart"
        // `-my-2` gives back the padding's height, so the hit area stays but the button no
        // longer sets the row's height above the national header's.
        className="flex items-center self-center rounded-md p-2 -my-2 -mr-3 leading-none transition-colors text-interactive focus:z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-interactive"
      >
        <CloseButtonIcon />
      </button>
    </div>
  );
};

export default ForecastHeaderGSP;
