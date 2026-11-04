import { Dispatch, FC, SetStateAction, useEffect, useMemo } from "react";
import RemixLine, { plotInsetRightPx } from "../remix-line";
import { DELTA_BUCKET, MAX_NATIONAL_GENERATION_MW, Y_MAX_TICKS } from "../../../constant";
import { ActiveUnit } from "../../map/types";
import { deltaExtent, deltaRampColor, deltaTopFor } from "../../../lib/domain/delta-ramp";
import ForecastHeader from "../forecast-header";
import useGlobalState, {
  useCountryState,
  getCursorCadenceMinutes,
  getCursorNow
} from "../../helpers/globalState";
import { periodForLabel, slotForInstant, snapToCadence } from "../../../lib/time/cursor";
import useFormatChartData from "../use-format-chart-data";
import { calculateChartYMax, formatISODateString } from "../../helpers/utils";
import GspPvRemixChart from "../gsp-pv-remix-chart";
import { useStopAndResetTime } from "../../hooks/use-and-update-selected-time";
import Spinner from "../../icons/spinner";
import { NationalEndpointStates, GspDeltaValue } from "../../types";
import DeltaForecastLabel from "../../delta-forecast-label";
import DeltaBuckets from "./delta-buckets-ui";
import useGspDeltas from "./use-gsp-deltas";
import useTimeNow from "../../hooks/use-time-now";
import DataLoadingChartStatus from "../DataLoadingChartStatus";
import { getTicks } from "../../helpers/chartUtils";
import {
  NATIONAL_REGION_TYPE,
  useFocusedCountry,
  useGenerationSources,
  useLoadingState,
  useNationalForecast,
  useNationalGeneration
} from "../../../hooks/data";
import type { Scope } from "../../../lib/domain/types";
import { forecastSeriesModel, getCountryConfig, type PowerUnit } from "../../../config/countries";
import { displayDecimalsFor, displayUnitFor, toDisplayPower } from "../../../lib/domain/power-unit";
import { GENERATION_CHART_KEYS } from "../pv-remix-chart";
import ChartScrubber from "../../shell/chart-scrubber";
import { plottedKeyRange, usePlottedDomain } from "../plotted-domain";
import ChartLegend from "../chart-legend";

/**
 * One column's heading: which side of the forecast it holds, in the region column's slot (the
 * names below need no label), then at `xl` — where a row is one line — what each figure is.
 * Padded and bordered like a row, transparently, so the labels sit over their columns.
 *
 * Outside the rows' scroll, not sticky inside it: sticky headings inside the scrolling box
 * pinned short of its top and let rows show above them.
 */
const GspDeltaColumnHeading: FC<{ unit: PowerUnit; negative?: boolean }> = ({
  unit,
  negative = false
}) => (
  <div
    className={`flex-1 grid grid-cols-12 whitespace-nowrap border border-transparent pl-2 pr-1 py-1 text-2xs uppercase tracking-wider text-content-secondary ${
      negative ? "border-r-4" : "border-l-4"
    }`}
  >
    <span className="col-span-12 xl:col-span-5 font-semibold text-content">
      {negative ? "Under forecast" : "Over forecast"}
      {/* Below `xl` the field labels are hidden, and with them the only statement of the unit. */}
      <span className="xl:hidden font-normal text-content-secondary"> · {unit}</span>
    </span>
    {/* Centred over the % and Δ figures, which centre in their cells at `xl`. */}
    <span className="hidden xl:block col-span-2 text-center">% cap.</span>
    {/* The units live here, once, so the cells are bare figures. */}
    <span className="hidden xl:block col-span-2 text-center">Δ {unit}</span>
    <span className="hidden xl:block col-span-3 text-right">Act / Fcst {unit}</span>
  </div>
);

