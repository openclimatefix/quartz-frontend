import { FC } from "react";

import useGlobalState, { setComparison } from "../helpers/globalState";
import {
  COMPARISON_PRESETS,
  ComparisonSelection,
  NO_COMPARISON_LABEL
} from "../helpers/comparison";
import { UnitToggle, AggregationLevelToggle } from "../map/measuringUnit";
import { ActiveUnit } from "../map/types";
import ColorGuideBar from "../map/color-guide-bar";
import {
  CONTROL_BUTTON_ACTIVE,
  CONTROL_BUTTON_BASE,
  CONTROL_BUTTON_GROW,
  CONTROL_BUTTON_IDLE,
  CONTROL_ROW
} from "../map/control-button";
import MapLayerControls from "../map/map-layer-controls";

/**
 * The one map control panel — Brad's ask, twice: "consolidate the map controls ... into one
 * panel". Before this track, `map.tsx` rendered the Clouds/PV layer buttons as a separate
 * floating row and this cluster sat stacked below it (Phase 6 followup, Track G) — same
 * corner, two visual groups, because `map.tsx` was off-limits to that track. It is free now,
 * and this is the merge: `MapLayerControls` moved out of `map.tsx` and mounts inside this same
 * bordered panel.
 *
 * ## How it's grouped, and why
 *
 * Everything here answers "what does the map's colour mean, and what basemap am I looking at
 * under it" — contract §5's case for keeping this cluster off the display rail. But that is
 * four different questions (which basemap layer, which data, what unit, what
 * grouping), plus the legend, and §6a flagged this corner as already at its limit *before*
 * the layer controls joined it. One panel does not have to mean one flat stack, so it splits
 * into two blocks, divided by a rule:
 *
 * - **What the colour means**: "Map shows" (which encoding), `UnitToggle` (%/MW/Capacity) and
 *   `ColorGuideBar` (the legend). These are one conversation, in order — select the encoding,
 *   pick the unit it is shown in, read what the current colours mean — so they stack, and the
 *   unit toggle sits directly above the legend whose numbers it changes.
 * - **How the map is drawn**: `MapLayerControls` ("Layers") and `AggregationLevelToggle`
 *   ("Granularity"), side by side. Each is only two or three controls wide, so a column apiece
 *   costs one section's height rather than two.
 *
 * **Cloud cover is a flagship feature, not a setting.** The first version of this panel filed
 * `MapLayerControls` behind the disclosure alongside the grouping toggle, reasoning that both
 * describe *how the map is drawn* rather than *what the colour means*. That line is real, but
 * it was the wrong cut: clouds are the context a user reads the forecast *against*, so the
 * toggle belongs where they can reach it without opening anything — and it was a top-level
 * control before this panel existed. A consolidation must not demote what it absorbs.
 *
 * **But it sits below the encoding block, not above it** (Brad, 2026-08-15). It first sat first,
 * on the reasoning that the basemap is the ground the rest is drawn on — true, and it cost more
 * than it bought. The layer controls are forecast-only, so switching to delta unmounted them and
 * dropped everything beneath by their full height: the encoding options, the unit toggle and the
 * legend all jumped upward, under a pointer that had just clicked one of them. Ordering by
 * conceptual precedence is worth less than a panel whose controls stay where the user left them.
 * Below the legend it is the last thing in the panel, so there is nothing left for it to move.
 *
 * Rejected: putting `AggregationLevelToggle` and `MapLayerControls` on the display rail
 * instead. That would satisfy §6's letter but not Brad's explicit ask — "into one panel" — and
 * it would split one coherent "what/how the map draws" story across two pieces of chrome for
 * no gain, since the rail is about the *chart's* series and confidence bands.
 *
 * **The "More map settings" disclosure is gone** (Brad, 2026-08-17). It held exactly one
 * control, `AggregationLevelToggle`, on the reasoning that which polygons the map is cut into
 * is set once rather than read while interpreting a forecast. A disclosure hiding a single
 * control is a click and an unlabelled chevron charged for nothing, and pairing it with the
 * layer controls as a second column costs no height at all: the row is as tall as "Layers"
 * was on its own.
 *
 * Note this puts granularity behind the same `comparison === null` gate the layer controls
 * already had, so it is forecast-only where it used to be reachable in the delta view too.
 * That follows the app's own intent rather than adding to it — `pages/index.tsx` force-snaps
 * the level to the country's finest on entering delta, so the control was offering a choice
 * the view had already made. If delta should keep it, the honest form is a disabled button
 * with a reason, the way `UnitToggle` handles capacity — not a live control fighting an effect.
 */

