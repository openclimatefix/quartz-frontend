import { FC, ReactNode, useMemo } from "react";
import { MdKeyboardArrowLeft } from "@react-icons/all-files/md/MdKeyboardArrowLeft";
import { MdKeyboardArrowRight } from "@react-icons/all-files/md/MdKeyboardArrowRight";

import useGlobalState from "../helpers/globalState";
import Toggle from "../Toggle";
import LegendItem from "../charts/LegendItem";
import { GENERATION_CHART_KEYS } from "../charts/pv-remix-chart";
import { N_HOUR_FORECAST_OPTIONS, P_LEVEL_OPTIONS } from "../../constant";
import { CookieStorageKeys, setArraySettingInCookieStorage } from "../helpers/cookieStorage";
import { useFocusedCountry, useGenerationSources, useNationalForecast } from "../../hooks/data";
import { getAvailablePLevels } from "../helpers/chartUtils";
import { forecastSeriesModel, getCountryConfig } from "../../config/countries";
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
  <div className="border-t border-content/10 px-2 py-2 first:border-t-0">
    <span className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-content-secondary">
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
  <div className="flex items-center justify-between py-0.5 text-2xs uppercase tracking-wider">
    <button type="button" onClick={onToggle} className="flex-1 text-left text-content">
      <span className={on ? "text-content" : undefined}>{label}</span>
    </button>
    <Toggle onClick={onToggle} visible={on} />
  </div>
);

/**
 * Which of the configured pairs the country's forecast actually carries.
 *
 * Read from the data rather than declared per country: the levels a model publishes are the
 * API's to change, and a config list would go stale silently — offering a band that draws
 * nothing, which reads as a broken toggle. DE publishes p10/p90 only, where GB has all three.
 *
 * This is the primary series' own query, with the arguments `pv-remix-chart.tsx` passes, so
 * react-query serves it from cache and the panel costs no request. Until it resolves, every
 * configured pair shows — the chart is empty then too, so there is nothing to mismatch.
 */
const useAvailablePLevels = (): [number, number][] => {
  const focusedCountry = useFocusedCountry();
  const config = getCountryConfig(focusedCountry);
  const primary = config?.nationalChartSeries[0];
  const forecast = useNationalForecast(
    focusedCountry && primary
      ? { country: focusedCountry, source: "solar", regionType: "national" }
      : null,
    { model: primary ? forecastSeriesModel(primary) : undefined }
  );

  return useMemo(() => {
    // `plevelsMw` is keyed by the bare level ("10"), which is what `normalise.ts` reconciles
    // the wire's `p10` down to — and what `getAvailablePLevels` wants prefixed again.
    const published = forecast.data?.values?.find(
      (value) => value.plevelsMw && Object.keys(value.plevelsMw).length > 0
    )?.plevelsMw;
    if (!published) return P_LEVEL_OPTIONS;
    const prefixed: Record<string, number | undefined> = {};
    // A `null` plevel is a published band with no value at this instant, which is not the
    // same as an absent band — but for "does this country have this band at all" it reads the
    // same way, and the chart would draw nothing either.
    for (const [level, mw] of Object.entries(published)) {
      prefixed[`plevel_${level}`] = mw ?? undefined;
    }
    return getAvailablePLevels(prefixed, P_LEVEL_OPTIONS);
  }, [forecast.data]);
};

