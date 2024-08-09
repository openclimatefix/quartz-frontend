import Tooltip from "../tooltip";
import { ChartInfo } from "../../ChartInfo";
import { InfoIcon, LegendLineGraphIcon } from "../icons/icons";
import { FC, useEffect } from "react";
import useGlobalState from "../helpers/globalState";
import { getRounded4HoursAgoString } from "../helpers/utils";
import LegendItem from "./LegendItem";

type ChartLegendProps = {
  className?: string;
};
export const ChartLegend: FC<ChartLegendProps> = ({ className }) => {
  const [showNhrView] = useGlobalState("show4hView");
  const [nHourForecast, setNHourForecast] = useGlobalState("nHourForecast");

  const fourHoursAgo = getRounded4HoursAgoString();
  const legendItemContainerClasses = `flex flex-initial flex-row lg:flex-col 3xl:flex-row ${
    className ? ` ${className}` : ""
  }`;
  return (
    <div className="absolute bottom-0 left-0 right-0 flex flex-none justify-between align-items:baseline px-4 text-xs tracking-wider text-ocf-gray-300 py-3 bg-mapbox-black-500 overflow-y-visible">
      <div
        className={`flex flex-initial gap-4 xl:gap-8 2xl:gap-12 justify-between flex-col lg:flex-row 3xl:flex-col overflow-x-auto`}
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
          {showNhrView && (
            <LegendItem
              iconClasses={"text-ocf-orange"}
              dashStyle={"both"}
              label={`OCF ${nHourForecast}hr Forecast`}
              dataKey={`NHR_FORECAST`}
            />
          )}
        </div>
      </div>
      <div className="flex flex-initial items-center self-center">
        <div className="h-8 w-10 mr-2 custom-select bg-mapbox-black-600 rounded-md">
          <select
            value={nHourForecast}
            onChange={(e) => setNHourForecast(Number(e.target.value))}
            className="text-sm border-mapbox-black-400 px-2 py-0 text-white rounded-md"
          >
            <option>1</option>
            <option>2</option>
            <option>4</option>
            <option>8</option>
          </select>
        </div>{" "}
        hour <br />
        forecast
      </div>
      <div className="flex-initial flex self-center items-start">
        <Tooltip
          tip={
            <div className="w-64 rounded-md">
              <ChartInfo />
            </div>
          }
          position="top"
          className={"text-right"}
          fullWidth
        >
          <InfoIcon />
        </Tooltip>
      </div>
    </div>
  );
};
