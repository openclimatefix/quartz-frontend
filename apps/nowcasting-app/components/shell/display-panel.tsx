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
  <div className="border-t border-content/10 px-3 py-3 first:border-t-0">
    <span className="mb-2 block text-2xs font-semibold uppercase tracking-wider text-content-secondary">
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
    <button type="button" onClick={onToggle} className="flex-1 text-left text-content">
      <span className={on ? "text-content" : undefined}>{label}</span>
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
 * Series visibility, over the same `visibleLines` state the chart used to write via its own
 * legend.
 *
 * Derived from the country's configured series and the manifest's observers rather than from a
 * fixed list, for the same reason the old chart legend was: GB charts six forecast lines and
 * two observers, NL one of each.
 *
 * Phase 6 followup (Track G): this *is* the colour key now. The chart's own legend
 * (`ChartLegend`/`LegendItem` mounted inside `pv-remix-chart.tsx` and `delta-view-chart.tsx`)
 * duplicated these toggles and was removed; each `LegendItem` below carries the same
 * `iconClasses` swatch the chart legend used, so a toggle still identifies the line it
 * controls by colour — it just lives here instead of also living bottom-left of the chart.
 * `/sites` is untouched: it has no display rail and renders its own `LegendItem`s inline
 * (`solar-site-view/solar-site-chart.tsx`), which was never `ChartLegend` and was out of scope.
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
      <LegendItem iconClasses="text-solar" symbolStyle="both" label="Current" dataKey="FORECAST" />
      {showNHourView && (
        <LegendItem
          iconClasses="text-series-nHour"
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
            iconClasses="text-solar-light"
            symbolStyle={index === 0 ? "dashed" : undefined}
            label={source.label}
            dataKey={GENERATION_CHART_KEYS[index]}
          />
        ))}
      <LegendItem
        iconClasses="text-series-seasonal"
        label="Seasonal mean"
        dataKey="SEASONAL_MEAN"
      />
      <LegendItem
        iconClasses="text-series-seasonal"
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
    className="absolute bottom-0 top-14 right-0 z-20 flex flex-col border-l border-content/10 bg-surface-panel text-content transition-transform duration-300"
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
      className="absolute -left-8 top-3 flex h-8 w-8 items-center justify-center rounded-l border border-r-0 border-content/10 bg-surface-panel text-content hover:text-content"
    >
      {open ? <MdKeyboardArrowRight size={22} /> : <MdKeyboardArrowLeft size={22} />}
    </button>
    <div className="flex flex-none items-baseline justify-between border-b border-content/10 px-3 py-3">
      <span className="text-2xs font-semibold uppercase tracking-wider text-content">Display</span>
      <span className="text-2xs text-content-secondary">how it&rsquo;s drawn</span>
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
