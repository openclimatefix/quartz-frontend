import { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from "react";
import { ActiveUnit, NationalAggregation } from "./types";
import useGlobalState from "../helpers/globalState";
import * as Sentry from "@sentry/nextjs";

const MeasuringUnit = ({
  activeUnit,
  setActiveUnit,
  isLoading
}: {
  activeUnit: ActiveUnit;
  setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>;
  isLoading: boolean;
}) => {
  const [nationalAggregation, setNationalAggregation] = useGlobalState("nationalAggregationLevel");
  const onToggleUnit = async (
    event: ReactMouseEvent<HTMLButtonElement, MouseEvent>,
    unit: ActiveUnit
  ) => {
    event.preventDefault();
    setActiveUnit(unit);
  };
  const onToggleAggregation = async (
    event: ReactMouseEvent<HTMLButtonElement, MouseEvent>,
    aggregation: NationalAggregation
  ) => {
    event.preventDefault();
    Sentry.captureMessage("Event: Aggregation level changed", {
      extra: {
        eventType: "UserAction",
        aggregation,
        timestamp: new Date().getTime() // Just to make the event unique
      }
    });
    setNationalAggregation(aggregation);
    console.log("sent event to Sentry: aggregation", aggregation);
  };
  const buttonClasses =
    "relative inline-flex items-center px-3 py-0.5 text-sm dash:text-lg dash:tracking-wide font-extrabold hover:bg-ocf-yellow border-gray-600";

  type ButtonProps<T> = {
    id: string;
    active: boolean;
    isLoading: boolean;
    onToggle: (event: ReactMouseEvent<HTMLButtonElement>, unit: T) => Promise<void>;
    text: string;
    value: T;
  };
  const MapUIButton = <T,>({ id, active, isLoading, onToggle, text, value }: ButtonProps<T>) => {
    return (
      <button
        onClick={(event) => onToggle(event, value)}
        disabled={isLoading}
        id={id}
        type="button"
        className={`${buttonClasses}  ${
          active ? "text-black bg-ocf-yellow" : "text-white bg-black border-r"
        } ${isLoading ? "cursor-wait" : ""}`}
      >
        {text}
      </button>
    );
  };

  return (
    <>
      <div className="flex justify-end mr-0">
        <div className="inline-block">
          <MapUIButton<ActiveUnit>
            id={"UnitButtonMW"}
            active={activeUnit === ActiveUnit.MW}
            isLoading={isLoading}
            onToggle={onToggleUnit}
            text={"kW"}
            value={ActiveUnit.MW}
          />
          <MapUIButton<ActiveUnit>
            id={"UnitButtonPercentage"}
            active={activeUnit === ActiveUnit.percentage}
            isLoading={isLoading}
            onToggle={onToggleUnit}
            text={"%"}
            value={ActiveUnit.percentage}
          />
          <MapUIButton<ActiveUnit>
            id={"UnitButtonCapacity"}
            active={activeUnit === ActiveUnit.capacity}
            isLoading={isLoading}
            onToggle={onToggleUnit}
            text={"Capacity"}
            value={ActiveUnit.capacity}
          />
        </div>
      </div>
      {/*<div className="flex justify-end mr-0 mt-3">*/}
      {/*  <div className="inline-block">*/}
      {/*    <MapUIButton<NationalAggregation>*/}
      {/*      id={"GroupButtonGSP"}*/}
      {/*      active={nationalAggregation === NationalAggregation.GSP}*/}
      {/*      isLoading={isLoading}*/}
      {/*      onToggle={onToggleAggregation}*/}
      {/*      text={"GSP"}*/}
      {/*      value={NationalAggregation.GSP}*/}
      {/*    />*/}
      {/*    <MapUIButton<NationalAggregation>*/}
      {/*      id={"GroupButtonZones"}*/}
      {/*      active={nationalAggregation === NationalAggregation.DNO}*/}
      {/*      isLoading={isLoading}*/}
      {/*      onToggle={onToggleAggregation}*/}
      {/*      text={"DNO"}*/}
      {/*      value={NationalAggregation.DNO}*/}
      {/*    />*/}
      {/*  </div>*/}
      {/*</div>*/}
    </>
  );
};

export default MeasuringUnit;
