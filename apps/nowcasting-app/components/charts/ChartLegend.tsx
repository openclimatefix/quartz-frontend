import Tooltip from "../tooltip";
import { ChartInfo } from "../../ChartInfo";
import { CheckInlineSmall, CrossInlineSmall, InfoIcon, LegendLineGraphIcon } from "../icons/icons";
import React, { FC, useEffect } from "react";
import useGlobalState from "../helpers/globalState";
import LegendItem from "./LegendItem";
import { N_HOUR_FORECAST_OPTIONS } from "../../constant";
import LegendTooltip from "../LegendTooltop";
import { NationalAggregation } from "../map/types";
import LegendTooltipContent from "./LegendTooltipContent";

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
    showNHourView ? "flex-col @sm:gap-0" : "flex-col @md:gap-1"
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

  const ocfForecastTooltipContent = (
    <LegendTooltipContent inputs={["ECMWF", "MET_OFFICE", "SAT"]} />
  );

  const ocfNHrForecastTooltipContent = (
    <LegendTooltipContent inputs={["ECMWF", "MET_OFFICE", "SAT"]} extraText={nHrTipText} />
  );

  const ocfMetOfficeForecastTooltipContent = <LegendTooltipContent inputs={["MET_OFFICE"]} />;

  const ocfEcmwfForecastTooltipContent = <LegendTooltipContent inputs={["ECMWF"]} />;

  const ocfSatForecastTooltipContent = <LegendTooltipContent inputs={["SAT"]} />;

  return (
    <div className="@container flex flex-initial">
      <div className="flex flex-1 flex-col justify-between align-items:baseline px-3 text-xs tracking-wider text-ocf-gray-300 py-2 gap-3 bg-mapbox-black-500 overflow-y-visible @sm:flex-row @xl:gap-6">
        <div
          className={`flex flex-initial pr-2 justify-between flex-col overflow-x-auto @md:pr-0 @md:flex-col @md:gap-0 @lg:flex-row @lg:gap-5`}
          style={{ overflow: "visible" }}
        >
          <div
            className={`${legendItemContainerClasses} hidden @2xl:flex dash:hidden @4xl:dash:flex`}
          >
            <LegendTooltip
              tip={ocfForecastTooltipContent}
              position={"top"}
              className="relative w-full whitespace-pre-wrap"
            >
              <LegendItem
                iconClasses={"text-ocf-yellow"}
                symbolStyle={"both"}
                label={"Current"}
                dataKey={`FORECAST`}
              />
            </LegendTooltip>
            {showNHourView && (
              <LegendTooltip
                tip={ocfNHrForecastTooltipContent}
                position={"top"}
                className="relative w-full whitespace-pre-wrap"
              >
                <LegendItem
                  iconClasses={"text-ocf-orange"}
                  symbolStyle={"both"}
                  label={`${nHourForecast} hour`}
                  dataKey={`N_HOUR_FORECAST`}
                />
              </LegendTooltip>
            )}

            <LegendItem
              iconClasses={"text-[#ffdfd1]"}
              label={"Seasonal norm"}
              dataKey={`SEASONAL_MEAN`}
            />
          </div>
          <div className={legendItemContainerClasses}>
            <LegendTooltip
              tip={ocfEcmwfForecastTooltipContent}
              position={"top"}
              className="relative w-full whitespace-pre-wrap"
            >
              <LegendItem
                iconClasses={"text-ocf-teal-500"}
                symbolStyle={"both"}
                label={`ECMWF-only`}
                dataKey={`INTRADAY_ECMWF_ONLY`}
              />
            </LegendTooltip>
            <LegendTooltip
              tip={ocfMetOfficeForecastTooltipContent}
              position={"top"}
              className="relative w-full whitespace-pre-wrap"
            >
              <LegendItem
                iconClasses={"text-metOffice"}
                symbolStyle={"both"}
                label={`Met Office-only`}
                dataKey={`MET_OFFICE_ONLY`}
              />
            </LegendTooltip>
            <LegendTooltip
              tip={ocfSatForecastTooltipContent}
              position={"top"}
              className="relative w-full whitespace-pre-wrap"
            >
              <LegendItem
                iconClasses={"text-ocf-yellow-200"}
                symbolStyle={"both"}
                label={`Satellite-only`}
                dataKey={`SAT_ONLY`}
              />
            </LegendTooltip>
          </div>
          <div className={legendItemContainerClasses}>
            <LegendItem
              iconClasses={"text-ocf-black"}
              symbolStyle={"dashed"}
              label={"PV live initial"}
              dataKey={`GENERATION`}
            />
            <LegendItem
              iconClasses={"text-ocf-black"}
              label={"PV live updated"}
              dataKey={`GENERATION_UPDATED`}
            />
            {/*<LegendTooltip*/}
            {/*  tip={ocfForecastTooltipContent}*/}
            {/*  position={"top"}*/}
            {/*  className="relative w-full whitespace-pre-wrap @2xl:hidden dash:flex flex-col @4xl:dash:hidden"*/}
            {/*>*/}
            <LegendItem
              iconClasses={"text-[#ffdfd1]"}
              symbolStyle={"area"}
              label={"Seasonal quantiles"}
              dataKey={`SEASONAL_BOUNDS`}
            />
            {/*</LegendTooltip>*/}
            <LegendTooltip
              tip={ocfForecastTooltipContent}
              position={"top"}
              className="relative w-full whitespace-pre-wrap @2xl:hidden dash:flex flex-col @4xl:dash:hidden"
            >
              <LegendItem
                iconClasses={"text-ocf-yellow"}
                symbolStyle={"both"}
                label={"OCF Latest"}
                dataKey={`FORECAST`}
              />
            </LegendTooltip>
            {showNHourView && (
              <LegendTooltip
                tip={ocfNHrForecastTooltipContent}
                position={"top"}
                className="relative w-full whitespace-pre-wrap @2xl:hidden dash:flex flex-col @4xl:dash:hidden"
              >
                <LegendItem
                  iconClasses={"text-ocf-orange"}
                  symbolStyle={"both"}
                  label={`OCF ${nHourForecast}hr`}
                  dataKey={`N_HOUR_FORECAST`}
                />
              </LegendTooltip>
            )}
          </div>
        </div>
        {showNHourView && (
          <div className="flex flex-1 w-full justify-end items-end gap-3 pr-3 pb-1 @md:flex-col @lg:gap-4 @2xl:flex-row @3xl:gap-12">
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