const ComparisonOption: FC<{
  id: ComparisonSelection;
  label: string;
  active: boolean;
  hint: string;
}> = ({ id, label, active, hint }) => (
  <button
    type="button"
    aria-pressed={active}
    title={hint}
    onClick={() => setComparison(id)}
    className={`${CONTROL_BUTTON_BASE} ${CONTROL_BUTTON_GROW} ${
      active ? CONTROL_BUTTON_ACTIVE : CONTROL_BUTTON_IDLE
    }`}
  >
    {label}
  </button>
);

const MapEncodingControls: FC = () => {
  const [comparison] = useGlobalState("comparison");
  const [activeUnit, setActiveUnit] = useGlobalState("activeUnit");

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-mapbox-black-700/95 p-2 text-white shadow-2xl">
      <span className="text-2xs font-semibold uppercase tracking-wider text-ocf-gray-600">
        Map shows
      </span>
      <div className={CONTROL_ROW} role="group" aria-label="Map shows">
        <ComparisonOption
          id={null}
          label={NO_COMPARISON_LABEL}
          active={comparison === null}
          hint="Colour regions by forecast output"
        />
        {COMPARISON_PRESETS.map((preset) => (
          <ComparisonOption
            key={preset.id}
            id={preset.id}
            label={preset.label}
            active={comparison === preset.id}
            // The title is optional, so the qualifying clause is too — otherwise a
            // preset without one leaves a trailing em dash pointing at nothing.
            hint={
              preset.title
                ? `Colour regions by the difference — ${preset.title.toLowerCase()}`
                : "Colour regions by the difference"
            }
          />
        ))}
      </div>
      {/* The unit control's own loading gate was the map's fetch state, which the dock does not
          have and should not learn. Nothing it does is unsafe mid-fetch — it writes a display
          unit and an aggregation level — so it is simply never disabled here. */}
      {/* Installed capacity has no delta, so the unit is greyed rather than quietly showing
          megawatts under a control that reads "Capacity". `setComparison` has already moved the
          active unit off it by the time this renders — this states the rule, it does not
          enforce it. */}
      <UnitToggle
        activeUnit={activeUnit}
        setActiveUnit={setActiveUnit}
        isLoading={false}
        unavailableUnits={comparison === null ? [] : [ActiveUnit.capacity]}
        unavailableReason="Installed capacity has no delta"
      />
      <ColorGuideBar comparison={comparison} unit={activeUnit} />

      {/* Satellite/PV layers are forecast-map concepts only — the delta map has no basemap fill
          to toggle, so this mirrors `map.tsx`'s old `title === MAP_TITLE_FORECAST` gate,
          expressed here since this panel is now the one place that knows which map is mounted
          (`comparison === null` is the forecast map, contract §2).

          It sits *below* the encoding block rather than above it, so that switching to the delta
          view — which unmounts it — cannot shove the encoding controls and legend upward under
          the pointer. See the note on ordering above. */}
      {comparison === null && (
        <>
          <div className="border-b border-white/10" />
          {/* Two columns rather than two stacked sections. Both answer "how is the map drawn"
              rather than "what does its colour mean", they are each two or three controls wide,
              and side by side they cost one section's height instead of two — which is what
              paid for the disclosure going away. */}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <MapLayerControls />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {/* `MapLayerControls` carries its own "Layers" heading; this one is written here
                  because `AggregationLevelToggle` is shared and has no business knowing which
                  panel section it has been placed in. Same classes, so the two columns head
                  identically. */}
              <span className="text-2xs font-semibold uppercase tracking-wider text-ocf-gray-600">
                Granularity
              </span>
              <AggregationLevelToggle isLoading={false} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MapEncodingControls;
