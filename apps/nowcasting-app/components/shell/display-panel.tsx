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
import { STAGE_GUTTER_PX } from "./geometry";

/**
 * "How it is drawn" — the display panel, second card in the map control column.
 *
 * Contract §6 splits the controls by what they do. Navigation ("what you are looking at" —
 * countries, focus, time, comparison) is persistent chrome, because it is the state you must
 * read to know what you are seeing. Display ("how it is drawn") is everything that changes the
 * rendering of a fixed answer, and it collapses. Nothing in here changes *what* is shown, which
 * is what makes collapsing it safe.
 *
 * **It used to be a 256px rail down the right edge** (Brad, 2026-08-28: "move the expand button
 * to just below the map controls panel, and then open it out underneath that"). The rail's own
 * width was the problem it created: opening it narrowed the chrome inset, so asking to see the
 * series toggles resized the chart under the pointer, and the shell carried a
 * `transition-[right]` to make that resize look deliberate. Sharing the dock's column costs
 * nothing, because the chart is *already* capped short of that column — see `geometry.ts`'s
 * `maxChartWidthPx` — so opening this now moves nothing on screen.
 *
 * **The motion is still the rail's**, and so is its tab — the panel slides in from off the
 * right edge, it is just dock-width and dock-height now instead of a full-height column. A
 * disclosure bar was tried in between and dropped: it spent a row of vertical space, in the
 * tallest column on screen, on a caption for three groups that name themselves.
 *
 * Dashboard mode does not render it at all — a control-room wall wants data and no chrome, and
 * it is the one mode where nobody can reach over and collapse a panel by hand.
 *
 * Comparison and unit are deliberately *not* here — they moved to the map cluster (§5),
 * because they answer what the colour means rather than how it is drawn.
 */

const RailGroup: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <div className="border-t border-content/10 px-2 py-2.5 first:border-t-0">
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
  // Parked off the right edge when shut, the way the rail was, and clipped by the stage's
  // `overflow-hidden`. The offset is `100% + STAGE_GUTTER_PX` because the column itself is
  // inset from the stage edge by that gutter — a plain `100%` leaves an 8px slice showing.
  //
  // `min-h-0` is what makes the body scrollable: without it the card sizes to its content and
  // overflows the column's bottom edge instead of shrinking. This is the column's only
  // shrinkable child (`MapEncodingControls` carries `shrink-0`), so a short viewport takes the
  // height out of here, which is the right half to lose.
  <aside
    aria-label="Display settings"
    className="relative flex min-h-0 flex-col rounded-lg border border-content/10 bg-surface-panel/95 text-content shadow-2xl"
    style={{
      transform: open ? undefined : `translateX(calc(100% + ${STAGE_GUTTER_PX}px))`,
      // `visibility` rides along so a parked panel is out of the tab order as well as out of
      // sight — `aria-hidden` alone leaves a dozen focusable toggles reachable off-stage, which
      // the old rail got wrong too. It flips instantly on the way in and waits out the slide on
      // the way back; a plain `transition: visibility 300ms` would blink the panel away halfway
      // through the exit, because discrete properties switch at the midpoint.
      visibility: open ? undefined : "hidden",
      transitionProperty: "transform, visibility",
      transitionDuration: "300ms, 0s",
      transitionDelay: open ? "0s, 0s" : "0s, 300ms"
    }}
  >
    {/* The tab rides on the panel rather than sitting in the column, so one transform moves
        both and there is no second position to keep in step. It hangs a tab's width outside the
        panel's left edge, which is what leaves it on screen once the panel has parked: shut, it
        sits flush against the stage's right edge, just below the map controls.

        `visibility: visible` re-declares what the parked panel above has just turned off —
        the property inherits, and this is the one thing that must survive it. */}
    <button
      type="button"
      aria-expanded={open}
      aria-controls="display-settings"
      aria-label={open ? "Hide display settings" : "Show display settings"}
      title={open ? "Hide display settings" : "Show display settings"}
      onClick={onToggle}
      style={{ visibility: "visible" }}
      className="absolute -left-8 top-3 flex h-8 w-8 items-center justify-center rounded-l-lg border border-r-0 border-content/10 bg-surface-panel/95 text-interactive shadow-2xl transition-colors hover:bg-surface-raised focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-interactive"
    >
      {open ? <MdKeyboardArrowRight size={20} /> : <MdKeyboardArrowLeft size={20} />}
    </button>
    {/* No "Display / how it's drawn" header any more (Brad, 2026-08-28: "I'm not convinced
        it is useful at all"). It cost a row of vertical space in a column that is already the
        tallest thing on screen, to caption three groups that name themselves. */}
    <div
      id="display-settings"
      aria-hidden={!open}
      className="min-h-0 flex-1 overflow-y-auto rounded-lg py-1"
    >
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
