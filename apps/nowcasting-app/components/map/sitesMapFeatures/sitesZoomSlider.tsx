import React, { FC } from "react";
import { AGGREGATION_LEVEL_MIN_ZOOM, AGGREGATION_LEVELS } from "../../../constant";
import useGlobalState from "../../helpers/globalState";
import { Dispatch, SetStateAction } from "react";
import { classNames } from "../../helpers/utils";

type AggregationLevelProps = {
  text: string;
  className?: string;
  currentAggregation?: AGGREGATION_LEVELS;
  aggregation: AGGREGATION_LEVELS;
  autoSetting: boolean;
  setAggregationFunc: (a: AGGREGATION_LEVELS) => void;
};

const AggregationButton: React.FC<AggregationLevelProps> = ({
  text,
  className,
  currentAggregation,
  aggregation,
  autoSetting,
  setAggregationFunc
}) => {
  const computedClasses = classNames(
    className || "",
    "text-white",
    "flex px-4 py-2 mt-0 font-semibold text-sm"
  );
  const isCurrentAggregation = currentAggregation === aggregation;
  return (
    <>
      <div className="flex flex-col">
        <div
          className={classNames(
            computedClasses,
            "text-ocf-yellow-500 cursor-pointer flex items-center gap-3 justify-between",
            isCurrentAggregation
              ? `ease-in duration-100 text-ocf-yellow-500 text-sm border-b-2 border-ocf-yellow-600 bg-ocf-black-900${
                  autoSetting ? "" : " border-l-4"
                }`
              : "bg-ocf-delta-950 opacity-30 text-white hover:opacity-75 hover:bg-opacity-25 hover:bg-ocf-black-900"
          )}
          onClick={() => setAggregationFunc(aggregation)}
        >
          {text}
          <LockIcon show={isCurrentAggregation && !autoSetting} />
        </div>
      </div>
    </>
  );
  // }
};

type SliderProps = {
  aggregation: AGGREGATION_LEVELS;
  setAggregation: Dispatch<SetStateAction<AGGREGATION_LEVELS>>;
};

const LockIcon: FC<{ show: boolean }> = ({ show }) => {
  return (
    <span>
      <svg
        className="ml-1"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{
          display: show ? "block" : "none"
        }}
      >
        <path
          d="M9.5 5.5H2.5C1.94772 5.5 1.5 5.94772 1.5 6.5V10C1.5 10.5523 1.94772 11 2.5 11H9.5C10.0523 11 10.5 10.5523 10.5 10V6.5C10.5 5.94772 10.0523 5.5 9.5 5.5Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
        <path
          d="M3.5 5.5V3.5C3.5 2.83696 3.76339 2.20107 4.23223 1.73223C4.70107 1.26339 5.33696 1 6 1C6.66304 1 7.29893 1.26339 7.76777 1.73223C8.23661 2.20107 8.5 2.83696 8.5 3.5V5.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </svg>
    </span>
  );
};

const Slider: React.FC<SliderProps> = ({ aggregation, setAggregation }) => {
  const [autoZoom, setAutoZoom] = useGlobalState("autoZoom");

  const setCustomAggregationLevel = (aggregationLevel: AGGREGATION_LEVELS) => {
    setAutoZoom(false);
    setAggregation(aggregationLevel);
  };

  return (
    <>
      <div className="absolute top-0 m-4 bg-transparent flex flex-col right-0 ml-12 z-20 min-w-48">
        <div className="py-1 px-3 text-white font-bold text-center text-base bg-ocf-black-800">
          Aggregation Level
        </div>
        <div className="flex flex-col justify-between">
          <a
            className={`flex items-center justify-between gap-1 px-4 py-2 font-semibold ease-in border-b-2 border-ocf-black-300 duration-100 text-sm cursor-pointer ${
              autoZoom
                ? "text-white border-l-4 border-l-ocf-yellow-600 bg-ocf-black-900"
                : "bg-ocf-delta-950 opacity-30 text-white hover:opacity-100 hover:bg-opacity-25 hover:bg-ocf-black-900"
            }`}
            onClick={() => setAutoZoom(true)}
          >
            Auto
            <LockIcon show={autoZoom} />
          </a>
          <AggregationButton
            text={"National"}
            aggregation={AGGREGATION_LEVELS.NATIONAL}
            currentAggregation={aggregation}
            setAggregationFunc={setCustomAggregationLevel}
            autoSetting={autoZoom}
          />
          <AggregationButton
            text={"Region"}
            currentAggregation={aggregation}
            setAggregationFunc={setCustomAggregationLevel}
            aggregation={AGGREGATION_LEVELS.REGION}
            autoSetting={autoZoom}
          />
          <AggregationButton
            text={"Grid Supply Point"}
            currentAggregation={aggregation}
            setAggregationFunc={setCustomAggregationLevel}
            aggregation={AGGREGATION_LEVELS.GSP}
            autoSetting={autoZoom}
          />
          <AggregationButton
            text={"Site"}
            currentAggregation={aggregation}
            setAggregationFunc={setCustomAggregationLevel}
            aggregation={AGGREGATION_LEVELS.SITE}
            autoSetting={autoZoom}
          />
        </div>
      </div>
    </>
  );
};

export default Slider;
