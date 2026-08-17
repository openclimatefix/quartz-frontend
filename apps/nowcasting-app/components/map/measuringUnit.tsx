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
  grow = false
}: ButtonProps<T>) => {
  return (
    <button
      onClick={(event) => onToggle(event, value)}
      disabled={isLoading || unavailable}
      id={id}
      title={unavailable ? unavailableReason : undefined}
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

/**
 * The %/MW/Capacity unit toggle. Split out of the combined `MeasuringUnit` (Phase 6 followup,
 * Track I) so the consolidated map panel can keep it always visible — it changes the numbers
 * `ColorGuideBar` shows, so hiding it behind the same disclosure as the aggregation-level and
 * layer controls would hide the reason the legend's numbers just changed.
 */
export const UnitToggle: FC<{
  activeUnit: ActiveUnit;
  setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>;
  isLoading: boolean;
  /**
   * Units the current view cannot express, greyed and inert rather than hidden.
   *
   * Hidden was the alternative and is worse here: this panel already orders itself so that
   * switching to delta cannot shove controls upward under the pointer (see the note in
   * `map-encoding-controls.tsx`), and dropping a third of this toggle would do exactly that to
   * the legend below it. A greyed button also says "not for this view" where a missing one says
   * nothing at all.
   *
   * The toggle only *renders* the rule; it does not enforce it. `setComparison` guarantees the
   * active unit is never one of these, so this cannot be the only thing standing between the
   * user and a map painted in a unit its own control denies.
   */
  unavailableUnits?: readonly ActiveUnit[];
  /** Why those units are unavailable, for the disabled buttons' tooltip. */
  unavailableReason?: string;
}> = ({ activeUnit, setActiveUnit, isLoading, unavailableUnits = [], unavailableReason }) => {
  const onToggleUnit = async (
    event: ReactMouseEvent<HTMLButtonElement, MouseEvent>,
    unit: ActiveUnit
  ) => {
    event.preventDefault();
    setActiveUnit(unit);
  };

  // Spread across the panel rather than huddled at its right edge: this sits directly above the
  // legend it re-scales, and a full-width row of three reads as one control with three settings.
  return (
    <div className={CONTROL_ROW}>
      <MapUIButton<ActiveUnit>
        grow
        id={"UnitButtonPercentage"}
        active={activeUnit === ActiveUnit.percentage}
        isLoading={isLoading}
        onToggle={onToggleUnit}
        text={"%"}
        value={ActiveUnit.percentage}
        unavailable={unavailableUnits.includes(ActiveUnit.percentage)}
        unavailableReason={unavailableReason}
      />
      <MapUIButton<ActiveUnit>
        grow
        id={"UnitButtonMW"}
        active={activeUnit === ActiveUnit.MW}
        isLoading={isLoading}
        onToggle={onToggleUnit}
        text={"MW"}
        value={ActiveUnit.MW}
        unavailable={unavailableUnits.includes(ActiveUnit.MW)}
        unavailableReason={unavailableReason}
      />
      <MapUIButton<ActiveUnit>
        grow
        id={"UnitButtonCapacity"}
        active={activeUnit === ActiveUnit.capacity}
        isLoading={isLoading}
        onToggle={onToggleUnit}
        text={"Capacity"}
        value={ActiveUnit.capacity}
        unavailable={unavailableUnits.includes(ActiveUnit.capacity)}
        unavailableReason={unavailableReason}
      />
    </div>
  );
};

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
  );
};

/**
 * Combined default export, unchanged in behaviour — kept for anything that still wants both
 * rows together in one call. `map-encoding-controls.tsx` uses `UnitToggle` and
 * `AggregationLevelToggle` separately instead, now that they sit in different parts of the
 * consolidated panel (see those components' own doc comments).
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
    <UnitToggle activeUnit={activeUnit} setActiveUnit={setActiveUnit} isLoading={isLoading} />
    <div className="mt-3">
      <AggregationLevelToggle isLoading={isLoading} />
    </div>
  </>
);

export default MeasuringUnit;
