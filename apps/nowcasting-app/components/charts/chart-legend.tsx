import { FC, ReactNode } from "react";

import useGlobalState from "../helpers/globalState";
import { useFocusedCountry, useGenerationSources } from "../../hooks/data";
import { getCountryConfig } from "../../config/countries";
import { LegendAreaGraphIcon, LegendLineGraphIcon } from "../icons/icons";

/**
 * The chart's key. Option A from `docs/chart-legend-options.md`, moved from the header to the
 * chart's bottom edge — where a legend sits in most charting libraries, and where it does not
 * compete with the headline figures for the eye.
 *
 * **Inert.** It names lines, it does not switch them: that is open question 2 in the doc,
 * answered "inert" here. The display rail owns `visibleLines`; a second control bound to the
 * same state is what got the old `ChartLegend` deleted in the first place.
 *
 * **Drawn series only.** An entry appears when its key is in `visibleLines`, so switching a
 * line off in the rail removes it here too. That is the lever the doc identifies: GB configures
 * nine entries but charts five by default, and someone who has pared the chart down — the user
 * who least wants chrome — pays for the fewest rows.
 *
 * Derived from the same country config and observer manifest as `SeriesToggles` in
 * `display-panel.tsx`, in the same order, so the two always name the same set.
 */
type LegendEntry = {
  key: string;
  label: string;
  /** A `text-*` class naming the series colour. `currentColor` inside the swatch reads it. */
  iconClasses: string;
  symbolStyle?: "both" | "dashed" | "solid" | "area";
};

const Swatch: FC<{ entry: LegendEntry }> = ({ entry }) =>
  entry.symbolStyle === "area" ? (
    <LegendAreaGraphIcon className={`${entry.iconClasses} h-3 w-4 shrink-0`} />
  ) : (
    <LegendLineGraphIcon
      className={`${entry.iconClasses} h-3 w-4 shrink-0`}
      dashStyle={entry.symbolStyle}
    />
  );

/**
 * `generationKeys` is passed in rather than imported: it lives in `pv-remix-chart.tsx`, which
 * mounts this component, and importing it back would make the two modules circular.
 */
const ChartLegend: FC<{ generationKeys: readonly string[] }> = ({ generationKeys }) => {
  const [visibleLines] = useGlobalState("visibleLines");
  const [showNHourView] = useGlobalState("showNHourView");
  const [nHourForecast] = useGlobalState("nHourForecast");
  const focusedCountry = useFocusedCountry();
  const seriesConfig = getCountryConfig(focusedCountry)?.nationalChartSeries ?? [];
  const generationSources = useGenerationSources(
    focusedCountry ? { country: focusedCountry, source: "solar" } : null
  );

  const entries: LegendEntry[] = [
    { key: "FORECAST", label: "Current", iconClasses: "text-solar", symbolStyle: "both" },
    // N-hour is in `visibleLines` by default but only drawn in the N-hour view, so it needs
    // the same second condition the chart itself uses.
    ...(showNHourView
      ? [
          {
            key: "N_HOUR_FORECAST",
            label: `${nHourForecast} hour`,
            iconClasses: "text-series-nHour",
            symbolStyle: "both" as const
          }
        ]
      : []),
    ...seriesConfig
      .slice(1)
      .filter((series) => !!series.legend)
      .map((series) => ({
        key: series.key,
        label: series.label,
        iconClasses: series.legend!.iconClasses,
        symbolStyle: "both" as const
      })),
    ...(generationSources.data ?? []).slice(0, generationKeys.length).map((source, index) => ({
      key: generationKeys[index],
      label: source.label,
      iconClasses: "text-solar-light",
      symbolStyle: index === 0 ? ("dashed" as const) : undefined
    })),
    {
      key: "SEASONAL_MEAN",
      label: "Seasonal mean",
      iconClasses: "text-series-seasonal"
    },
    {
      key: "SEASONAL_BOUNDS",
      label: "Seasonal quantiles",
      iconClasses: "text-series-seasonal",
      symbolStyle: "area"
    }
  ];

  const drawn = entries.filter((entry) => visibleLines.includes(entry.key));
  // No row at all rather than an empty one: with every line switched off there is nothing to
  // key, and a bare strip of padding under the plot reads as a rendering fault.
  if (!drawn.length) return null;

  return (
    <ul
      aria-label="Chart series"
      className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-1 text-2xs leading-none text-content-secondary dash:gap-x-5 dash:pt-2 dash:text-sm"
    >
      {drawn.map((entry) => (
        <li key={`legend-${entry.key}`} className="flex items-center gap-1">
          <Swatch entry={entry} />
          <span className="whitespace-nowrap">{entry.label}</span>
        </li>
      ))}
    </ul>
  );
};

export default ChartLegend;
