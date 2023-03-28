import React from "react";
import { AGGREGATION_LEVELS } from "../../../constant";
import useGlobalState from "../../helpers/globalState";
import { Dispatch, SetStateAction } from "react";
import { classNames } from "../../helpers/utils";

// type HeaderLinkProps = {
//   url: string;
//   text: string;
//   className?: string;
//   disabled?: boolean;
//   currentView?: VIEWS;
//   view?: VIEWS;
//   setViewFunc?: Dispatch<SetStateAction<VIEWS>>;
// };
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
    if (zoom <= 5) {
      aggregation = AGGREGATION_LEVELS.NATIONAL;
      setAggregationFunc(aggregation);
      zoomLevel = "National";
    } else if (zoom > 5 && zoom < 7) {
      aggregation = AGGREGATION_LEVELS.REGION;
      setAggregationFunc(aggregation);
      zoomLevel = "Region";
    } else if (zoom >= 7 && zoom <= 8.5) {
      aggregation = AGGREGATION_LEVELS.GSP;
      setAggregationFunc(aggregation);
      zoomLevel = "Grid Supply Point";
    } else {
      aggregation = AGGREGATION_LEVELS.SITE;
      setAggregationFunc(aggregation);
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
              "cursor-pointer text-ocf-yellow-500 hover:opacity-80",
              isCurrentAggregation
                ? "ease-in duration-100 text-ocf-yellow-500 text-s border-b-4 cursor-pointer border-l-2 border-ocf-yellow-600 bg-ocf-black-900 bg-opacity-50"
                : "bg-ocf-delta-950 opacity-30"
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
      <div className="absolute top-0 m-4 bg-transparent flex flex-col right-6 ml-12 z-20">
        <div className="pb-1 px-2 text-white font-bold text-center text-base bg-ocf-black-800">
          Aggregation Settings
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
