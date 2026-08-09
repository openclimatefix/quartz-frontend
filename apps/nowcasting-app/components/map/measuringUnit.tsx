import { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from "react";
import { ActiveUnit } from "./types";
import useGlobalState, { useCountryState } from "../helpers/globalState";
import { useAggregationLevels, useCurrentAggregationLevel } from "../../hooks/data";
import { defaultLevelOf } from "../helpers/aggregationLevels";
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
  const [, setNationalAggregation] = useCountryState("nationalAggregationLevel");
  const currentLevel = useCurrentAggregationLevel();
  const levels = useAggregationLevels();
  // The two toggle-able levels: the country's finest non-derived level (GB's `gsp`, NL's
  // `province` — same rule `pages/index.tsx` uses to force the delta view) and GB's `dno`
  // grouping specifically. NG zone and the explicit national level stay off, same as the
  // commented-out buttons below before Phase 5 — which levels this control offers is a
  // product decision, not something this migration changes.
  const finestLevel = defaultLevelOf(levels);
  const dnoLevel = levels.find((level) => level.regionType === "dno");
  const onToggleUnit = async (
    event: ReactMouseEvent<HTMLButtonElement, MouseEvent>,
    unit: ActiveUnit
  ) => {
    event.preventDefault();
    setActiveUnit(unit);
  };
  const onToggleAggregation = async (
    event: ReactMouseEvent<HTMLButtonElement, MouseEvent>,
    regionType: string
  ) => {
    event.preventDefault();
    Sentry.captureMessage("Event: Aggregation level changed", {
      extra: {
        eventType: "UserAction",
        aggregation: regionType,
        timestamp: new Date().getTime() // Just to make the event unique
      }
    });
    setNationalAggregation(regionType);
    console.log("sent event to Sentry: aggregation", regionType);
  };
  const buttonClasses =
    "relative inline-flex items-center px-3 py-0.5 text-sm dash:text-lg dash:tracking-wide font-extrabold hover:bg-ocf-yellow hover:text-mapbox-black-700 border-gray-600";

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
          active ? "text-black bg-ocf-yellow" : "text-white bg-black"
        } ${isLoading ? "cursor-wait" : ""} border-r last:border-r-0`}
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
            id={"UnitButtonPercentage"}
            active={activeUnit === ActiveUnit.percentage}
            isLoading={isLoading}
            onToggle={onToggleUnit}
            text={"%"}
            value={ActiveUnit.percentage}
          />
          <MapUIButton<ActiveUnit>
            id={"UnitButtonMW"}
            active={activeUnit === ActiveUnit.MW}
            isLoading={isLoading}
            onToggle={onToggleUnit}
            text={"MW"}
            value={ActiveUnit.MW}
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
      <div className="flex justify-end mr-0 mt-3">
        <div className="inline-block">
          {finestLevel && (
            <MapUIButton<string>
              id={"GroupButtonGSP"}
              active={currentLevel?.regionType === finestLevel.regionType}
              isLoading={isLoading}
              onToggle={onToggleAggregation}
              text={finestLevel.label}
              value={finestLevel.regionType}
            />
          )}
          {/*<MapUIButton<string>*/}
          {/*  id={"GroupButtonZones"}*/}
          {/*  active={currentLevel?.regionType === "zone"}*/}
          {/*  isLoading={isLoading}*/}
          {/*  onToggle={onToggleAggregation}*/}
          {/*  text={"NG Zones"}*/}
          {/*  value={"zone"}*/}
          {/*/>*/}
          {dnoLevel && (
            <MapUIButton<string>
              id={"GroupButtonZones"}
              active={currentLevel?.regionType === dnoLevel.regionType}
              isLoading={isLoading}
              onToggle={onToggleAggregation}
              text={dnoLevel.label}
              value={dnoLevel.regionType}
            />
          )}
          {/*<MapUIButton<string>*/}
          {/*  id={"GroupButtonZones"}*/}
          {/*  active={currentLevel?.regionType === "national"}*/}
          {/*  isLoading={isLoading}*/}
          {/*  onToggle={onToggleAggregation}*/}
          {/*  text={"National"}*/}
          {/*  value={"national"}*/}
          {/*/>*/}
        </div>
      </div>
    </>
  );
};

export default MeasuringUnit;
