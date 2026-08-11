import { FC, ReactNode } from "react";
import { MdKeyboardArrowLeft } from "@react-icons/all-files/md/MdKeyboardArrowLeft";
import { MdKeyboardArrowRight } from "@react-icons/all-files/md/MdKeyboardArrowRight";

import useGlobalState from "../helpers/globalState";
import Toggle from "../Toggle";
import LegendItem from "../charts/LegendItem";
import { GENERATION_CHART_KEYS } from "../charts/pv-remix-chart";
import { P_LEVEL_OPTIONS } from "../../constant";
import {
  CookieStorageKeys,
  setArraySettingInCookieStorage,
  setBooleanSettingInLocalStorage
} from "../helpers/cookieStorage";
import { useFocusedCountry, useGenerationSources } from "../../hooks/data";
import { getCountryConfig } from "../../config/countries";
import { RAIL_WIDTH_PX } from "./geometry";

/**
 * "How it is drawn" — the collapsible display rail.
 *
 * Contract §6 splits the controls by what they do. Navigation ("what you are looking at" —
 * countries, focus, time, comparison) is persistent chrome, because it is the state you must
 * read to know what you are seeing. Display ("how it is drawn") is everything that changes the
 * rendering of a fixed answer, and it collapses. Nothing in here changes *what* is shown, which
 * is what makes collapsing it safe.
 *
 * Two things follow, both from §6 and both structural rather than stylistic:
 *
 * - **Dashboard mode collapses it to nothing.** A control-room wall wants data and no chrome,
 *   and it is the one mode where nobody can reach over and collapse the rail by hand. The
 *   shell derives `open` from the dashboard flag rather than reacting to it, so there is no
 *   state to get out of step.
 * - **It takes its space from the chart rather than overlapping it.** See `geometry.ts`.
 *
 * Comparison and unit are deliberately *not* here — they moved to the map cluster (§5),
 * because they answer what the colour means rather than how it is drawn.
 */

const RailGroup: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <div className="border-t border-white/10 px-3 py-3 first:border-t-0">
    <span className="mb-2 block text-2xs font-semibold uppercase tracking-wider text-ocf-gray-600">
      {title}
    </span>
    {children}
  </div>
);

const RailRow: FC<{ label: string; on: boolean; onToggle: () => void }> = ({
  label,
  on,
  onToggle
}) => (
  <div className="flex items-center justify-between py-1 text-sm">
    <button type="button" onClick={onToggle} className="flex-1 text-left text-ocf-gray-300">
      <span className={on ? "text-white" : undefined}>{label}</span>
    </button>
    <Toggle onClick={onToggle} visible={on} />
  </div>
);

/** Confidence bands. Lifted out of the settings modal, which held nothing else. */
const ConfidenceBands: FC = () => {
  const [pLevels, setPLevels] = useGlobalState("pLevels");

  const toggle = (pair: [number, number]) => {
    const next = pLevels.some(([lower]) => lower === pair[0])
      ? pLevels.filter(([lower]) => lower !== pair[0])
      : [...pLevels, pair];
    setPLevels(next);
    setArraySettingInCookieStorage(CookieStorageKeys.P_LEVELS, next);
  };

  return (
    <>
      {P_LEVEL_OPTIONS.map(([lower, upper]) => (
        <RailRow
          key={lower}
          label={`P${lower} / P${upper}`}
          on={pLevels.some(([l]) => l === lower)}
          onToggle={() => toggle([lower, upper])}
        />
      ))}
    </>
  );
};

/**
 * Series visibility, over the same `visibleLines` state the chart legend writes.
 *
 * Derived from the country's configured series and the manifest's observers rather than from a
 * fixed list, for the same reason the legend is: GB charts six forecast lines and two
 * observers, NL one of each. The legend keeps its own copy of these toggles for now — it is
 * also the key to the colours, so it cannot simply lose them, and consolidating the two is
 * chart work rather than shell work.
 */
