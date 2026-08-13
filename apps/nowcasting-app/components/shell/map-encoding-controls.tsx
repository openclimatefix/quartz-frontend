import { FC, useState } from "react";

import useGlobalState, { setComparison } from "../helpers/globalState";
import {
  COMPARISON_PRESETS,
  ComparisonSelection,
  NO_COMPARISON_LABEL
} from "../helpers/comparison";
import { UnitToggle, AggregationLevelToggle } from "../map/measuringUnit";
import ColorGuideBar from "../map/color-guide-bar";
import MapLayerControls from "../map/map-layer-controls";
import { MdKeyboardArrowDown } from "@react-icons/all-files/md/MdKeyboardArrowDown";

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
 * four different questions (which basemap layer, what the colour encodes, what unit, what
 * grouping), plus the legend, and §6a flagged this corner as already at its limit *before*
 * the layer controls joined it. One panel does not have to mean one flat stack, so it splits
 * into two tiers:
 *
 * - **Always visible**: `MapLayerControls` (Clouds/PV + satellite channel), "Colour by" (which
 *   encoding), `UnitToggle` (%/MW/Capacity) and `ColorGuideBar` (the legend). The middle three
 *   are one conversation — select the encoding, pick the unit it's shown in, read what the
 *   current colours mean — and the unit toggle stays out of the collapsible tier deliberately:
 *   it changes the numbers the always-visible legend shows, so hiding it behind a disclosure
 *   would hide the reason those numbers just changed.
 * - **Behind "More map settings"**: `AggregationLevelToggle` (GSP/DNO grouping) alone. It is
 *   the one control here that is genuinely set-once — which polygons the map is cut into —
 *   rather than something read or switched while interpreting a forecast.
 *
 * **Cloud cover is a flagship feature, not a setting.** The first version of this panel filed
 * `MapLayerControls` behind the disclosure alongside the grouping toggle, reasoning that both
 * describe *how the map is drawn* rather than *what the colour means*. That line is real, but
 * it was the wrong cut: clouds are the context a user reads the forecast *against*, so the
 * toggle belongs where they can reach it without opening anything — and it was a top-level
 * control before this panel existed. A consolidation must not demote what it absorbs. It sits
 * first, above the encoding, because it is the ground the rest is drawn on.
 *
 * Rejected: putting `AggregationLevelToggle` and `MapLayerControls` on the display rail
 * instead. That would satisfy §6's letter but not Brad's explicit ask — "into one panel" — and
 * it would split one coherent "what/how the map draws" story across two pieces of chrome for
 * no gain, since the rail is about the *chart's* series and confidence bands.
 *
 * `settingsOpen` is local and not persisted: it is a disclosure, not a preference like
 * `visibleLines`.
 */

const OPTION_BASE = "flex-1 rounded px-2 py-1 text-xs font-semibold transition-colors";
const OPTION_ACTIVE = "bg-ocf-yellow text-black";
const OPTION_IDLE = "bg-mapbox-black text-ocf-gray-400 hover:text-white";

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
    className={`${OPTION_BASE} ${active ? OPTION_ACTIVE : OPTION_IDLE}`}
  >
    {label}
  </button>
);

const MapEncodingControls: FC = () => {
  const [comparison] = useGlobalState("comparison");
  const [activeUnit, setActiveUnit] = useGlobalState("activeUnit");
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-mapbox-black-700/95 p-2 text-white shadow-2xl">
      {/* Satellite/PV layers are forecast-map concepts only — the delta map has no basemap fill
          to toggle, so this mirrors `map.tsx`'s old `title === MAP_TITLE_FORECAST` gate,
          expressed here since this panel is now the one place that knows which map is mounted
          (`comparison === null` is the forecast map, contract §2). */}
      {comparison === null && (
        <>
          <MapLayerControls />
          <div className="border-b border-white/10" />
        </>
      )}
      <span className="text-2xs font-semibold uppercase tracking-wider text-ocf-gray-600">
        Colour by
      </span>
      <div className="flex gap-1" role="group" aria-label="Colour by">
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
            hint={`Colour regions by the difference — ${preset.title.toLowerCase()}`}
          />
        ))}
      </div>
      {/* The unit control's own loading gate was the map's fetch state, which the dock does not
          have and should not learn. Nothing it does is unsafe mid-fetch — it writes a display
          unit and an aggregation level — so it is simply never disabled here. */}
      <UnitToggle activeUnit={activeUnit} setActiveUnit={setActiveUnit} isLoading={false} />
      <ColorGuideBar comparison={comparison} unit={activeUnit} />

      <button
        type="button"
        onClick={() => setSettingsOpen((open) => !open)}
        aria-expanded={settingsOpen}
        className="mt-0.5 flex items-center justify-between rounded px-1 py-1 text-2xs font-semibold uppercase tracking-wider text-ocf-gray-600 hover:text-white border-t border-white/10 pt-1.5"
      >
        More map settings
        <MdKeyboardArrowDown
          size={14}
          className={`transition-transform ${settingsOpen ? "rotate-180" : ""}`}
        />
      </button>

      {settingsOpen && (
        <div className="flex flex-col gap-1.5">
          <AggregationLevelToggle isLoading={false} />
        </div>
      )}
    </div>
  );
};

export default MapEncodingControls;
