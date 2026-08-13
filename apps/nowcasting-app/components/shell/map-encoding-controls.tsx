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
 * - **Always visible**: "Colour by" (which encoding), `UnitToggle` (%/MW/Capacity) and
 *   `ColorGuideBar` (the legend). These three are one conversation — select the encoding, pick
 *   the unit it's shown in, read what the current colours mean — and the unit toggle stays out
 *   of the collapsible tier deliberately: it changes the numbers the always-visible legend
 *   shows, so hiding it behind a disclosure would hide the reason those numbers just changed.
 * - **Behind "More map settings"**: `AggregationLevelToggle` (GSP/DNO grouping) and
 *   `MapLayerControls` (Clouds/PV + satellite channel). Both are closer to *how the map is
 *   drawn* than *what the colour means* — the same "what vs how" line contract §6 draws
 *   between navigation and the display rail, applied one level down inside a cluster that
 *   §5 keeps off the rail entirely. They are lower-frequency changes than the encoding above
 *   them, so collapsing them is what keeps the always-visible footprint close to what it was
 *   before this track added a second control group to the corner.
 *
 * Rejected: putting `AggregationLevelToggle` and `MapLayerControls` on the display rail
 * instead of behind a disclosure here. That would satisfy §6's letter but not Brad's explicit
 * ask — "into one panel" — and it would split one coherent "what/how the map draws" story
 * across two different pieces of chrome (this corner and the rail) for no gain, since the rail
 * is about the *chart's* series and confidence bands, not the map's basemap.
 *
 * Collapsed by default: a fresh session shows the encoding + legend only, the state most
 * people read most often; `settingsOpen` is local (not persisted) since it's a disclosure, not
 * a preference like `visibleLines`.
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
          {/* Satellite/PV layers are forecast-map concepts only — the delta map has no basemap
              fill to toggle, so this mirrors `map.tsx`'s old `title === MAP_TITLE_FORECAST`
              gate, expressed here since this panel is now the one place that knows which map
              is mounted (`comparison === null` is the forecast map, contract §2). */}
          {comparison === null && <MapLayerControls />}
        </div>
      )}
    </div>
  );
};

export default MapEncodingControls;
