import Tooltip from "../tooltip";
import { ChartInfo } from "../../ChartInfo";
import { CheckInlineSmall, CrossInlineSmall, InfoIcon, LegendLineGraphIcon } from "../icons/icons";
import React, { FC, useEffect } from "react";
import useGlobalState, { useCountryState } from "../helpers/globalState";
import LegendItem from "./LegendItem";
import { N_HOUR_FORECAST_OPTIONS } from "../../constant";
import LegendTooltip from "../LegendTooltop";
import LegendTooltipContent from "./LegendTooltipContent";
import { useFocusedCountry, useGenerationSources } from "../../hooks/data";
import { getCountryConfig } from "../../config/countries";
import { GENERATION_CHART_KEYS } from "./pv-remix-chart";

type ChartLegendProps = {
  className?: string;
};
export const ChartLegend: FC<ChartLegendProps> = ({ className }) => {
  const [showNHourView] = useGlobalState("showNHourView");
  const [nHourForecast, setNHourForecast] = useGlobalState("nHourForecast");
  const [selectedMapRegionIds] = useCountryState("selectedMapRegionIds");
  const [visibleLines] = useGlobalState("visibleLines");
  const [nationalAggregationLevel] = useCountryState("nationalAggregationLevel");

  // The comparison-model entries are the country's own chart series, minus the primary one
  // (which has its own two breakpoint-specific entries below) and minus any series with no
  // legend presentation. GB yields ECMWF/Met Office/Satellite, exactly as before; NL yields
  // none, because NL charts one line.
  const focusedCountry = useFocusedCountry();
  const modelLegendItems = (getCountryConfig(focusedCountry)?.nationalChartSeries ?? [])
    .slice(1)
    .filter((series) => !!series.legend);

  // Observed-generation entries come from the manifest, one per observer the country has —
  // never a hardcoded pair. GB has two, NL has one, and the second entry simply is not
  // rendered there rather than sitting permanently empty.
  const generationSources = useGenerationSources(
    focusedCountry ? { country: focusedCountry, source: "solar" } : null
  );
  const generationLegendItems = (generationSources.data ?? [])
    .slice(0, GENERATION_CHART_KEYS.length)
    .map((source, index) => ({ dataKey: GENERATION_CHART_KEYS[index], label: source.label }));

  const legendItemContainerClasses = `flex flex-initial overflow-y-visible  ${
    showNHourView ? "flex-col @sm:gap-0" : "flex-col @md:gap-0"
  }${className ? ` ${className}` : ""}`;

  let nHrTipText;
  if (showNHourView && visibleLines.includes("N_HOUR_FORECAST")) {
    if (selectedMapRegionIds && selectedMapRegionIds.length > 1) {
      nHrTipText =
        "As you have multiple regions selected, N-hour view is (currently) unavailable with multi-select. " +
        "\nSelect a single region to see the \nN-hour forecast.";
    }
    if (
      // Region type name, not the enum, since Phase 5 seam 1. The copy below ("DNO-level
      // data" / "GSP-level aggregation") is itself GB-specific, so this stays a literal
      // identity check rather than a `derived` branch.
      nationalAggregationLevel === "dno" &&
      selectedMapRegionIds &&
      selectedMapRegionIds.length > 0
    ) {
      nHrTipText =
        "N-hour view is not (currently) available for DNO-level data. " +
        "\nSelect GSP-level aggregation to see the N-hour forecast.";
    }
  }

  const seasonalMeanTooltipContent = (
    <div className="flex flex-col text-left justify-center items-start gap-2 text-xs text-ocf-gray-300 py-1">
      <p>
        The seasonal mean is calculated by taking the rolling 30-day average of the PV generation
        centred around each day of the year over the past 8 years.
      </p>
      <p>
        This provides a baseline for understanding typical PV generation patterns and can be useful
        for comparing against actual generation data.
      </p>
    </div>
  );

  const seasonalQuantilesTooltipContent = (
    <div className="flex flex-col text-left justify-center items-start gap-2 text-xs text-ocf-gray-300 py-1">
      <p>
        The seasonal quantiles are calculated by taking the 10th and 90th percentiles of the PV
        generation for the rolling 30-day period centred on each day of the year over the past 8
        years.
      </p>
      <p>
        These quantiles provide a measure of the variability in PV generation patterns and can be
        useful for understanding the range of possible generation values.
      </p>
    </div>
  );

  const ocfForecastTooltipContent = (
    <LegendTooltipContent inputs={["ECMWF", "MET_OFFICE", "SAT"]} />
  );

  const ocfNHrForecastTooltipContent = (
    <LegendTooltipContent inputs={["ECMWF", "MET_OFFICE", "SAT"]} extraText={nHrTipText} />
  );

  return (
    <div className="@container flex flex-initial">
      <div className="flex flex-1 flex-col justify-between align-items:baseline px-3 text-xs tracking-wider text-ocf-gray-300 py-2 gap-0 bg-mapbox-black-500 overflow-y-visible @sm:flex-row @xl:gap-6">
        <div
          className={`flex flex-initial justify-between flex-col overflow-x-auto @md:pr-0 @md:flex-col @md:gap-0 @lg:flex-row @lg:gap-5 @2xl:pr-2`}
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

            <LegendTooltip
              tip={seasonalMeanTooltipContent}
              position={"top-right"}
              className="relative w-full whitespace-pre-wrap"
            >
              <LegendItem
                iconClasses={"text-[#ffdfd1]"}
                label={"Seasonal Mean"}
                dataKey={`SEASONAL_MEAN`}
              />
            </LegendTooltip>
          </div>

          <div className={legendItemContainerClasses}>
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
            {modelLegendItems.map((series) => (
              <LegendTooltip
                key={`legend-${series.key}`}
                tip={<LegendTooltipContent inputs={series.legend!.tooltipInputs} />}
                position={"top"}
                className="relative w-full whitespace-pre-wrap"
              >
                <LegendItem
                  iconClasses={series.legend!.iconClasses}
                  symbolStyle={"both"}
                  label={series.label}
                  dataKey={series.key}
                />
              </LegendTooltip>
            ))}
          </div>
        </div>
        <div className={legendItemContainerClasses}>
          {generationLegendItems.map((item, index) => (
            <LegendItem
              key={`legend-${item.dataKey}`}
              iconClasses={"text-ocf-black"}
              // The first observer is the dashed "estimate" line; anything after it is solid.
              symbolStyle={index === 0 ? "dashed" : undefined}
              label={item.label}
              dataKey={item.dataKey}
            />
          ))}
          <LegendTooltip
            tip={seasonalMeanTooltipContent}
            position={"top"}
            className="relative w-full whitespace-pre-wrap @2xl:hidden dash:flex flex-col @4xl:dash:hidden"
          >
            <LegendItem
              iconClasses={"text-[#ffdfd1]"}
              label={"Seasonal Mean"}
              dataKey={`SEASONAL_MEAN`}
            />
          </LegendTooltip>
          <LegendTooltip
            tip={seasonalQuantilesTooltipContent}
            position={"top"}
            className="relative w-full whitespace-pre-wrap"
          >
            <LegendItem
              iconClasses={"text-[#ffdfd1]"}
              symbolStyle={"area"}
              label={"Seasonal quantiles"}
              dataKey={`SEASONAL_BOUNDS`}
            />
          </LegendTooltip>
          {/*<LegendTooltip*/}
          {/*  tip={seasonalMeanTooltipContent}*/}
          {/*  position={"top-right"}*/}
          {/*  className="relative w-full whitespace-pre-wrap @2xl:hidden dash:flex flex-col @4xl:dash:hidden"*/}
          {/*>*/}
          {/*  <LegendItem*/}
          {/*    iconClasses={"text-[#ffdfd1]"}*/}
          {/*    label={"Seasonal Mean"}*/}
          {/*    dataKey={`SEASONAL_MEAN`}*/}
          {/*  />*/}
          {/*</LegendTooltip>*/}
        </div>
        <div className="flex flex-1 w-full justify-end items-end gap-3 pr-3 pb-1 pt-1 @md:flex-col @lg:gap-4 @2xl:flex-row @3xl:gap-12">
          {showNHourView && (
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
          )}
        </div>
      </div>
    </div>
  );
};
