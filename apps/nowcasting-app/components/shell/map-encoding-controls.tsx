import { FC } from "react";

import useGlobalState, { setComparison } from "../helpers/globalState";
import {
  COMPARISON_PRESETS,
  ComparisonSelection,
  NO_COMPARISON_LABEL
} from "../helpers/comparison";
import MeasuringUnit from "../map/measuringUnit";
import ColorGuideBar from "../map/color-guide-bar";

/**
 * What the map's colour means — comparison, and the unit it is measured in.
 *
 * The "Colour by" segmented control below selects the encoding (`setComparison`); the
 * `ColorGuideBar` beneath it explains whichever one is selected. `color-guide-bar.tsx` and
 * `delta-color-guide-bar.tsx` were two components swapped by a ternary on `comparison` — they
 * are now one component with the same switch inside it (contract §5), so "select" and
 * "explain" are one control end to end rather than a control plus two things it happens to
 * sit above. See `color-guide-bar.tsx` for the multi-country legend decision, which is the
 * part of this merge Track F's map fan-out actually made interesting.
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
      <ColorGuideBar comparison={comparison} unit={activeUnit} />
    </div>
  );
};

export default MapEncodingControls;
