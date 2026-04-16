import React, { useMemo } from "react";
import RemixLine, { ChartData } from "./remix-line";
import { CombinedData } from "../types";
import useGlobalState, { get30MinNow, getNext30MinSlot } from "../helpers/globalState";
import {
  formatISODateString,
  KWtoGW,
  calculateChartYMax,
  convertISODateStringToLondonTime,
  formatISODateAsLondonTime
} from "../helpers/utils";
import { getTicks } from "../helpers/chartUtils";
import { Y_MAX_TICKS } from "../../constant";
import { ForecastHeadlineFigure } from "./forecast-header/ui";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import { CloseButtonIcon } from "../icons/icons";
import netherlandsSitesData from "../../data/netherlands_sites.json";

// Sites API returns datetimes as epoch seconds, epoch ms, or ISO strings depending on endpoint.
const toISO = (dt: string): string => {
  if (/^\d+$/.test(dt)) {
    const ms = dt.length <= 11 ? Number(dt) * 1000 : Number(dt);
    return new Date(ms).toISOString();
  }
  return dt;
};

const prettyProvinceName = (clientSiteName: string) =>
  clientSiteName
    .replace(/^nl_region_\d+_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const NLRegionalChart: React.FC<{
  combinedData: CombinedData;
  siteUuid: string;
  onClose: () => void;
  className?: string;
}> = ({ combinedData, siteUuid, onClose, className }) => {
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [timeNow] = useGlobalState("timeNow");
  const [visibleLines] = useGlobalState("visibleLines");
  const { stopTime, resetTime } = useStopAndResetTime();

  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());
  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(time + ":00.000Z");
  };

  const site = useMemo(
    () => netherlandsSitesData.site_list.find((s) => s.site_uuid === siteUuid),
    [siteUuid]
  );
  const provinceName = site ? prettyProvinceName(site.client_site_name) : siteUuid;
  const siteCapacityGW = site ? site.capacity_kw / 1_000_000 : 1;

  const forecastData = useMemo(
    () => combinedData?.nlRegionalForecastData?.find((d) => d.site_uuid === siteUuid),
    [combinedData?.nlRegionalForecastData, siteUuid]
  );
  const actualData = useMemo(
    () => combinedData?.nlRegionalActualData?.find((d) => d.site_uuid === siteUuid),
    [combinedData?.nlRegionalActualData, siteUuid]
  );

  const chartData: ChartData[] = useMemo(() => {
    const timeNowFormatted = formatISODateString(get30MinNow());
    const chartMap: Record<string, ChartData> = {};
    const is30MinSlot = (iso: string) => {
      const mins = new Date(iso).getUTCMinutes();
      return mins === 0 || mins === 30;
    };

    actualData?.pv_actual_values.forEach((av) => {
      const iso = toISO(av.datetime_utc);
      if (!is30MinSlot(iso)) return;
      chartMap[iso] = {
        ...chartMap[iso],
        formattedDate: formatISODateString(iso) || "",
        GENERATION_UPDATED: av.actual_generation_kw / 1000
      };
    });

    forecastData?.forecast_values.forEach((fv) => {
      const iso = toISO(fv.target_datetime_utc);
      if (!is30MinSlot(iso)) return;
      const isAfterNow = iso.slice(0, 16) >= (timeNowFormatted || "");
      chartMap[iso] = {
        ...chartMap[iso],
        formattedDate: formatISODateString(iso) || "",
        [isAfterNow ? "FORECAST" : "PAST_FORECAST"]: fv.expected_generation_kw / 1000
      };
    });

    return Object.values(chartMap).sort((a, b) => a.formattedDate.localeCompare(b.formattedDate));
  }, [forecastData, actualData]);

  const timeNowFormatted = formatISODateString(get30MinNow());
  const yMax = useMemo(
    () => calculateChartYMax(chartData, siteCapacityGW),
    [chartData, siteCapacityGW]
  );

  const {
    currentActualGW,
    currentActualTime,
    currentForecastGW,
    nextForecastGW,
    nextForecastTime
  } = useMemo(() => {
    const sorted = [...(actualData?.pv_actual_values || [])].sort(
      (a, b) =>
        new Date(toISO(b.datetime_utc)).getTime() - new Date(toISO(a.datetime_utc)).getTime()
    );
    const latestActual = sorted[0];
    const latestISO = latestActual ? toISO(latestActual.datetime_utc) : null;
    const latestFormatted = latestISO ? formatISODateString(latestISO) : timeNowFormatted;

    const nextSlot = latestISO ? getNext30MinSlot(new Date(latestISO)) : null;
    const nextSlotFormatted = nextSlot ? formatISODateString(nextSlot.toISOString()) : null;

    const currentFv = forecastData?.forecast_values.find(
      (f) => toISO(f.target_datetime_utc).slice(0, 16) === latestFormatted
    );
    const nextFv = nextSlotFormatted
      ? forecastData?.forecast_values.find(
          (f) => toISO(f.target_datetime_utc).slice(0, 16) === nextSlotFormatted
        )
      : undefined;

    return {
      currentActualGW: latestActual ? KWtoGW(latestActual.actual_generation_kw) : "–",
      currentActualTime: latestISO
        ? convertISODateStringToLondonTime(latestISO, "Europe/Amsterdam") || ""
        : "",
      currentForecastGW: currentFv ? KWtoGW(currentFv.expected_generation_kw) : "–",
      nextForecastGW: nextFv ? KWtoGW(nextFv.expected_generation_kw) : "–",
      nextForecastTime: nextSlot ? formatISODateAsLondonTime(nextSlot, "Europe/Amsterdam") : ""
    };
  }, [forecastData, actualData, timeNowFormatted]);

  return (
    <div className={`flex flex-col flex-1 ${className || ""}`}>
      <div
        data-test="nl-regional-chart-header"
        className="flex flex-initial content-between bg-ocf-gray-800 h-auto mb-4"
      >
        <div className="dash:xl:text-2xl dash:2xl:text-3xl dash:3xl:text-4xl text-white lg:text-xl md:text-lg text-lg font-black m-auto ml-5 flex justify-evenly">
          {provinceName}
        </div>
        <div className="flex justify-between flex-2 my-2 dash:3xl:my-3 px-2 lg:px-4 3xl:px-6">
          <div className="pr-4 lg:pr-4 3xl:pr-6">
            <ForecastHeadlineFigure
              gsp={true}
              tip="PV Live / OCF Forecast"
              time={currentActualTime}
              color="ocf-yellow"
            >
              <span className="text-black">{currentActualGW}</span>
              <span className="text-ocf-gray-300 mx-1"> / </span>
              {currentForecastGW}
            </ForecastHeadlineFigure>
          </div>
          <div>
            <ForecastHeadlineFigure
              gsp={true}
              tip="Next OCF Forecast"
              time={nextForecastTime}
              color="ocf-yellow"
            >
              {nextForecastGW}
            </ForecastHeadlineFigure>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="font-bold items-center p-2 text-2xl border-ocf-gray-800 text-white bg-ocf-gray-800 hover:bg-ocf-gray-700 focus:z-10 focus:text-white h-auto"
        >
          <CloseButtonIcon />
        </button>
      </div>
      <div className="flex-1 relative">
        <RemixLine
          timeNow={formatISODateString(timeNow)}
          timeOfInterest={selectedTime || ""}
          setTimeOfInterest={setSelectedTime}
          data={chartData}
          yMax={yMax}
          yTicks={getTicks(yMax, Y_MAX_TICKS)}
          visibleLines={visibleLines}
          resetTime={resetTime}
          timezone="Europe/Amsterdam"
          lineLabels={{ GENERATION_UPDATED: "NED NL", GENERATION: "NED NL" }}
        />
      </div>
    </div>
  );
};

export default NLRegionalChart;
