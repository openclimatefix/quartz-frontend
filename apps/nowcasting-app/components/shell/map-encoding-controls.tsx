import { FC } from "react";

import useGlobalState, { setComparison } from "../helpers/globalState";
import {
  COMPARISON_PRESETS,
  ComparisonSelection,
  NO_COMPARISON_LABEL
} from "../helpers/comparison";
import MeasuringUnit from "../map/measuringUnit";
import ColorGuideBar from "../map/color-guide-bar";
import DeltaColorGuideBar from "../map/delta-color-guide-bar";

/**
 * What the map's colour means — comparison, and the unit it is measured in.
 *
 * **Track E owns this file.** Wave 3 turns it into the single "Colour by" control that selects
 * the encoding and then explains it, absorbing `color-guide-bar` and `delta-color-guide-bar`
 * (contract §5). What is here now is the minimum that keeps the feature reachable once the
 * three-view nav is gone: the delta view had no other way in, and a mode nobody can enter is
 * not something Brad can judge on the live pass.
 *
 * The two guide bars are mounted here unchanged, swapped by the same comparison state that
 * chooses the map — the existing swap, working off the new state rather than off `VIEWS`. They
 * had to move: both used to anchor themselves to the map's bottom-left corner, which is where
 * the floating chart now sits, so left where they were they would simply have been behind it.
 * Their content is untouched and merging the two into one control remains Track E's.
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
      <MeasuringUnit activeUnit={activeUnit} setActiveUnit={setActiveUnit} isLoading={false} />
      <div className="overflow-x-auto">
        {comparison ? <DeltaColorGuideBar /> : <ColorGuideBar unit={activeUnit} />}
      </div>
    </div>
  );
};

export default MapEncodingControls;
