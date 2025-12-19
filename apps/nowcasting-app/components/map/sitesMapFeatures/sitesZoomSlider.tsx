import React from "react";
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
  setAggregationFunc: Dispatch<SetStateAction<AGGREGATION_LEVELS>>;
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
  const [zoom] = useGlobalState("zoom");

  if (autoSetting) {
    let zoomLevel = "";
    if (currentAggregation === AGGREGATION_LEVELS.NATIONAL) {
      zoomLevel = "National";
    } else if (currentAggregation === AGGREGATION_LEVELS.REGION) {
      zoomLevel = "Region";
    } else if (currentAggregation === AGGREGATION_LEVELS.GSP) {
      zoomLevel = "Grid Supply Point";
    } else if (currentAggregation === AGGREGATION_LEVELS.SITE) {
      zoomLevel = "Site";
    }
    return (
      <>
        <div className="flex flex-col">
          <div
            className={classNames(
              computedClasses,
              text === zoomLevel
                ? "ease-in duration-100 text-ocf-yellow text-s border-b-4 border-l-2 border-ocf-yellow-600 bg-ocf-black-900 bg-opacity-50"
                : "bg-ocf-delta-950 opacity-30"
            )}
          >
            {text}
          </div>
        </div>
      </>
    );
  } else {
    const isCurrentAggregation = currentAggregation === aggregation;
    return (
      <>
        <div className="flex flex-col">
          <div
            className={classNames(
              computedClasses,
              // "cursor-pointer text-ocf-yellow-500 hover:opacity-80",
              "text-ocf-yellow-500",
              isCurrentAggregation
                ? "ease-in duration-100 text-ocf-yellow-500 text-s border-b-4 border-l-2 border-ocf-yellow-600 bg-ocf-black-900"
                : "bg-ocf-delta-950 opacity-30"
              // ? "ease-in duration-100 text-ocf-yellow-500 text-s border-b-4 cursor-pointer border-l-2 border-ocf-yellow-600 bg-ocf-black-900 bg-opacity-50"
            )}
            onClick={() => setAggregationFunc(aggregation)}
          >
            {text}
          </div>
        </div>
      </>
    );
  }
};

type SliderProps = {
  selected?: string;
  unselected?: string;
  aggregation: AGGREGATION_LEVELS;
  setAggregation: Dispatch<SetStateAction<AGGREGATION_LEVELS>>;
};

const Slider: React.FC<SliderProps> = ({ selected, unselected, aggregation, setAggregation }) => {
  const [aggregationLevel, setAggregationLevel] = useGlobalState("aggregationLevel");
  const [autoZoom, setAutoZoom] = useGlobalState("autoZoom");
  const toggleAutoZoom = () => {
    setAutoZoom(!autoZoom);
  };

  return (
    <>
      <div className="absolute top-0 m-4 bg-transparent flex flex-col right-0 ml-12 z-20">
        <div className="py-1 px-3 text-white font-bold text-center text-base bg-ocf-black-800">
          Aggregation Level
        </div>
        <div className="flex flex-col justify-between">
          <div className="flex flex-row justify-around bg-ocf-delta-950 bg-opacity-60 font-bold">
            <div
              className="p-2 text-base text-white text-opacity-30 hover:cursor-pointer hover:text-white"
              onClick={toggleAutoZoom}
            >
              Select
            </div>
            <div className="text-ocf-yellow-500 p-2">
              <span
                className={autoZoom ? "text-ocf-yellow-500" : "text-ocf-yellow-500 text-opacity-30"}
              >
                Auto
              </span>{" "}
              |{" "}
              <span
                className={autoZoom ? "text-ocf-yellow-500 text-opacity-30" : "text-ocf-yellow-500"}
              >
                Custom
              </span>
            </div>
          </div>
          <AggregationButton
            text={"National"}
            aggregation={AGGREGATION_LEVELS.NATIONAL}
            currentAggregation={aggregation}
            setAggregationFunc={setAggregation}
            autoSetting={autoZoom}
          />
          <AggregationButton
            text={"Region"}
            currentAggregation={aggregation}
            setAggregationFunc={setAggregation}
            aggregation={AGGREGATION_LEVELS.REGION}
            autoSetting={autoZoom}
          />
          <AggregationButton
            text={"Grid Supply Point"}
            currentAggregation={aggregation}
            setAggregationFunc={setAggregation}
            aggregation={AGGREGATION_LEVELS.GSP}
            autoSetting={autoZoom}
          />
          <AggregationButton
            text={"Site"}
            currentAggregation={aggregation}
            setAggregationFunc={setAggregation}
            aggregation={AGGREGATION_LEVELS.SITE}
            autoSetting={autoZoom}
          />
        </div>
      </div>
    </>
  );
};

export default Slider;
