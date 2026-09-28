import type { ComparisonId, ComparisonSelection } from "./comparison";
import { ActiveUnit } from "../map/types";

/**
 * What the map's fill encodes — the dashboard's one mode axis.
 *
 * Phase 6 §2 made this `comparison: ComparisonSelection`, where `null` meant "the plain
 * forecast". That was sound while there were two modes, and it stops being sound at three:
 * installed capacity is neither a forecast nor a comparison, and every reader that asked
 * `comparison === null` meant "forecast" by it. Adding capacity as a third *value* of
 * `comparison` would have made it truthy, so `comparison ? delta : forecast` sent it to the
 * delta arm; adding it as a flag *beside* `comparison` would have left `comparison === null`
 * true, so the forecast arm took it. Both fail quietly and both pass a typecheck.
 *
 * So `comparison` is gone as state and this union replaces it. Readers either switch on `kind`
 * — exhaustively, so a fourth mode is a compile error in each of them rather than a silent
 * fall-through — or ask the one narrow question the chart has, through `chartComparisonOf`.
 */
export type MapMode =
  | { kind: "forecast" }
  | { kind: "delta"; preset: ComparisonId }
  | { kind: "capacity" };

export type MapModeKind = MapMode["kind"];

/**
 * Module-level so the identities are stable: `setMapMode(FORECAST_MODE)` twice is one state,
 * and equality on the object is enough for a memo.
 */
export const FORECAST_MODE: MapMode = { kind: "forecast" };
export const CAPACITY_MODE: MapMode = { kind: "capacity" };
export const deltaMode = (preset: ComparisonId): MapMode => ({ kind: "delta", preset });

/** What the Capacity mode's option is called in the "Map shows" row. */
export const CAPACITY_MODE_LABEL = "Capacity";

/**
 * The comparison the CHART draws — its B side — and nothing else.
 *
 * The chart is not a map mode (the capacity map sits over the ordinary forecast chart), so for
 * it capacity and forecast genuinely are the same answer: no extra series. That is the only
 * reason this may collapse them, and why it is named for the chart rather than for "the
 * comparison": anything deciding how the MAP draws must switch on `MapMode.kind` instead.
 */
export const chartComparisonOf = (mode: MapMode): ComparisonSelection =>
  mode.kind === "delta" ? mode.preset : null;

/** The units the forecast and delta fills are shown in. One remembered choice serves both. */
export type OutputUnit = ActiveUnit.percentage | ActiveUnit.MW;

/** The units the capacity fill is shown in. None of them is meaningful for output or delta. */
export enum CapacityUnit {
  /** The region's installed capacity over its own country's national installed capacity. */
  shareOfNational = "% of national",
  MW = "MW",
  /** Installed capacity over the region's area. */
  density = "MW/km²"
}

/**
 * The last unit chosen in each family, so leaving a mode and coming back restores it.
 *
 * Two slots, not three: forecast and delta already shared one unit (the old single
 * `activeUnit`), and a percentage forecast turning into a percentage delta is what a user
 * switching between them expects. Capacity's units are a different set altogether, so it
 * remembers its own — which is also what retired `setComparison`'s rule that moved the unit
 * off "Capacity" when a comparison was selected. No unit from one family can be active in the
 * other's mode, because the type does not allow it.
 */
export type MapUnits = { output: OutputUnit; capacity: CapacityUnit };

export const DEFAULT_MAP_UNITS: MapUnits = {
  output: ActiveUnit.percentage,
  capacity: CapacityUnit.MW
};

/**
 * The mode and the unit it is drawn in, as one value. What every map surface reads.
 *
 * Carrying the unit inside the mode's arm is the point: a capacity encoding can only hold a
 * `CapacityUnit` and an output one only an `OutputUnit`, so no reader can pair a mode with the
 * other family's unit however it is written.
 */
export type MapEncoding =
  | { kind: "forecast"; unit: OutputUnit }
  | { kind: "delta"; preset: ComparisonId; unit: OutputUnit }
  | { kind: "capacity"; unit: CapacityUnit };

export const mapEncodingOf = (mode: MapMode, units: MapUnits): MapEncoding => {
  switch (mode.kind) {
    case "forecast":
      return { kind: "forecast", unit: units.output };
    case "delta":
      return { kind: "delta", preset: mode.preset, unit: units.output };
    case "capacity":
      return { kind: "capacity", unit: units.capacity };
  }
};
