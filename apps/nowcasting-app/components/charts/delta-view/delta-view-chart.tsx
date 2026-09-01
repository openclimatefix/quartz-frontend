import { Dispatch, FC, SetStateAction, useEffect, useMemo, useRef } from "react";
import RemixLine from "../remix-line";
import { DELTA_BUCKET, MAX_NATIONAL_GENERATION_MW, Y_MAX_TICKS } from "../../../constant";
import ForecastHeader from "../forecast-header";
import useGlobalState, {
  useCountryState,
  getCursorCadenceMinutes,
  getCursorNow
} from "../../helpers/globalState";
import { slotForInstant, snapToCadence } from "../../../lib/time/cursor";
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
import { forecastSeriesModel, getCountryConfig } from "../../../config/countries";
import { GENERATION_CHART_KEYS } from "../pv-remix-chart";

const GspDeltaColumn: FC<{
  gspDeltas: Map<string, GspDeltaValue> | undefined;
  negative?: boolean;
}> = ({ gspDeltas, negative = false }) => {
  const [selectedBuckets] = useGlobalState("selectedBuckets");
  const [selectedMapRegionIds, setSelectedMapRegionIds] = useCountryState("selectedMapRegionIds");
  const deltaArray = useMemo(() => Array.from(gspDeltas?.values() || []), [gspDeltas]);
  if (!gspDeltas?.size) return null;

  const sortFunc = (a: GspDeltaValue, b: GspDeltaValue) => {
    if (negative) {
      return a.delta - b.delta;
    } else {
      return b.delta - a.delta;
    }
  };

  let hasRows = false;
  return (
    <>
      <div className={`flex flex-col flex-1`}>
        {deltaArray.sort(sortFunc).map((gspDelta) => {
          let bucketColor = "";
          let dataKey = "";
          let progressLineColor = "";
          if (negative && gspDelta.delta >= 0) {
            return null;
          }
          if (!negative && gspDelta.delta <= 0) {
            return null;
          }
          switch (gspDelta.deltaBucket) {
            case DELTA_BUCKET.NEG4:
              bucketColor = "border-ocf-delta-100";
              progressLineColor = "bg-ocf-delta-100";
              dataKey = "-4";
              break;
            case DELTA_BUCKET.NEG3:
              bucketColor = "border-ocf-delta-200";
              progressLineColor = "bg-ocf-delta-200";
              dataKey = "-3";
              break;
            case DELTA_BUCKET.NEG2:
              bucketColor = "border-ocf-delta-300";
              progressLineColor = "bg-ocf-delta-300";
              dataKey = "-2";
              break;
            case DELTA_BUCKET.NEG1:
              bucketColor = "border-ocf-delta-400";
              progressLineColor = "bg-ocf-delta-400";
              dataKey = "-1";
              break;
            case DELTA_BUCKET.ZERO:
              bucketColor = "border-content border-opacity-40";
              progressLineColor = "bg-content bg-opacity-40";
              dataKey = "0";
              break;
            case DELTA_BUCKET.POS1:
              bucketColor = "border-ocf-delta-600";
              progressLineColor = "bg-ocf-delta-600";
              dataKey = "1";
              break;
            case DELTA_BUCKET.POS2:
              bucketColor = "border-ocf-delta-700";
              progressLineColor = "bg-ocf-delta-700";
              dataKey = "2";
              break;
            case DELTA_BUCKET.POS3:
              bucketColor = "border-ocf-delta-800";
              progressLineColor = "bg-ocf-delta-800";
              dataKey = "3";
              break;
            case DELTA_BUCKET.POS4:
              bucketColor = "border-ocf-delta-900";
              progressLineColor = "bg-ocf-delta-900";
              dataKey = "4";
              break;
          }

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

          const tickerColor = `${isSelectedGsp ? `h-2.5` : `h-2`} ${
            gspDelta.delta > 0 ? `bg-ocf-delta-900` : `bg-ocf-delta-100`
          }`;

          const deltaRowClasses = `bg-ocf-delta-950`;

          const selectedDeltaRowClasses = `bg-surface-panel items-end`;

          if (!bucketIsSelected) {
            return null;
          }

          return (
            <div
              className={`mb-0.5 border-surface-raised border ${
                isSelectedGsp ? selectedDeltaRowClasses : deltaRowClasses
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
                  gspDelta.delta > 0 ? `border-l-8` : `border-r-8`
                }`}
                key={`gspCol${gspDelta.regionId}`}
              >
                <div className="col-span-10 xl:col-span-5 flex-initial flex justify-between self-stretch items-center dash:max-w-full">
                  <span className="">{gspDelta.gspRegion}</span>
                  {/* normalized percentage: delta value/gsp installed mw capacity */}
                </div>
                <div className="col-span-2 xl:col-span-2 flex">
                  <DeltaForecastLabel
                    className="flex-1 text-right justify-end xl:justify-start "
                    tip={
                      <div className="px-1 text-xs">
                        <p>{"Normalized Delta"}</p>
                      </div>
                    }
                  >
                    <span className={"self-stretch opacity-80"}>
                      {negative ? "-" : "+"}
                      {deltaNormalizedPercentage}%
                    </span>
                  </DeltaForecastLabel>
                </div>

                {/* delta value in mw */}
                <div className="col-span-6 xl:col-span-2 flex justify-start">
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
                          {Number(gspDelta.delta).toFixed(0)}
                        </span>{" "}
                        <span className="opacity-80 text-2xs font-thin">MW</span>
                      </p>
                    </div>
                  </DeltaForecastLabel>
                </div>

                {/* currentYield/forecasted yield */}
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
                        <span className={"text-content-on-accent"}>
                          {Number(gspDelta.currentYield).toFixed(0)}
                        </span>{" "}
                        / <span className="text-solar">{Number(gspDelta.forecast).toFixed(0)}</span>{" "}
                        <span className={`opacity-80 text-2xs font-thin`}>MW</span>
                      </div>
                    </div>
                  </DeltaForecastLabel>
                </div>
                {/*</div>*/}
              </div>
              <div className={`absolute bottom-0 right-0 left-0 ${bucketColor}`}>
                <div
                  className={`flex items-end justify-end ${
                    gspDelta.delta > 0 ? `bottom-0 flex-row-reverse ml-2` : `mr-2`
                  }`}
                >
                  <div
                    className={`${isSelectedGsp ? `h-1.5` : `h-1`} bg-surface-panel`}
                    style={{ width: `2px` }}
                  ></div>
                  <div
                    className={`${isSelectedGsp ? `h-1.5` : `h-1`} ${progressLineColor}`}
                    style={{ width: `${deltaNormalizedPercentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}

        {!hasRows && (
          <div className={`${negative ? "pr-1.5" : "pl-1.5"}`}>
            <div
              className={`flex flex-col flex-1 items-center justify-center border-dashed border border-content rounded-md p-6`}
            >
              <span className="text-sm text-center text-content">
                No {negative ? "negative" : "positive"} GSP deltas <br />
                for current filters
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
const DeltaChart: FC<DeltaChartProps> = ({ className }) => {
  const [selectedMapRegionIds, setSelectedMapRegionIds] = useCountryState("selectedMapRegionIds");
  const [visibleLines] = useGlobalState("visibleLines");
  const [selectedBuckets] = useGlobalState("selectedBuckets");
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [timeNow] = useGlobalState("timeNow");
  const [showNHourView] = useGlobalState("showNHourView");
  const [nHourForecast] = useGlobalState("nHourForecast");
  const { stopTime, resetTime } = useStopAndResetTime();
  const focusedCountry = useFocusedCountry();
  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());
  // The cursor resolved onto the focused country's own grid. This used to round via
  // `convertToLocaleDateString` + a `Date` whose `getMinutes()` reads the *viewer's* zone —
  // a no-op for whole-hour offsets and the reason it never misbehaved, but it rounded on the
  // wrong clock and at a hardcoded half hour. `slotForInstant` is the same answer stated once.
  const selectedTimeSlot = slotForInstant(selectedTime, focusedCountry);

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
    timeTrigger: selectedTime,
    delta: true
  });

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
  useEffect(() => {
    if (!chartData?.length) return;
    const first = (chartData[0] as any).formattedDate;
    const last = (chartData[chartData.length - 1] as any).formattedDate;
    if (!selectedTime || selectedTime < first || selectedTime > last) {
      setSelectedISOTime(latestSlotWithDelta ?? getCursorNow());
    }
  }, [chartData, selectedTime, setSelectedISOTime, latestSlotWithDelta]);

  /**
   * Land the cursor somewhere the delta view can actually show something — once.
   *
   * Entering a comparison used to leave the cursor wherever it was, which is usually "now",
   * where by definition nothing has a delta yet: every region drew transparent and every
   * tooltip said "no delta yet", so the view opened blank and read as broken. This moves the
   * cursor to the most recent slot that has one, but only on the first render where the data
   * is known — afterwards the cursor is the user's, and scrubbing deliberately into the
   * forecast must not be yanked back.
   */
  const landedRef = useRef(false);
  useEffect(() => {
    if (landedRef.current || !chartData?.length) return;
    landedRef.current = true;
    const current = chartData.find((d: any) => d.formattedDate === selectedTime);
    if (current && (current as any).DELTA === undefined && latestSlotWithDelta) {
      setSelectedISOTime(latestSlotWithDelta);
    }
  }, [chartData, selectedTime, setSelectedISOTime, latestSlotWithDelta]);

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
  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(snapToCadence(`${time}:00.000Z`, getCursorCadenceMinutes()));
  };

  let selectedRegions: string[] = [];
  if (selectedMapRegionIds && selectedMapRegionIds.length > 0) {
    selectedRegions = selectedMapRegionIds.map((id) => String(id));
  }

  return (
    <>
      <div className={`flex flex-col flex-1 ${className || ""}`}>
        <div className="flex flex-1 flex-col relative">
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
          <div className={"flex-1 relative"}>
            <DataLoadingChartStatus<NationalEndpointStates> loadingState={loadingState} />
            <RemixLine
              resetTime={resetTime}
              timeNow={liveSlot}
              timeOfInterest={selectedTime}
              setTimeOfInterest={setSelectedTime}
              data={chartData}
              yMax={yMax}
              yTicks={getTicks(yMax, Y_MAX_TICKS)}
              visibleLines={visibleLines}
              deltaView={true}
            />
          </div>
        </div>
        {selectedMapRegionIds && selectedMapRegionIds.length > 0 && (
          <div className="flex-1 flex flex-col relative dash:h-auto">
            <GspPvRemixChart
              close={() => {
                setSelectedMapRegionIds([]);
              }}
              setTimeOfInterest={setSelectedTime}
              selectedTime={selectedTime}
              selectedRegions={selectedRegions}
              timeNow={liveSlot}
              resetTime={resetTime}
              visibleLines={visibleLines}
              deltaView={true}
            ></GspPvRemixChart>
          </div>
        )}
        <div
          className={`flex flex-col flex-grow-0 flex-shrink${
            hasGspPvInitialForSelectedTime ? " overflow-y-scroll" : ""
          } ${selectedMapRegionIds?.length ? "h-[30%]" : "h-[40%]"}`}
        >
          <DeltaBuckets bucketSelection={selectedBuckets} gspDeltas={gspDeltas} />
          {!hasGspPvInitialForSelectedTime && (
            <div className="flex flex-1 m-3 p-4 font-thin tracking-wide border border-dashed border-content-secondary rounded-md justify-center items-center text-center text-content-secondary">
              [ Delta values not available until PV Live output available ]
            </div>
          )}
          {hasGspPvInitialForSelectedTime && gspDeltas && (
            <div className="flex pt-2 mx-3 max-h-96">
              <GspDeltaColumn gspDeltas={gspDeltas} negative />
              <GspDeltaColumn gspDeltas={gspDeltas} />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DeltaChart;
