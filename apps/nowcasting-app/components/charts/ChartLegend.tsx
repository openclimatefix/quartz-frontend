import Tooltip from "../tooltip";
import { ChartInfo } from "../../ChartInfo";
import { InfoIcon, LegendLineGraphIcon } from "../icons/icons";
import { FC, useEffect } from "react";
import useGlobalState from "../helpers/globalState";
import LegendItem from "./LegendItem";
import { N_HOUR_FORECAST_OPTIONS } from "../../constant";
import LegendTooltip from "../LegendTooltop";
import { NationalAggregation } from "../map/types";

type ChartLegendProps = {
  className?: string;
};
export const ChartLegend: FC<ChartLegendProps> = ({ className }) => {
  const [showNHourView] = useGlobalState("showNHourView");
  const [nHourForecast, setNHourForecast] = useGlobalState("nHourForecast");
  const [selectedMapRegionIds] = useGlobalState("selectedMapRegionIds");
  const [visibleLines] = useGlobalState("visibleLines");
  const [nationalAggregationLevel] = useGlobalState("nationalAggregationLevel");

  const legendItemContainerClasses = `flex flex-initial overflow-y-visible  ${
    showNHourView
      ? "flex-col @sm:gap-1 @6xl:gap-6 @6xl:flex-row"
      : "flex-col @md:gap-1 @3xl:gap-12 @3xl:flex-row"
  }${className ? ` ${className}` : ""}`;

  let nHrTipText;
  if (showNHourView && visibleLines.includes("N_HOUR_FORECAST")) {
    if (selectedMapRegionIds && selectedMapRegionIds.length > 1) {
      nHrTipText =
        "As you have multiple regions selected, N-hour view is (currently) unavailable with multi-select. " +
        "\nSelect a single region to see the \nN-hour forecast.";
    }
    if (
      nationalAggregationLevel === NationalAggregation.DNO &&
      selectedMapRegionIds &&
      selectedMapRegionIds.length > 0
    ) {
      nHrTipText =
        "N-hour view is not (currently) available for DNO-level data. " +
        "\nSelect GSP-level aggregation to see the N-hour forecast.";
    }
  }

  return (
    <div className="@container flex flex-initial">
      <div className="flex flex-1 flex-col justify-between align-items:baseline px-4 text-xs tracking-wider text-ocf-gray-300 py-3 gap-3 bg-mapbox-black-500 overflow-y-visible @sm:flex-row @xl:gap-6">
        <div
          className={`flex flex-initial pr-2 justify-between flex-col overflow-x-auto ${
            showNHourView ? "@sm:gap-1" : ""
          } @md:pr-0 @md:flex-col @md:gap-1 @lg:flex-row @lg:gap-5`}
          style={{ overflow: "visible" }}
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
            <LegendItem
              iconClasses={`text-elexon`}
              dashStyle={"solid"}
              label={`Elexon Day Ahead`}
              dataKey={`ELEXON_DAY_AHEAD`}
            />
          </div>
          <div className={legendItemContainerClasses}>
            <LegendItem
              iconClasses={"text-ocf-yellow"}
              dashStyle={"both"}
              label={"OCF Latest"}
              dataKey={`FORECAST`}
            />
            {/*<LegendItem*/}
            {/*  iconClasses={"text-ocf-yellow"}*/}
            {/*  label={"OCF Final Forecast"}*/}
            {/*  dataKey={`PAST_FORECAST`}*/}
            {/*/>*/}
            {showNHourView && (
              <LegendTooltip
                tip={nHrTipText}
                position={"top"}
                className="relative w-full whitespace-pre-wrap"
              >
                <LegendItem
                  iconClasses={"text-ocf-orange"}
                  dashStyle={"both"}
                  label={`OCF ${nHourForecast}hr`}
                  dataKey={`N_HOUR_FORECAST`}
                />
              </LegendTooltip>
            )}
          </div>
          <div className={legendItemContainerClasses}>
            <LegendItem
              iconClasses={"text-ocf-teal-500"}
              dashStyle={"both"}
              label={`OCF ECMWF-only`}
              dataKey={`INTRADAY_ECMWF_ONLY`}
            />
            <LegendItem
              iconClasses={"text-metOffice"}
              dashStyle={"both"}
              label={`OCF Met Office-only`}
              dataKey={`MET_OFFICE_ONLY`}
            />
            <LegendItem
              iconClasses={"text-ocf-yellow-200"}
              dashStyle={"both"}
              label={`OCF Satellite-only`}
              dataKey={`SAT_ONLY`}
            />
          </div>
        </div>
        {showNHourView && (
          <div className="flex flex-1 w-full justify-end items-end gap-3 pr-3 @md:flex-col @lg:gap-4 @2xl:flex-row @3xl:gap-12">
            <div className="flex">
              <>
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
              </>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