const GspDeltaColumn: FC<{
  gspDeltas: Map<string, GspDeltaValue> | undefined;
  unit: PowerUnit;
  negative?: boolean;
}> = ({ gspDeltas, unit, negative = false }) => {
  const [selectedBuckets] = useGlobalState("selectedBuckets");
  const [selectedMapRegionIds, setSelectedMapRegionIds] = useCountryState("selectedMapRegionIds");
  const [activeUnit] = useGlobalState("activeUnit");
  const country = useFocusedCountry();
  const deltaArray = useMemo(() => Array.from(gspDeltas?.values() || []), [gspDeltas]);
  if (!gspDeltas?.size) return null;

  // Each row is one GSP's actual delta, a continuous figure rather than a bucket, so it reads
  // the same ramp the map fills its region with — at the region's own value, not at whichever
  // bucket edge it happens to have crossed. `deltaNormalized` is already a fraction of
  // capacity (see `use-gsp-deltas.ts`), the same scale `deltaExtent(true)` saturates at, so
  // percentage mode needs no rescaling the way the bucket rows' *100 edges do. In MW the rows
  // are the focused country's regions, so they saturate at its region tier's top — the scale
  // `use-gsp-deltas.ts` buckets them on.
  const asPercentage = activeUnit === ActiveUnit.percentage;
  const rowExtent = asPercentage ? deltaExtent(true) : deltaTopFor(country, false);

  // Sorted by whichever figure the unit toggle puts first: MW delta, or delta as a share of
  // capacity in percentage mode — a large region's modest miss otherwise tops a list that is
  // being read in percent. Same sign either way, so the column split is unaffected.
  const sortKey = (d: GspDeltaValue) => (asPercentage ? Number(d.deltaNormalized) : d.delta);
  const sortFunc = (a: GspDeltaValue, b: GspDeltaValue) =>
    negative ? sortKey(a) - sortKey(b) : sortKey(b) - sortKey(a);

  let hasRows = false;
  return (
    <>
      <div className={`flex flex-col flex-1`}>
        {deltaArray.sort(sortFunc).map((gspDelta) => {
          if (negative && gspDelta.delta >= 0) {
            return null;
          }
          if (!negative && gspDelta.delta <= 0) {
            return null;
          }

          // The row's own value, in whichever unit the ramp is currently keyed to — MW outside
          // percentage mode, the capacity fraction inside it — rather than the bucket it was
          // filed under. The zero bucket keeps its own fixed, low-opacity border and progress
          // colour: at a value of zero the ramp gives back its neutral grey too, but a border
          // drawn in a colour rather than a state (`border-opacity-40`) reads as "a small
          // negative delta" instead of "no delta worth ranking".
          const rowValue = asPercentage ? Number(gspDelta.deltaNormalized) : gspDelta.delta;
          const isZeroBucket = gspDelta.deltaBucket === DELTA_BUCKET.ZERO;
          const rampColor = deltaRampColor(rowValue, rowExtent);
          const bucketColor = isZeroBucket ? "border-content border-opacity-40" : "";
          const progressLineColor = isZeroBucket ? "bg-content bg-opacity-40" : "";
          // Computed rgb()s, so the ramp's border and fill come from inline style rather than
          // the `border-ocf-delta-*` / `bg-ocf-delta-*` classes they replace — the zero bucket
          // alone keeps its class, since it wants a fixed low-opacity tone rather than a point
          // on the ramp.
          const bucketBorderStyle = isZeroBucket ? undefined : { borderColor: rampColor };
          const bucketFillStyle = isZeroBucket ? undefined : { backgroundColor: rampColor };

          const bucketIsSelected = selectedBuckets.includes(gspDelta.deltaBucketKey);
          if (bucketIsSelected && !hasRows) {
            hasRows = true;
          }

          // Compared as strings, on the map's own id. It used to coerce both sides with
          // `Number()`, which works for GB's numeric GSP ids and turns every NL province name
          // into `NaN` — and `NaN !== NaN`, so an NL row could never show as selected even
          // once the rows themselves started appearing.
          const isSelectedGsp = selectedMapRegionIds?.includes(gspDelta.regionId);

          // this is normalized putting the delta value over the installed capacity of a gsp
          const deltaNormalizedPercentage = Math.abs(
            Number(gspDelta.deltaNormalized) * 100
          ).toFixed(0);

          const selectedDeltaRowClasses = `bg-surface-panel items-end`;

          if (!bucketIsSelected) {
            return null;
          }

          return (
            <div
              // `bg-surface-inner` is the panel's own recess token: a row's ground is not a
              // reading of zero, and the two only looked alike while the ramp's midpoint was
              // a mid grey rather than the map's black.
              className={`mb-0.5 border-surface-raised border bg-surface-inner ${
                isSelectedGsp ? selectedDeltaRowClasses : ""
              } ${
                negative ? "rounded-l" : "rounded-r"
              } box-content cursor-pointer relative flex w-full transition duration-200 ease-out
              hover:bg-surface-raised hover:ease-in`}
              key={`gspCol${gspDelta.regionId}`}
              onClick={() => setSelectedMapRegionIds([gspDelta.regionId])}
            >
              <div
                className={`items-start xl:items-center text-xs grid grid-cols-12 flex-1 py-1.5 justify-between px-2
                transition duration-200 ease-out hover:ease-in ${bucketColor} ${
                  gspDelta.delta > 0 ? `border-l-4` : `border-r-4`
                }`}
                style={bucketBorderStyle}
                key={`gspCol${gspDelta.regionId}`}
              >
                <div className="col-span-10 xl:col-span-5 flex-initial flex justify-between self-stretch items-center dash:max-w-full">
                  <span className="">{gspDelta.gspRegion}</span>
                  {/* normalized percentage: delta value/gsp installed mw capacity */}
                </div>
                {/* Aligned by the cell, not the label: `DeltaForecastLabel` carries
                    `flex-initial`, which wins over a `flex-1` passed in, so it never spans the
                    cell and justifying inside it moved nothing. */}
                <div className="col-span-2 xl:col-span-2 flex justify-end xl:justify-center">
                  <DeltaForecastLabel
                    className="text-right"
                    tip={
                      <div className="px-1 text-xs">
                        <p>{"Normalized Delta"}</p>
                      </div>
                    }
                  >
                    <span className={"self-stretch opacity-80"}>
                      {negative ? "-" : "+"}
                      {deltaNormalizedPercentage}
                    </span>
                  </DeltaForecastLabel>
                </div>

                {/* delta value, in the focused country's display unit */}
                <div className="col-span-6 xl:col-span-2 flex justify-start xl:justify-center">
                  <DeltaForecastLabel
                    tip={
                      <div className="w-28 text-xs">
                        <p>{"Delta to Forecast"}</p>
                      </div>
                    }
                  >
                    <div>
                      <p>
                        {!negative && "+"}
                        <span className="font-semibold">
                          {toDisplayPower(Number(gspDelta.delta), unit).toFixed(
                            displayDecimalsFor(unit)
                          )}
                        </span>
                      </p>
                    </div>
                  </DeltaForecastLabel>
                </div>

                {/* currentYield/forecasted yield, in the focused country's display unit */}
                <div className="col-span-6 xl:col-span-3">
                  <DeltaForecastLabel
                    tip={
                      <div className="px-1 text-xs">
                        <p>{"Actual PV / Forecast"}</p>
                      </div>
                    }
                  >
                    <div className="flex flex-1 items-end justify-end text-right font-semibold">
                      <div>
                        {/* Actual in the headers' actual colour, `solar-light`. */}
                        <span className="text-solar-light">
                          {toDisplayPower(Number(gspDelta.currentYield), unit).toFixed(
                            displayDecimalsFor(unit)
                          )}
                        </span>{" "}
                        /{" "}
                        <span className="text-solar">
                          {toDisplayPower(Number(gspDelta.forecast), unit).toFixed(
                            displayDecimalsFor(unit)
                          )}
                        </span>
                      </div>
                    </div>
                  </DeltaForecastLabel>
                </div>
                {/*</div>*/}
              </div>
              <div
                className={`absolute bottom-0 right-0 left-0 ${bucketColor}`}
                style={bucketBorderStyle}
              >
                <div
                  className={`flex items-end justify-end ${
                    gspDelta.delta > 0 ? `bottom-0 flex-row-reverse ml-1` : `mr-1`
                  }`}
                >
                  <div
                    className={`${isSelectedGsp ? `h-1` : `h-0.5`} bg-surface-panel`}
                    style={{ width: `2px` }}
                  ></div>
                  <div
                    className={`${isSelectedGsp ? `h-1` : `h-0.5`} ${progressLineColor}`}
                    style={{ width: `${deltaNormalizedPercentage}%`, ...bucketFillStyle }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}

        {!hasRows && (
          <div className={`${negative ? "pr-1.5" : "pl-1.5"}`}>
            {/* "Regions", not "GSPs": the rows are whichever regions the focused country has
                (NL provinces, DE control areas). Quiet like the empty state below the chips —
                nothing to show under a filter is not a fault. */}
            <div className="flex flex-col flex-1 items-center justify-center border-dashed border border-edge rounded-md p-6">
              <span className="text-xs text-center text-content-secondary">
                No regions {negative ? "under" : "over"} forecast
                <br />
                for the current filters
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
type DeltaChartProps = {
  date?: string;
  className?: string;
};
/**
 * The deltas panel's share of the card's flexible height, as a flex ratio against the chart's
 * `flex-1`: 0.67 is 40% beside the national chart alone, 0.86 is 30% beside it and the regional
 * chart. A share of the card, not of its own contents, so the chart keeps one size whatever the
 * table holds — rows, a chip filter, or the empty state. It was `h-[40%]`/`h-[30%]`, which never
 * bound anything (a percentage height needs a definite parent), so the panel sized to its
 * contents and the chart gave up or took the difference; a fixed `h-64` after that overflowed the
 * card instead, since the card's height is the user's to drag.
 */
const DELTA_PANEL_FLEX = {
  alone: "flex-[0.67_1_0%]",
  withRegion: "flex-[0.86_1_0%]"
} as const;

const DeltaChart: FC<DeltaChartProps> = ({ className }) => {
  const [selectedMapRegionIds, setSelectedMapRegionIds] = useCountryState("selectedMapRegionIds");
  const [visibleLines] = useGlobalState("visibleLines");
  const [selectedBuckets] = useGlobalState("selectedBuckets");
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [trialExpiredAt] = useGlobalState("trialExpiredAt");
  const [timeNow] = useGlobalState("timeNow");
  const [showNHourView] = useGlobalState("showNHourView");
  const [nHourForecast] = useGlobalState("nHourForecast");
  const { stopTime, resetTime } = useStopAndResetTime();
  const focusedCountry = useFocusedCountry();
  // Regional delta figures read in the focused country's own unit, same as the rest of its
  // chrome — only the national delta header (`ForecastHeader`) is pinned to GW regardless.
  const displayUnit = displayUnitFor(focusedCountry);
  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());
  // The cursor resolved onto the focused country's own grid. This used to round via
  // `convertToLocaleDateString` + a `Date` whose `getMinutes()` reads the *viewer's* zone —
  // a no-op for whole-hour offsets and the reason it never misbehaved, but it rounded on the
  // wrong clock and at a hardcoded half hour. `slotForInstant` is the same answer stated once.
  const selectedTimeSlot = slotForInstant(selectedTime, focusedCountry);
  // The same slot in the chart's own key spelling. Everything compared against or drawn on the
  // x axis uses this, as `pv-remix-chart` does; `selectedTime` is the raw cursor, which on a
  // period-end country (GB) is a slot before its label, and only `useGspDeltas` wants it, since
  // it resolves the slot itself.
  const selectedLabel = formatISODateString(selectedTimeSlot);
  // The latest-delta slot is a label; the cursor is an instant, so write the label's period.
  const cursorForLabel = (label: string) =>
    periodForLabel(`${label}:00.000Z`, focusedCountry).start;

  // `timeNow` is a cursor value — a period start under the one shared rule — while the chart's
  // x axis is keyed on this country's own labels. Resolve it the same way the cursor is, or the
  // LIVE line sits a whole period early on a period-end country and matches no category at all.
  const liveSlot = formatISODateString(slotForInstant(timeNow, focusedCountry));

  const { gspDeltas, scope: gspScope, window: gspWindow } = useGspDeltas(selectedTime);

  const countryConfig = getCountryConfig(focusedCountry);
  // The country's primary national series, per Track B's convention: first entry writes
  // FORECAST/PAST_FORECAST and is the model the staleness indicator reports on.
  const primarySeries = countryConfig?.nationalChartSeries?.[0];

  const scope: Scope | null = focusedCountry
    ? { country: focusedCountry, source: "solar", regionType: NATIONAL_REGION_TYPE }
    : null;

  // Start only — see the note in `pv-remix-chart.tsx`. `/regions/{region}/forecast` starts at
  // NOW by default, so without this the top chart has no past; the end is left to the API
  // because the forecast horizon is a per-country fact (GB 36h, NL 48h) and any end we pin
  // truncates one of them. Not taken from `gspWindow`, which is now empty: the `period`
  // endpoints default to the window they are pre-warmed on and are asked for nothing.

  const forecast = useNationalForecast(scope, {
    model: primarySeries ? forecastSeriesModel(primarySeries) : undefined
  });

  // Observers come from the manifest, never a hardcoded pair — see pv-remix-chart.tsx.
  const generationSources = useGenerationSources(scope);
  const observers = useMemo(
    () => (generationSources.data ?? []).map((source) => source.name),
    [generationSources.data]
  );

  const generation0 = useNationalGeneration(observers[0] === undefined ? null : scope, {
    observer: observers[0]
  });
  const generation1 = useNationalGeneration(observers[1] === undefined ? null : scope, {
    observer: observers[1]
  });
  const generationResults = [generation0, generation1];
  const generationSeries = useMemo(
    () =>
      observers.slice(0, GENERATION_CHART_KEYS.length).map((_, index) => ({
        key: GENERATION_CHART_KEYS[index],
        series: generationResults[index].data
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [observers, generation0.data, generation1.data]
  );

  const nHourHorizonMinutes = showNHourView ? nHourForecast * 60 : undefined;
  const nHour = useNationalForecast(nHourHorizonMinutes === undefined ? null : scope, {
    horizonMinutes: nHourHorizonMinutes
  });

  // Same scope/window `useGspDeltas` fetched with, so this costs no extra request — the
  // contract's "pass it the same scope, window, model and observers" rule.
  const loadingState = useLoadingState({
    scope,
    regionScope: gspScope,
    periodWindow: gspWindow,
    model: primarySeries ? forecastSeriesModel(primarySeries) : undefined,
    observers,
    nHourHorizonMinutes
  });

  const hasGspPvInitialForSelectedTime = generation0.data?.values.some(
    (v) => v.timeUtc.slice(0, 16) === formatISODateString(selectedTimeSlot)
  );

  // The commented-out `chartLimits` / `useHotKeyControlChart` pair that sat here is gone — this
  // view has arrow keys now, from `useCursorHotkeys` in `dashboard-shell.tsx`. Binding them per
  // chart is what left this one without them in the first place.

  const chartData = useFormatChartData({
    forecastSeries: forecast.data,
    nHourSeries: nHour.data,
    generationSeries,
    timeTrigger: selectedLabel,
    delta: true,
    appendTeaserForecast: !!trialExpiredAt
  });

  // See `pv-remix-chart.tsx` and `plotted-domain.ts`.
  const plottedDomain = usePlottedDomain(chartData);

  const yMax = useMemo(() => {
    return calculateChartYMax(chartData, MAX_NATIONAL_GENERATION_MW);
  }, [chartData]);

  /**
   * The most recent slot that actually has a delta, or `undefined` if none does.
   *
   * A delta needs an observation to compare against, so it only exists in the past, and only
   * once generation has published for that slot — `useFormatChartData` leaves `DELTA` absent
   * otherwise, the same "no delta is not a delta of zero" rule `buildRegionValues` applies for
   * the map. Derived from the data rather than a fixed offset: GB and NL publish on different
   * cadences and lag by different amounts, so "now minus an hour" is right for neither.
   */
  const latestSlotWithDelta = useMemo(() => {
    if (!chartData?.length) return undefined;
    for (let i = chartData.length - 1; i >= 0; i--) {
      if ((chartData[i] as any).DELTA !== undefined) return (chartData[i] as any).formattedDate;
    }
    return undefined;
  }, [chartData]);

  // Used to be guarded on `view === VIEWS.DELTA`; `pages/index.tsx` only ever mounts this
  // component when `comparison` is set (Wave 4), so the guard was true on every render this
  // effect could fire on, and dropped rather than swapped for an equivalent check.
  // Range, not exact slot — see the same effect in `pv-remix-chart.tsx`. The cursor steps on
  // the finest enabled country's grid, so requiring an exact match here fought the scrubber.
  //
  // Earliest and latest, not `chartData[0]` and `chartData[n - 1]`: the array is not sorted, so
  // position 0 is not the chart's start. See `plotted-domain.ts`.
  useEffect(() => {
    const keys = plottedKeyRange(chartData);
    if (!keys) return;
    if (selectedLabel < keys.earliest || selectedLabel > keys.latest) {
      setSelectedISOTime(
        latestSlotWithDelta ? cursorForLabel(latestSlotWithDelta) : getCursorNow()
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, selectedLabel, setSelectedISOTime, latestSlotWithDelta]);

  const hasError = [forecast, ...generationResults, nHour].some((result) => !!result.error);
  // The single-observer generalisation from Track B: a country with one observer waits for
  // one series, not forever for a second that does not exist.
  const waitingForData =
    !forecast.data || generationSeries.some((series) => series.series === undefined);

  if (waitingForData)
    return (
      <div className={`h-full flex ${className}`}>
        <Spinner></Spinner>
      </div>
    );

  // Click-to-set-time. The label comes off this country's axis, so it may sit between two
  // slots of the shared cursor grid when a finer country is enabled — snap it, so the chart
  // and the map are never a slot apart. On a single-cadence session this is a no-op.
  //
  // The label is a published timestamp and the cursor is an instant, so it goes through
  // `periodForLabel`: writing the label itself selected the period *after* it wherever labels
  // close their period (GB), because the chart reads the cursor back with `slotForInstant`.
  const setSelectedTime = (time: string) => {
    stopTime();
    const { start } = periodForLabel(`${time}:00.000Z`, focusedCountry);
    setSelectedISOTime(snapToCadence(start, getCursorCadenceMinutes()));
  };

  let selectedRegions: string[] = [];
  if (selectedMapRegionIds && selectedMapRegionIds.length > 0) {
    selectedRegions = selectedMapRegionIds.map((id) => String(id));
  }

  return (
    <>
      {/* `min-h-0` down the column: a flex item's default `min-height: auto` is its content, so
          without it a chart that grew pushed every box above it past the card's fixed height —
          the plot swelled to two screens tall. */}
      <div className={`flex flex-col flex-1 min-h-0 ${className || ""}`}>
        {/* The same `p-2` card and plot well as `pv-remix-chart.tsx`, so the header and plot
            sit in the same place when the comparison switches. */}
        <div className="flex flex-1 min-h-0 flex-col relative px-2 pt-1.5 pb-2 dash:h-auto">
          <ForecastHeader
            forecastSeries={forecast.data}
            generationSeries={generation0.data}
            deltaView={true}
          ></ForecastHeader>
          {waitingForData && !hasError && (
            <div
              className={`h-full absolute flex pb-7 items-center justify-center inset-0 z-30 ${className}`}
            >
              <Spinner></Spinner>
            </div>
          )}
          <div className="relative flex-1 min-h-0 overflow-hidden rounded-md border-[0.5px] border-edge bg-plot-base shadow-well">
            <DataLoadingChartStatus<NationalEndpointStates> loadingState={loadingState} />
            {/* Absolute, so the chart takes the well's size and never gives it one: recharts'
                `ResponsiveContainer` is 100% of its parent, and a parent sized by its content
                grows with it — a loop that only a box outside the flow breaks. */}
            <div className="absolute inset-0">
              <RemixLine
                national
                resetTime={resetTime}
                timeNow={liveSlot}
                timeOfInterest={selectedLabel}
                setTimeOfInterest={setSelectedTime}
                data={chartData}
                yMax={yMax}
                yTicks={getTicks(yMax, Y_MAX_TICKS)}
                visibleLines={visibleLines}
                deltaView={true}
                trialExpiredAt={trialExpiredAt}
              />
            </div>
          </div>
        </div>
        {selectedMapRegionIds && selectedMapRegionIds.length > 0 && (
          <div className="flex-1 min-h-0 flex flex-col relative dash:h-auto">
            <GspPvRemixChart
              close={() => {
                setSelectedMapRegionIds([]);
              }}
              setTimeOfInterest={setSelectedTime}
              selectedTime={selectedLabel}
              selectedRegions={selectedRegions}
              timeNow={liveSlot}
              resetTime={resetTime}
              visibleLines={visibleLines}
              deltaView={true}
            ></GspPvRemixChart>
          </div>
        )}
        {/* The scrub track, above the legend and inset to the plot's own x-axis. See
            `components/shell/chart-scrubber.tsx`. */}
        {/* The delta chart's right inset, which differs for its second Y axis — see
            `plotInsetRightPx`. */}
        <ChartScrubber
          domain={plottedDomain}
          insetRightPx={plotInsetRightPx(true, !!selectedMapRegionIds?.length)}
        />
        {/* Below the well, not inside it: the key describes the plot rather than sitting on
              it, and it is where most charting libraries put one. */}
        <div className="flex px-2 pb-2 dash:h-auto">
          <ChartLegend generationKeys={GENERATION_CHART_KEYS} />
        </div>
        <div
          // Chips and headings fixed, only the rows scrolling beneath them — the chips used to
          // be sticky in the same scroll as the rows and headings, and they collided.
          className={`flex flex-col min-h-0 pb-3 ${
            selectedMapRegionIds?.length ? DELTA_PANEL_FLEX.withRegion : DELTA_PANEL_FLEX.alone
          }`}
        >
          {/* The chips and the headings stay whether or not there are actuals, so crossing the
              publishing edge empties the table in place rather than collapsing the panel. */}
          <DeltaBuckets
            bucketSelection={selectedBuckets}
            gspDeltas={hasGspPvInitialForSelectedTime ? gspDeltas : undefined}
            unit={displayUnit}
          />
          <div className="flex pt-0.5 mx-3">
            <GspDeltaColumnHeading unit={displayUnit} negative />
            <GspDeltaColumnHeading unit={displayUnit} />
          </div>
          {hasGspPvInitialForSelectedTime && gspDeltas ? (
            // Fills what the panel leaves under the chips and headings (`DELTA_PANEL_FLEX`).
            <div className="flex flex-1 min-h-0 overflow-y-auto mx-3">
              <GspDeltaColumn gspDeltas={gspDeltas} unit={displayUnit} negative />
              <GspDeltaColumn gspDeltas={gspDeltas} unit={displayUnit} />
            </div>
          ) : (
            // In the table's own space, a table's height, worded as the header's coverage note
            // is: this is the ordinary state near the publishing edge, not a fault.
            <div className="mx-3 flex flex-1 min-h-0 items-center justify-center rounded border border-edge text-xs text-content-secondary">
              No actuals yet for this time. Try selecting a previous period.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DeltaChart;
