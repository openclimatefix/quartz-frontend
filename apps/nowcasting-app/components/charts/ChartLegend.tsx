import Tooltip from "../tooltip";
import { ChartInfo } from "../../ChartInfo";
import { InfoIcon, LegendLineGraphIcon } from "../icons/icons";
import { FC, useEffect } from "react";
import useGlobalState from "../helpers/globalState";
import LegendItem from "./LegendItem";
import { N_HOUR_FORECAST_OPTIONS } from "../../constant";

type ChartLegendProps = {
  className?: string;
};
export const ChartLegend: FC<ChartLegendProps> = ({ className }) => {
  const [showNHourView] = useGlobalState("showNHourView");
  const [nHourForecast, setNHourForecast] = useGlobalState("nHourForecast");

  const legendItemContainerClasses = `flex flex-initial flex-col @sm:gap-1 @6xl:gap-6 @6xl:flex-row ${
    className ? ` ${className}` : ""
  }`;
  return (
    <div className="@container flex flex-initial">
      <div className="flex flex-1 flex-col justify-between align-items:baseline px-4 text-xs tracking-wider text-ocf-gray-300 py-3 gap-3 bg-mapbox-black-500 overflow-y-visible @sm:flex-row @xl:gap-6">
        <div
          className={`flex flex-initial pr-2 justify-between flex-col overflow-x-auto @sm:gap-1 @md:pr-0 @md:flex-col @md:gap-1 @lg:flex-row @lg:gap-8 @3xl:gap-12 @6xl:gap-6`}
        >
          <div className={legendItemContainerClasses}>
            <LegendItem
              iconClasses={"text-ocf-black"}
              dashStyle={"dashed"}
              label={"PV live initial estimate"}
              dataKey={`GENERATION`}
            />
            <LegendItem
              iconClasses={"text-ocf-black"}
              label={"PV live updated"}
              dataKey={`GENERATION_UPDATED`}
            />
          </div>
          <div className={legendItemContainerClasses}>
            <LegendItem
              iconClasses={"text-ocf-yellow"}
              dashStyle={"both"}
              label={"OCF Latest Forecast"}
              dataKey={`FORECAST`}
            />
            {/*<LegendItem*/}
            {/*  iconClasses={"text-ocf-yellow"}*/}
            {/*  label={"OCF Final Forecast"}*/}
            {/*  dataKey={`PAST_FORECAST`}*/}
            {/*/>*/}
            {showNHourView && (
              <LegendItem
                iconClasses={"text-ocf-orange"}
                dashStyle={"both"}
                label={`OCF ${nHourForecast}hr Forecast`}
                dataKey={`N_HOUR_FORECAST`}
              />
            )}
          </div>
        </div>
        <div className="flex flex-1 w-full justify-end items-end gap-3 pr-3 @md:flex-col @lg:gap-4 @2xl:flex-row @3xl:gap-12">
          <div className="flex">
            <div className="h-8 w-10 mr-2 custom-select bg-mapbox-black-600 rounded-md">
              <select
                value={nHourForecast}
                onChange={(e) => setNHourForecast(Number(e.target.value))}
                className="text-sm px-2 py-0 rounded-md"
              >
                {N_HOUR_FORECAST_OPTIONS.map((option) => (
                  <option
                    key={`N-hour-select-option-${option}`}
                    className="text-black bg-white"
                    value={option}
                  >
                    {option}
                  </option>
                ))}
              </select>
            </div>{" "}
            hour <br />
            forecast
          </div>
        </div>
      </div>
    </div>
  );
};