/** Confidence bands. Lifted out of the settings modal, which held nothing else. */
const ConfidenceBands: FC = () => {
  const [pLevels, setPLevels] = useGlobalState("pLevels");

  const available = useAvailablePLevels();

  const toggle = (pair: [number, number]) => {
    const next = pLevels.some(([lower]) => lower === pair[0])
      ? pLevels.filter(([lower]) => lower !== pair[0])
      : [...pLevels, pair];
    setPLevels(next);
    setArraySettingInCookieStorage(CookieStorageKeys.P_LEVELS, next);
  };

  return (
    <>
      {available.map(([lower, upper]) => (
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
/**
 * The N-hour line's horizon. It lost its control when the old `ChartLegend` went and has sat
 * on its default of four hours since; it comes back on the row that names the line rather
 * than as a rail setting of its own, because the number IS the line's label.
 */
const NHourSelect: FC = () => {
  const [nHourForecast, setNHourForecast] = useGlobalState("nHourForecast");
  return (
    <label className="flex items-center">
      <span className="sr-only">Comparison forecast horizon, in hours</span>
      {/* The whole label is the control, so it reads as a name and behaves as a menu: the
          caret is the only chrome, and the type matches the rows either side of it. */}
      <select
        value={nHourForecast}
        onChange={(event) => setNHourForecast(Number(event.target.value))}
        className="m-0 h-auto w-auto cursor-pointer appearance-none border-0 bg-transparent p-0 pr-3 pl-1 text-2xs uppercase leading-tight text-content focus:outline-none focus:ring-0 dash:text-base dash:tracking-wider"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' fill='none' stroke='rgb(200,200,200)' stroke-width='1.5'><path d='M1 1l4 4 4-4'/></svg>\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right center",
          backgroundSize: "7px 5px"
        }}
      >
        {N_HOUR_FORECAST_OPTIONS.map((option) => (
          <option key={`n-hour-${option}`} value={option} className="bg-surface text-content">
            {option} hour
          </option>
        ))}
      </select>
    </label>
  );
};

const SeriesToggles: FC = () => {
  const [showNHourView] = useGlobalState("showNHourView");
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
          label="hour"
          dataKey="N_HOUR_FORECAST"
          labelControl={<NHourSelect />}
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

const DisplayPanel: FC<{
  open: boolean;
  onToggle: () => void;
  /**
   * TRIAL: attached to the chart's right edge rather than parked at the stage's. The park
   * slide and the tab both assume a stage edge to hide behind — here there is none, so the
   * panel simply is not rendered when shut and its opener rides on the chart instead.
   */
  attached?: boolean;
}> = ({ open, onToggle, attached = false }) => (
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
    className={`pointer-events-auto relative flex min-h-0 flex-col rounded-lg border border-content/10 bg-surface-panel/95 text-content shadow-2xl ${
      attached ? "rounded-tr-none" : "rounded-tl-none"
    }`}
    style={{
      // Shut, it parks off its own edge: left, behind the chart, when attached to one;
      // right, off the stage, when it lives in the dock's column. Either way the tab it
      // carries stays on screen, which is what makes it findable again.
      transform: open
        ? undefined
        : attached
        ? `translateX(calc(-100% - ${STAGE_GUTTER_PX}px))`
        : `translateX(calc(100% + ${STAGE_GUTTER_PX}px))`,
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
        panel's outer edge, which is what leaves it on screen once the panel has parked — the
        left edge in the dock's column, the right edge when the panel is attached to the chart
        and parks behind it.

        It is level with the panel's top, whose top-left corner is square so the two read as one
        piece. `-top-px` because the tab is placed from inside the panel's border, so `top-0`
        left its own top border a pixel below the panel's.

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
      className={`pointer-events-auto absolute -top-px flex h-8 items-center border border-content/10 ${
        attached
          ? // Shut, it is wider than it looks: the extra width runs left, under the chart,
            // filling the notch the chart's rounded corner would otherwise leave beside it.
            // Open, that overhang would lie across the panel instead — drawing its bottom
            // border over the first row — so the tab narrows to its visible width.
            `${
              open ? "w-8 justify-center" : "w-12 justify-end pr-1"
            } -right-8 rounded-r-lg border-l-0`
          : "w-8 -left-8 rounded-l-lg border-r-0"
      } bg-surface-panel/95 text-interactive shadow-2xl transition-colors hover:bg-surface-raised focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-interactive`}
    >
      {open === attached ? <MdKeyboardArrowLeft size={20} /> : <MdKeyboardArrowRight size={20} />}
    </button>
    {/* No "Display / how it's drawn" header any more (Brad, 2026-08-28: "I'm not convinced
        it is useful at all"). It cost a row of vertical space in a column that is already the
        tallest thing on screen, to caption three groups that name themselves. */}
    <div
      id="display-settings"
      aria-hidden={!open}
      className="min-h-0 flex-1 overflow-y-auto rounded-lg"
    >
      <RailGroup title="Confidence">
        <ConfidenceBands />
      </RailGroup>
      <RailGroup title="Series">
        <SeriesToggles />
      </RailGroup>
    </div>
  </aside>
);

export default DisplayPanel;
