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
  setAggregationFunc: Dispatch<SetStateAction<AGGREGATION_LEVELS>>;
};

const AggregationButton: React.FC<AggregationLevelProps> = ({
  text,
  className,
  currentAggregation,
  aggregation,
  setAggregationFunc
}) => {
  const computedClasses = classNames(
    className || "",
    "text-white cursor-pointer hover:text-ocf-yellow-400",
    "flex px-4 py-2 font-semibold text-sm"
  );
  const isCurrentAggregation = currentAggregation === aggregation;
  return (
    <>
      <div
        className={classNames(computedClasses, isCurrentAggregation ? "text-ocf-yellow" : "")}
        onClick={() => setAggregationFunc(aggregation)}
      >
        {text}
      </div>
    </>
  );
};

type SliderProps = {
  selected?: string;
  unselected?: string;
  aggregation: AGGREGATION_LEVELS;
  setAggregation: Dispatch<SetStateAction<AGGREGATION_LEVELS>>;
};

const Slider: React.FC<SliderProps> = ({ selected, unselected, aggregation, setAggregation }) => {
  const [zoom] = useGlobalState("zoom");
  const [aggregationLevel, setAggregationLevel] = useGlobalState("aggregationLevel");
  unselected = "bg-ocf-delta-950 px-2 opacity-60 ";
  selected =
    "bg-ocf-yellow-500 px-3 text-black transition ease-in-out delay-400 font-bold border-1 border-black";
  console.log(zoom);
  let zoomLevel;
  if (zoom <= 5) {
    zoomLevel = "National";
  } else if (zoom > 5 && zoom < 7) {
    zoomLevel = "Regional";
  } else if (zoom >= 7 && zoom <= 8.5) {
    zoomLevel = "GSP";
  } else {
    zoomLevel = "Sites";
  }
  return (
    <>
      <div className="absolute top-0 m-4 bg-transparent flex flex-col right-2 ml-12 z-20">
        <div className="pb-1 text-white text-center text-base">Current Aggregation Level</div>
        <div className="flex flex-column text-center text-ocf-gray-600 cursor-pointer justify-between">
          <AggregationButton
            text={"National"}
            aggregation={AGGREGATION_LEVELS.NATIONAL}
            currentAggregation={aggregation}
            setAggregationFunc={setAggregation}
          />
          <AggregationButton
            text={"Region"}
            currentAggregation={aggregation}
            setAggregationFunc={setAggregation}
            aggregation={AGGREGATION_LEVELS.REGION}
          />
          <AggregationButton
            text={"Grid Supply Point"}
            currentAggregation={aggregation}
            setAggregationFunc={setAggregation}
            aggregation={AGGREGATION_LEVELS.GSP}
          />
          <AggregationButton
            text={"Site"}
            currentAggregation={aggregation}
            setAggregationFunc={setAggregation}
            aggregation={AGGREGATION_LEVELS.SITE}
          />
        </div>

        <div className={zoomLevel === "National" ? selected : unselected}>National</div>
        <div className={zoomLevel === "Regional" ? selected : unselected}>Region</div>
        <div className={zoomLevel === "GSP" ? selected : unselected}>Grid Supply Point</div>
        <div className={zoomLevel === "Sites" ? selected : unselected}>Site</div>
      </div>
    </>
  );
};
export default Slider;
