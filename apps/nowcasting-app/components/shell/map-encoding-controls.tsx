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
import MapLayerControls, { SatelliteChannelSelect } from "../map/map-layer-controls";

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
 * than it bought. The layer controls were forecast-only then, so switching to delta unmounted
 * them and dropped everything beneath by their full height: the encoding options, the unit toggle
 * and the legend all jumped upward, under a pointer that had just clicked one of them. Ordering
 * by conceptual precedence is worth less than a panel whose controls stay where the user left
 * them. Nothing unmounts any more (the map merge made the layer controls apply to both fills),
 * so that argument is spent — but the reading order it produced is right on its own terms, and
 * a panel that has stopped moving is not one to start rearranging.
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
 * Pairing granularity with the layer controls briefly put it behind their `comparison === null`
 * gate, making it forecast-only, on the grounds that `pages/index.tsx` force-snapped the level
 * on entering delta and so the control was offering a choice the view had already made. Both
 * halves of that are gone: the force-snap was a description of `deltaMap`'s limits rather than a
 * rule (the rollups compute a DNO-level delta and always have), and there is no gate left to
 * inherit. Granularity is live in both modes.
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
    <div className="flex shrink-0 flex-col gap-1.5 rounded-lg border border-content/10 bg-surface-panel/95 p-2 text-content shadow-2xl">
      <span className="text-2xs font-semibold uppercase tracking-wider text-content-secondary">
        PV Forecast Map
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

      {/* No longer gated on `comparison === null`. This block was forecast-only because the two
          views were two Mapbox instances and only one of them carried satellite layers or a
          togglable fill; with one instance repainting (`pvLatestMap.tsx`), both belong to the
          map rather than to the encoding.

          That is a gain in both directions. Clouds are the dominant driver of forecast error, so
          they are most useful under the delta fill (FB-020, NESO: attribute a forecast change to
          thickening or thinning cloud over an area — a delta-shaped question that was only
          answerable on the view that could not answer it). And granularity was never really
          forecast-only either: `rollUpRegionValues` has always accumulated delta across group
          members, so a DNO-level delta was computed and never offered. `pages/index.tsx` no
          longer force-snaps the level, so this is a live control rather than one fighting an
          effect.

          It stays *below* the encoding block. Nothing unmounts here any more, so the original
          reason (switching views shoving the legend upward under the pointer) is spent — but the
          reading order it gives, "what the colour means" then "how the map is drawn", is the
          right one on its own. */}
      <div className="border-b border-content/10" />
      {/* A grid rather than a flex row, so the satellite channel picker can span the lot.
          Five columns split 3/2, not two split evenly: the Layers buttons each carry a 10px
          on/off lamp and an even half (116px) no longer holds them, while Granularity is two
          three-letter buttons that never needed the room. `SatelliteChannelSelect` is a third
          grid child carrying its own `col-span-5`.

          Both groups answer "how is the map drawn" rather than "what does its colour mean",
          and each is two or three buttons wide, so a column apiece costs one section's
          height instead of two — which is what paid for the disclosure going away. */}
      <div className="grid grid-cols-5 items-start gap-x-3 gap-y-1.5">
        <div className="col-span-3 min-w-0">
          <MapLayerControls />
        </div>
        <div className="col-span-2 flex min-w-0 flex-col gap-1.5">
          {/* `MapLayerControls` carries its own "Layers" heading; this one is written here
              because `AggregationLevelToggle` is shared and has no business knowing which
              panel section it has been placed in. Same classes, so the two columns head
              identically. */}
          <span className="text-2xs font-semibold uppercase tracking-wider text-content-secondary">
            Granularity
          </span>
          <AggregationLevelToggle isLoading={false} />
        </div>
        {/* Full width, and absent entirely when the cloud layer is off — it renders `null`
            rather than an empty cell, so no gap is left behind. */}
        <SatelliteChannelSelect />
      </div>
    </div>
  );
};

export default MapEncodingControls;