const SeriesToggles: FC = () => {
  const [showNHourView] = useGlobalState("showNHourView");
  const [nHourForecast] = useGlobalState("nHourForecast");
  const focusedCountry = useFocusedCountry();
  const seriesConfig = getCountryConfig(focusedCountry)?.nationalChartSeries ?? [];
  const generationSources = useGenerationSources(
    focusedCountry ? { country: focusedCountry, source: "solar" } : null
  );

  return (
    <div className="flex flex-col">
      <LegendItem
        iconClasses="text-ocf-yellow"
        symbolStyle="both"
        label="Current"
        dataKey="FORECAST"
      />
      {showNHourView && (
        <LegendItem
          iconClasses="text-ocf-orange"
          symbolStyle="both"
          label={`${nHourForecast} hour`}
          dataKey="N_HOUR_FORECAST"
        />
      )}
      {seriesConfig
        .slice(1)
        .filter((series) => !!series.legend)
        .map((series) => (
          <LegendItem
            key={`rail-${series.key}`}
            iconClasses={series.legend!.iconClasses}
            symbolStyle="both"
            label={series.label}
            dataKey={series.key}
          />
        ))}
      {(generationSources.data ?? [])
        .slice(0, GENERATION_CHART_KEYS.length)
        .map((source, index) => (
          <LegendItem
            key={`rail-${GENERATION_CHART_KEYS[index]}`}
            iconClasses="text-ocf-black"
            symbolStyle={index === 0 ? "dashed" : undefined}
            label={source.label}
            dataKey={GENERATION_CHART_KEYS[index]}
          />
        ))}
      <LegendItem iconClasses="text-[#ffdfd1]" label="Seasonal mean" dataKey="SEASONAL_MEAN" />
      <LegendItem
        iconClasses="text-[#ffdfd1]"
        symbolStyle="area"
        label="Seasonal quantiles"
        dataKey="SEASONAL_BOUNDS"
      />
    </div>
  );
};

const MapLayers: FC = () => {
  const [showConstraints, setShowConstraints] = useGlobalState("showConstraints");

  return (
    <RailRow
      label="Constraint boundaries"
      on={showConstraints}
      onToggle={() => {
        setShowConstraints(!showConstraints);
        setBooleanSettingInLocalStorage(CookieStorageKeys.CONSTRAINTS, !showConstraints);
      }}
    />
  );
};

const DisplayPanel: FC<{ open: boolean; onToggle: () => void }> = ({ open, onToggle }) => (
  <aside
    aria-label="Display settings"
    aria-hidden={!open}
    className="absolute inset-y-0 right-0 z-20 flex flex-col border-l border-white/10 bg-mapbox-black-500 text-white transition-transform duration-300"
    style={{ width: RAIL_WIDTH_PX, transform: open ? undefined : "translateX(100%)" }}
  >
    {/* The handle rides on the rail rather than sitting in the shell, so one transform moves
        both and there is no second position to keep in step. */}
    <button
      type="button"
      aria-expanded={open}
      aria-label={open ? "Hide display settings" : "Show display settings"}
      title={open ? "Hide display settings" : "Show display settings"}
      onClick={onToggle}
      className="absolute -left-8 top-3 flex h-8 w-8 items-center justify-center rounded-l border border-r-0 border-white/10 bg-mapbox-black-500 text-ocf-gray-300 hover:text-white"
    >
      {open ? <MdKeyboardArrowRight size={22} /> : <MdKeyboardArrowLeft size={22} />}
    </button>
    <div className="flex flex-none items-baseline justify-between border-b border-white/10 px-3 py-3">
      <span className="text-2xs font-semibold uppercase tracking-wider text-ocf-gray-400">
        Display
      </span>
      <span className="text-2xs text-ocf-gray-600">how it&rsquo;s drawn</span>
    </div>
    <div className="flex-1 overflow-y-auto pb-4">
      <RailGroup title="Confidence">
        <ConfidenceBands />
      </RailGroup>
      <RailGroup title="Map layers">
        <MapLayers />
      </RailGroup>
      <RailGroup title="Series">
        <SeriesToggles />
      </RailGroup>
    </div>
  </aside>
);

export default DisplayPanel;
