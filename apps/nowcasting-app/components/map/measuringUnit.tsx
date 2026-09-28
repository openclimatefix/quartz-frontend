import { Dispatch, FC, MouseEvent as ReactMouseEvent, SetStateAction } from "react";
import { ActiveUnit } from "./types";
import useGlobalState, { useCountryState } from "../helpers/globalState";
import { useAggregationLevels, useCurrentAggregationLevel } from "../../hooks/data";
import { defaultLevelOf } from "../helpers/aggregationLevels";
import * as Sentry from "@sentry/nextjs";
import {
  CONTROL_BUTTON_ACTIVE,
  CONTROL_BUTTON_BASE,
  CONTROL_BUTTON_GROW,
  CONTROL_BUTTON_IDLE,
  CONTROL_BUTTON_UNAVAILABLE,
  CONTROL_ROW
} from "./control-button";

type ButtonProps<T> = {
  id: string;
  active: boolean;
  isLoading: boolean;
  onToggle: (event: ReactMouseEvent<HTMLButtonElement>, value: T) => Promise<void>;
  text: string;
  value: T;
  /** Not applicable in the current view. Greyed and inert, with `title` saying why. */
  unavailable?: boolean;
  /** Shown on hover when `unavailable` — a disabled control with no reason reads as broken. */
  unavailableReason?: string;
  /** Share the group's width equally, for a group that spans the panel rather than a column. */
  grow?: boolean;
  /** Hover text for a label too short to say everything, e.g. what a bare "%" is out of. */
  hint?: string;
};

const MapUIButton = <T,>({
  id,
  active,
  isLoading,
  onToggle,
  text,
  value,
  unavailable = false,
  unavailableReason,
  grow = false,
  hint
}: ButtonProps<T>) => {
  return (
    <button
      onClick={(event) => onToggle(event, value)}
      disabled={isLoading || unavailable}
      id={id}
      title={unavailable ? unavailableReason : hint}
      aria-disabled={unavailable || undefined}
      type="button"
      // `unavailable` beats `active`: a unit the current view cannot show must never render as
      // the selected one, even for the frame before the state settles.
      className={`${CONTROL_BUTTON_BASE} ${grow ? CONTROL_BUTTON_GROW : ""} ${
        unavailable
          ? CONTROL_BUTTON_UNAVAILABLE
          : active
          ? CONTROL_BUTTON_ACTIVE
          : CONTROL_BUTTON_IDLE
      } ${isLoading ? "cursor-wait" : ""}`}
    >
      {text}
    </button>
  );
};

/** One button of a unit toggle. `id` is the DOM id, kept stable for anything that targets it. */
export type UnitOption<T extends string> = { value: T; label: string; id: string; hint?: string };

/**
 * A unit toggle over whichever units the current map mode offers. Split out of the combined
 * `MeasuringUnit` (Phase 6 followup, Track I) so the consolidated map panel can keep it always
 * visible — it changes the numbers `ColorGuideBar` shows, so hiding it behind the same
 * disclosure as the aggregation-level and layer controls would hide the reason the legend's
 * numbers just changed.
 *
 * Takes its options rather than knowing them. It used to be a fixed %/MW/Capacity row that
 * greyed "Capacity" out under a delta; with capacity a mode of its own, each mode has its own
 * set of units and the dock hands over the set for the mode that is showing — so there is no
 * unit left that the current mode cannot express, and nothing to grey out.
 */
export const UnitToggle = <T extends string>({
  options,
  active,
  onSelect,
  isLoading
}: {
  options: readonly UnitOption<T>[];
  active: T;
  onSelect: (unit: T) => void;
  isLoading: boolean;
}) => {
  const onToggleUnit = async (event: ReactMouseEvent<HTMLButtonElement, MouseEvent>, unit: T) => {
    event.preventDefault();
    onSelect(unit);
  };

  // Spread across the panel rather than huddled at its right edge: this sits directly above the
  // legend it re-scales, and a full-width row reads as one control with several settings.
  return (
    <div className={CONTROL_ROW}>
      {options.map((option) => (
        <MapUIButton<T>
          key={option.value}
          grow
          id={option.id}
          active={active === option.value}
          isLoading={isLoading}
          onToggle={onToggleUnit}
          text={option.label}
          hint={option.hint}
          value={option.value}
        />
      ))}
    </div>
  );
};

/** The `/sites` map's units — still one row of three, since that map has no modes. */
const SITES_UNIT_OPTIONS: readonly UnitOption<ActiveUnit>[] = [
  { value: ActiveUnit.percentage, label: "%", id: "UnitButtonPercentage" },
  { value: ActiveUnit.MW, label: "MW", id: "UnitButtonMW" },
  { value: ActiveUnit.capacity, label: "Capacity", id: "UnitButtonCapacity" }
];

/**
 * The GSP/DNO aggregation-level toggle. Split out of the combined `MeasuringUnit` (Track I) so
 * the consolidated map panel can put it behind the "more settings" disclosure alongside the
 * layer controls — how regions are grouped is closer to "how it's drawn" than "what does the
 * colour mean", the line the encoding cluster otherwise draws around itself.
 */
export const AggregationLevelToggle: FC<{ isLoading: boolean }> = ({ isLoading }) => {
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

  // Left-aligned and tight: it used to be pushed right and full-width, from when it sat alone on
  // a row of its own. It now shares a row with the layer controls as the "Granularity" column, so
  // its buttons stay their own width and start at the column's edge.
  return (
    <div className={`${CONTROL_ROW} flex-wrap`}>
      {finestLevel && (
        <MapUIButton<string>
          id={"GroupButtonGSP"}
          active={currentLevel?.regionType === finestLevel.regionType}
          isLoading={isLoading}
          onToggle={onToggleAggregation}
          text={finestLevel.label}
          value={finestLevel.regionType}
          grow={true}
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
          grow={true}
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
  );
};

/**
 * Combined default export, unchanged in behaviour — the `/sites` map's controls, both rows
 * together. `map-encoding-controls.tsx` uses `UnitToggle` and `AggregationLevelToggle`
 * separately instead, now that they sit in different parts of the consolidated panel (see those
 * components' own doc comments).
 */
const MeasuringUnit = ({
  activeUnit,
  setActiveUnit,
  isLoading
}: {
  activeUnit: ActiveUnit;
  setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>;
  isLoading: boolean;
}) => (
  <>
    <UnitToggle
      options={SITES_UNIT_OPTIONS}
      active={activeUnit}
      onSelect={setActiveUnit}
      isLoading={isLoading}
    />
    <div className="mt-3">
      <AggregationLevelToggle isLoading={isLoading} />
    </div>
  </>
);

export default MeasuringUnit;
