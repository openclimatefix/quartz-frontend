import Tooltip from "../tooltip";
import { ChartInfo } from "../../ChartInfo";
import { InfoIcon, LegendLineGraphIcon } from "../icons/icons";
import { FC } from "react";
import useGlobalState from "../helpers/globalState";
import { getRounded4HoursAgoString } from "../helpers/utils";

const LegendItem: FC<{
  iconClasses: string;
  label: string;
  dashed?: boolean;
  dataKey: string;
}> = ({ iconClasses, label, dashed, dataKey }) => {
  const [visibleLines, setVisibleLines] = useGlobalState("visibleLines");
  const isVisible = visibleLines.includes(dataKey);

  const toggleLineVisibility = () => {
    if (isVisible) {
      setVisibleLines(visibleLines.filter((line) => line !== dataKey));
    } else {
      setVisibleLines([...visibleLines, dataKey]);
    }
  };

  return (
    <div className="flex items-center flex-1">
      <LegendLineGraphIcon className={iconClasses} dashed={dashed} />
      <button
        className="inline-flex flex-1 text-left pl-1 max-w-full w-44 dash:w-auto text-xs dash:text-base dash:tracking-wider dash:pb-1"
        onClick={toggleLineVisibility}
      >
        <span
          className={`block w-auto uppercase pl-1${
            isVisible ? " font-extrabold dash:font-semibold" : ""
          }`}
        >
          {label}
        </span>
      </button>
    </div>
  );
};

type ChartLegendProps = {
  className?: string;
};
export const ChartLegend: React.FC<ChartLegendProps> = ({ className }) => {
  const [show4hView] = useGlobalState("show4hView");

  const fourHoursAgo = getRounded4HoursAgoString();
  const legendItemContainerClasses = `flex flex-initial flex-col lg:flex-row 3xl:flex-col justify-between${
    className ? ` ${className}` : ""
  }`;
  return (
    <div className="absolute bottom-0 left-0 right-0 flex flex-none justify-between align-items:baseline px-4 text-xs tracking-wider text-ocf-gray-300 pt-3 bg-mapbox-black-500 overflow-y-visible">
      <div className={`flex flex-1 justify-around flex-col 3xl:flex-row pb-3 overflow-x-auto`}>
        <div className={legendItemContainerClasses}>
          <LegendItem
            iconClasses={"text-ocf-black"}
            dashed
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
            dashed
            label={"OCF Forecast"}
            dataKey={`FORECAST`}
          />
          <LegendItem
            iconClasses={"text-ocf-yellow"}
            label={"OCF Final Forecast"}
            dataKey={`PAST_FORECAST`}
          />
        </div>
        {show4hView && (
          <div className={legendItemContainerClasses}>
            <LegendItem
              iconClasses={"text-ocf-orange"}
              dashed
              // label={`OCF ${fourHoursAgo} Forecast`}
              label={`OCF 4hr+ Forecast`}
              dataKey={`4HR_FORECAST`}
            />
            <LegendItem
              iconClasses={"text-ocf-orange"}
              label={"OCF 4hr Forecast"}
              dataKey={`4HR_PAST_FORECAST`}
            />
          </div>
        )}
      </div>
      <div className="flex-initial flex items-center pb-3">
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
