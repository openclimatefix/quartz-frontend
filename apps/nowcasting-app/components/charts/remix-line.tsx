import React, { FC, useEffect, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Rectangle,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  convertToLocaleDateString,
  dateToLondonDateTimeString,
  formatISODateStringHumanNumbersOnly,
  getRoundedTickBoundary,
  prettyPrintChartAxisLabelDate,
  prettyPrintDayLabelWithDate
} from "../helpers/utils";
import { theme } from "../../tailwind.config";
import useGlobalState, { getNext30MinSlot } from "../helpers/globalState";
import { DELTA_BUCKET, VIEWS } from "../../constant";
import { getZoomYMax } from "../helpers/chartUtils";
import { ZoomOutIcon } from "@heroicons/react/solid";

const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;
const orange = theme.extend.colors["ocf-orange"].DEFAULT;
const ecmwfOnly = theme.extend.colors["ocf-teal"]["500"];
const metOfficeOnly = theme.extend.colors["metOffice"].DEFAULT;
const pvnetDayAhead = theme.extend.colors["ocf-delta"]["100"];
const pvnetIntraday = theme.extend.colors["ocf-teal"]["600"];
const deltaNeg = theme.extend.colors["ocf-delta"]["100"];
const deltaPos = theme.extend.colors["ocf-delta"]["900"];
const deltaMaxTicks = [2000, 2500, 3000, 3500, 4000, 4500, 5000];
export type ChartData = {
  GENERATION_UPDATED?: number;
  GENERATION?: number;
  FORECAST?: number;
  INTRADAY_ECMWF_ONLY?: number;
  PAST_INTRADAY_ECMWF_ONLY?: number;
  MET_OFFICE_ONLY?: number;
  PAST_MET_OFFICE_ONLY?: number;
  PAST_FORECAST?: number;
  N_HOUR_FORECAST?: number;
  N_HOUR_PAST_FORECAST?: number;
  DELTA?: number;
  DELTA_BUCKET?: DELTA_BUCKET;
  PROBABILISTIC_UPPER_BOUND?: number;
  PROBABILISTIC_LOWER_BOUND?: number;
  PROBABILISTIC_RANGE?: Array<number>;
  formattedDate: string; // "2022-05-16T15:00",
  SETTLEMENT_PERIOD?: number | undefined;
};

const toolTiplabels: Record<string, string> = {
  GENERATION: "PV Live estimate",
  GENERATION_UPDATED: "PV Actual",
  PROBABILISTIC_UPPER_BOUND: "OCF 90%",
  FORECAST: "OCF Latest",
  PAST_FORECAST: "OCF Latest",
  INTRADAY_ECMWF_ONLY: "OCF ECMWF-only",
  PAST_INTRADAY_ECMWF_ONLY: "OCF ECMWF-only",
  MET_OFFICE_ONLY: "OCF Met Office-only",
  PAST_MET_OFFICE_ONLY: "OCF Met Office-only",
  PROBABILISTIC_LOWER_BOUND: "OCF 10%",
  N_HOUR_FORECAST: `OCF N-hour`,
  N_HOUR_PAST_FORECAST: "OCF N-hour",
  DELTA: "Delta"
};

const toolTipColors: Record<string, string> = {
  GENERATION_UPDATED: "white",
  GENERATION: "white",
  FORECAST: yellow,
  PAST_FORECAST: yellow,
  INTRADAY_ECMWF_ONLY: ecmwfOnly,
  PAST_INTRADAY_ECMWF_ONLY: ecmwfOnly,
  MET_OFFICE_ONLY: metOfficeOnly,
  PAST_MET_OFFICE_ONLY: metOfficeOnly,
  N_HOUR_FORECAST: orange,
  N_HOUR_PAST_FORECAST: orange,
  DELTA: deltaPos,
  PROBABILISTIC_UPPER_BOUND: yellow,
  PROBABILISTIC_LOWER_BOUND: yellow
};
type RemixLineProps = {
  timeOfInterest: string;
  data: ChartData[];
  setTimeOfInterest?: (t: string) => void;
  yMax: number | string;
  timeNow: string;
  resetTime?: () => void;
  visibleLines: string[];
  zoomEnabled?: boolean;
  deltaView?: boolean;
  deltaYMaxOverride?: number;
  yTicks?: number[];
};
const CustomizedLabel: FC<any> = ({
  value,
  offset,
  viewBox: { x },
  className,
  solidLine,
  onClick
}) => {
  const yy = -9;
  return (
    <g>
      <line
        stroke="white"
        strokeWidth={solidLine ? "2" : "1"}
        strokeDasharray={solidLine ? "" : "3 3"}
        fill="none"
        fillOpacity="1"
        x1={x}
        y1={yy + 30}
        x2={x}
        y2={yy}
      ></line>
      <g className={`fill-white ${className || ""}`} onClick={onClick}>
        <rect x={x - 24} y={yy} width="48" height="21" offset={offset} fill={"inherit"}></rect>
        <text x={x} y={yy + 15} fill="black" className="text-xs" id="time-now" textAnchor="middle">
          {value}
        </text>
      </g>
    </g>
  );
};

const DateLabel: FC<any> = ({ value, offset, viewBox: { x }, className, solidLine, onClick }) => {
  const yy = -9;
  return (
    <g>
      <g className={`fill-white ${className || ""}`} onClick={onClick}>
        <rect x={x - 24} y={yy} width="48" height="21" offset={offset} fill={"inherit"}></rect>
        <text x={x} y={yy + 15} fill="black" className="text-xs" id="time-now" textAnchor="middle">
          {value}
        </text>
      </g>
    </g>
  );
};

const RemixLine: React.FC<RemixLineProps> = ({
  timeOfInterest,
  data,
  setTimeOfInterest,
  yMax,
  timeNow,
  resetTime,
  visibleLines,
  zoomEnabled = true,
  deltaView = false,
  deltaYMaxOverride,
  yTicks
}) => {
  // Set the y max. If national then set to 12000, for gsp plot use 'auto'
  const preppedData = data.sort((a, b) => a.formattedDate.localeCompare(b.formattedDate));
  const [showNHourView] = useGlobalState("showNHourView");
  const [view] = useGlobalState("view");
  const [largeScreenMode] = useGlobalState("dashboardMode");
  const currentTime = getNext30MinSlot(new Date()).toISOString().slice(0, 16);
  const localeTimeOfInterest = convertToLocaleDateString(timeOfInterest + "Z").slice(0, 16);
  const defaultZoom = { x1: "", x2: "" };
  const [filteredPreppedData, setFilteredPreppedData] = useState(preppedData);
  const [globalZoomArea, setGlobalZoomArea] = useGlobalState("globalZoomArea");
  const [globalIsZooming, setGlobalIsZooming] = useGlobalState("globalChartIsZooming");
  const [globalIsZoomed, setGlobalIsZoomed] = useGlobalState("globalChartIsZoomed");
  const [temporaryZoomArea, setTemporaryZoomArea] = useState(defaultZoom);
  const [nHourForecast] = useGlobalState("nHourForecast");
  const [selectedMapRegionIds] = useGlobalState("selectedMapRegionIds");

  function prettyPrintYNumberWithCommas(
    x: string | number,
    showDecimals: number = 2,
    divisionFactor: number = 1
  ) {
    const xNumber = Number(x) / divisionFactor;
    const isSmallNumber = xNumber !== 0 && (xNumber < 0 ? xNumber > -10 : xNumber < 10);
    const roundedNumber =
      showDecimals > 0 && isSmallNumber ? xNumber.toFixed(showDecimals) : Math.round(xNumber);
    return roundedNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  const CustomBar = (props: { DELTA: number }) => {
    const { DELTA } = props;
    let fill = DELTA > 0 ? deltaPos : deltaNeg;
    return <Rectangle {...props} fill={fill} />;
  };

  const deltaMax = data
    .map((d) => d.DELTA)
    .filter((n) => typeof n === "number")
    .sort((a, b) => Number(b) - Number(a))[0];
  const deltaMin = data
    .map((d) => d.DELTA)
    .filter((n) => typeof n === "number")
    .sort((a, b) => Number(a) - Number(b))[0];

  // Take the max absolute value of the delta min and max as the y-axis max
  const deltaYMax =
    deltaYMaxOverride ||
    getRoundedTickBoundary(Math.max(Number(deltaMax), 0 - Number(deltaMin)) || 0, deltaMaxTicks);

  const roundTickMax = deltaYMax % 1000 === 0;
  const isGSP = !!deltaYMaxOverride && deltaYMaxOverride < 1000;
  const now = new Date();
  const offsets = [-24, -18, -12, -6, 0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60];
  const ticks = offsets.map((o) => {
    return new Date(now).setHours(o, 0, 0, 0);
  });
  const timeOffsets = [-10, 13, 37, 61];
  const timeTicks = timeOffsets.map((o) => {
    return new Date(now).setHours(o, 0, 0, 0);
  });

  //get Y axis boundary

  const yMaxZoom_Levels = [
    10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 6000,
    7000, 8000, 9000, 10000, 11000, 12000
  ];

  let zoomYMax = getZoomYMax(filteredPreppedData);
  zoomYMax = getRoundedTickBoundary(zoomYMax || 0, yMaxZoom_Levels);

  //reset zoom state
  function handleZoomOut() {
    setGlobalIsZoomed(false);
    setFilteredPreppedData(preppedData);
  }

  const updateFilteredData = () => {
    const { x1, x2 } = globalZoomArea;

    if (!x1 || !x2) return;

    const dataInAreaRange = preppedData.filter(
      (d) => d?.formattedDate >= x1 && d?.formattedDate <= x2
    );
    setFilteredPreppedData(dataInAreaRange);
  };

  useEffect(() => {
    if (!zoomEnabled) return;

    if (!globalIsZooming) {
      updateFilteredData();
    }
  }, [globalZoomArea, globalIsZooming, preppedData, zoomEnabled]);

  useEffect(() => {
    updateFilteredData();
  }, [nHourForecast]);

  const DeltaTick: FC<{ x?: number; y?: number; stroke?: string; payload?: any }> = ({
    x,
    y,
    stroke,
    payload
  }) => {
    return (
      <g transform={`translate(${x},${y})`}>
        <text className="fill-white text-xs text-right" x={0} y={0} dy={3} textAnchor={"start"}>
          {`${payload.value > 0 ? "+" : ""}${prettyPrintYNumberWithCommas(payload.value)}`}
        </text>
      </g>
    );
  };

  let rightChartMargin = 16;
  let deltaLabelOffset = roundTickMax ? -20 : -10;
  if (deltaView) {
    if (selectedMapRegionIds?.length) {
      rightChartMargin = 15;
      if (roundTickMax) {
        deltaLabelOffset = 0;
      } else {
        deltaLabelOffset = -5;
      }
    } else {
      rightChartMargin = 0;
    }
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {zoomEnabled && globalIsZoomed && (
        <div className={`absolute top-5 z-10 ${deltaView ? `right-16 mr-3` : `right-4`}`}>
          <button
            type="button"
            onClick={handleZoomOut}
            style={{ position: "relative", top: "0", left: "20" }}
            className="flex font-bold items-center p-1.5 border-ocf-gray-800 text-white bg-ocf-gray-800 hover:bg-ocf-gray-700 focus:z-10 focus:text-white h-auto"
          >
            <ZoomOutIcon className="w-8 h-8" />
          </button>
        </div>
      )}
      <div className="absolute inset-0">
        <ResponsiveContainer debounce={100}>
          <ComposedChart
            className="select-none"
            width={500}
            height={400}
            data={zoomEnabled && globalIsZoomed ? filteredPreppedData : preppedData}
            margin={{
              top: 20,
              right: rightChartMargin,
              bottom: -10,
              left: 16
            }}
            onClick={(e?: { activeLabel?: string }) => {
              if (globalIsZooming) return;

              if (setTimeOfInterest && e?.activeLabel) {
                view === VIEWS.SOLAR_SITES
                  ? setTimeOfInterest(
                      new Date(Number(e.activeLabel))?.toISOString() || new Date().toISOString()
                    )
                  : setTimeOfInterest(e.activeLabel);
              }
            }}
            onMouseDown={(e?: { activeLabel?: string }) => {
              if (!zoomEnabled) return;
              setTemporaryZoomArea(globalZoomArea);
              setGlobalIsZooming(true);
              let xValue = e?.activeLabel;
              if (typeof xValue === "string" && xValue.length > 0) {
                setGlobalZoomArea({ x1: xValue, x2: xValue });
              }
            }}
            onMouseMove={(e?: { activeLabel?: string }) => {
              if (!zoomEnabled) return;

              if (globalIsZooming) {
                let xValue = e?.activeLabel;
                if (!xValue) return;
                setGlobalZoomArea((zoom) => ({ ...zoom, x2: xValue || "" }));
              }
            }}
            onMouseUp={(e?: { activeLabel?: string }) => {
              if (!zoomEnabled) return;

              if (globalIsZooming) {
                if (
                  globalZoomArea.x1 === globalZoomArea.x2 &&
                  e?.activeLabel &&
                  setTimeOfInterest
                ) {
                  setGlobalZoomArea(temporaryZoomArea);
                  setTimeOfInterest(e?.activeLabel);
                } else if (globalZoomArea?.x1?.length && globalZoomArea?.x2?.length) {
                  let { x1 } = globalZoomArea;
                  let x2 = e?.activeLabel || "";
                  if (x1 > x2) {
                    [x1, x2] = [x2, x1];
                  }
                  setGlobalZoomArea({ x1, x2 });
                  setGlobalIsZoomed(true);
                }
                setGlobalIsZooming(false);
              }
            }}
          >
            <CartesianGrid verticalFill={["#545454", "#6C6C6C"]} fillOpacity={0.5} />
            <XAxis
              dataKey="formattedDate"
              xAxisId={"x-axis"}
              tickFormatter={prettyPrintChartAxisLabelDate}
              scale={view === VIEWS.SOLAR_SITES ? "time" : "auto"}
              tick={{ fill: "white", style: { fontSize: "12px" } }}
              tickLine={true}
              type={view === VIEWS.SOLAR_SITES ? "number" : "category"}
              ticks={view === VIEWS.SOLAR_SITES ? ticks : undefined}
              domain={view === VIEWS.SOLAR_SITES ? [ticks[0], ticks[ticks.length - 1]] : undefined}
              interval={view === VIEWS.SOLAR_SITES ? undefined : 11}
            />
            <XAxis
              className="select-none"
              dataKey="formattedDate"
              xAxisId={"x-axis-2"}
              tickFormatter={prettyPrintChartAxisLabelDate}
              scale={view === VIEWS.SOLAR_SITES ? "time" : "auto"}
              tick={{ fill: "white", style: { fontSize: "12px" } }}
              tickLine={true}
              type={view === VIEWS.SOLAR_SITES ? "number" : "category"}
              ticks={view === VIEWS.SOLAR_SITES ? ticks : undefined}
              domain={view === VIEWS.SOLAR_SITES ? [ticks[0], ticks[ticks.length - 1]] : undefined}
              interval={view === VIEWS.SOLAR_SITES ? undefined : 11}
              orientation="top"
              padding="no-gap"
              hide={true}
            />
            <XAxis
              dataKey="formattedDate"
              xAxisId={"x-axis-3"}
              tickFormatter={prettyPrintDayLabelWithDate}
              scale={view === VIEWS.SOLAR_SITES ? "time" : "auto"}
              tick={{ fill: "white", style: { fontSize: "12px" } }}
              tickLine={false}
              type={view === VIEWS.SOLAR_SITES ? "number" : "category"}
              ticks={view === VIEWS.SOLAR_SITES ? timeTicks : undefined}
              domain={
                view === VIEWS.SOLAR_SITES
                  ? [timeTicks[0], timeTicks[timeTicks.length - 1]]
                  : undefined
              }
              interval={view === VIEWS.SOLAR_SITES ? undefined : 47}
              orientation="bottom"
              axisLine={false}
              tickMargin={-12}
              hide={false}
            />

            <YAxis
              tickFormatter={
                view === VIEWS.SOLAR_SITES
                  ? undefined
                  : (val, i) => prettyPrintYNumberWithCommas(val)
              }
              yAxisId={"y-axis"}
              tick={{ fill: "white", style: { fontSize: "12px" } }}
              tickLine={false}
              ticks={yTicks}
              domain={
                globalIsZoomed && view !== VIEWS.SOLAR_SITES
                  ? [0, Number(zoomYMax * 1.1)]
                  : [0, yMax]
              }
              label={{
                value: view === VIEWS.SOLAR_SITES ? "Generation (KW)" : "Generation (MW)",
                angle: 270,
                position: "outsideLeft",
                fill: "white",
                style: { fontSize: "12px" },
                offset: 0,
                dx: -26,
                dy: 0
              }}
            />

            {deltaView && (
              <>
                <YAxis
                  tickFormatter={(val, i) =>
                    prettyPrintYNumberWithCommas(val, roundTickMax ? 0 : 2)
                  }
                  tick={<DeltaTick />}
                  ticks={[deltaYMax, deltaYMax / 2, 0, -deltaYMax / 2, -deltaYMax]}
                  tickCount={5}
                  tickLine={false}
                  yAxisId={"delta"}
                  scale={"auto"}
                  orientation="right"
                  label={{
                    value: `Delta (MW)`,
                    angle: 90,
                    position: "insideRight",
                    fill: "white",
                    style: { fontSize: "11px" },
                    offset: 0,
                    dx: deltaLabelOffset,
                    dy: 29
                  }}
                  domain={[-deltaYMax, deltaYMax]}
                  padding={{ top: 0, bottom: 0 }}
                />
                <ReferenceLine
                  yAxisId={"delta"}
                  xAxisId={"x-axis"}
                  y={0}
                  stroke="white"
                  strokeWidth={0.1}
                />
              </>
            )}

            <ReferenceLine
              x={view === VIEWS.SOLAR_SITES ? new Date(currentTime).getTime() : currentTime}
              stroke="white"
              strokeWidth={currentTime === timeOfInterest ? 2 : 1}
              yAxisId={"y-axis"}
              xAxisId={"x-axis"}
              scale={view === VIEWS.SOLAR_SITES ? "time" : "auto"}
              strokeDasharray="3 3"
              className={currentTime !== timeOfInterest ? "" : "hidden"}
              label={
                <CustomizedLabel
                  className={`fill-amber-400 cursor-pointer text-sm`}
                  value={"LIVE"}
                  onClick={resetTime}
                />
              }
            />

            <ReferenceLine
              x={
                view === VIEWS.SOLAR_SITES
                  ? new Date(localeTimeOfInterest).getTime()
                  : timeOfInterest
              }
              stroke="white"
              strokeWidth={2}
              yAxisId={"y-axis"}
              xAxisId={"x-axis"}
              scale={view === VIEWS.SOLAR_SITES ? "time" : "auto"}
              label={
                <CustomizedLabel
                  className={`text-sm ${currentTime === timeOfInterest ? "fill-amber-400" : ""}`}
                  value={prettyPrintChartAxisLabelDate(timeOfInterest)}
                  solidLine={true}
                ></CustomizedLabel>
              }
            />

            {deltaView && (
              <Bar
                type="monotone"
                dataKey="DELTA"
                yAxisId={"delta"}
                xAxisId={"x-axis"}
                // @ts-ignore
                shape={<CustomBar />}
                barSize={3}
              />
            )}
            {showNHourView && (
              <>
                <Line
                  type="monotone"
                  dataKey="N_HOUR_FORECAST"
                  dot={false}
                  yAxisId={"y-axis"}
                  xAxisId={"x-axis"}
                  strokeDasharray="5 5"
                  strokeDashoffset={3}
                  stroke={orange} // blue
                  strokeWidth={largeScreenMode ? 4 : 2}
                  hide={!visibleLines.includes("N_HOUR_FORECAST")}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="N_HOUR_PAST_FORECAST"
                  dot={false}
                  yAxisId={"y-axis"}
                  xAxisId={"x-axis"}
                  // strokeDasharray="10 10"
                  stroke={orange} // blue
                  strokeWidth={largeScreenMode ? 4 : 2}
                  hide={!visibleLines.includes("N_HOUR_FORECAST")}
                  isAnimationActive={false}
                />
              </>
            )}

            <Area
              type="monotone"
              dataKey="PROBABILISTIC_RANGE"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              stroke={yellow}
              fill={yellow}
              fillOpacity={0.4}
              strokeWidth={0}
              hide={!visibleLines.includes("FORECAST")}
              isAnimationActive={false}
            />

            <Line
              type="monotone"
              dataKey="PAST_INTRADAY_ECMWF_ONLY"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              stroke={ecmwfOnly} //yellow
              fill="transparent"
              fillOpacity={100}
              strokeWidth={largeScreenMode ? 4 : 2}
              hide={!visibleLines.includes("INTRADAY_ECMWF_ONLY")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="INTRADAY_ECMWF_ONLY"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              strokeDasharray="5 5"
              stroke={ecmwfOnly} //yellow
              fill="transparent"
              fillOpacity={100}
              strokeWidth={largeScreenMode ? 4 : 1.5}
              hide={!visibleLines.includes("INTRADAY_ECMWF_ONLY")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="PAST_MET_OFFICE_ONLY"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              stroke={metOfficeOnly}
              fill="transparent"
              fillOpacity={100}
              strokeWidth={largeScreenMode ? 4 : 1.5}
              hide={!visibleLines.includes("MET_OFFICE_ONLY")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="MET_OFFICE_ONLY"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              strokeDasharray="5 5"
              stroke={metOfficeOnly}
              fill="transparent"
              fillOpacity={100}
              strokeWidth={largeScreenMode ? 4 : 1.5}
              hide={!visibleLines.includes("MET_OFFICE_ONLY")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="GENERATION"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              stroke="black"
              strokeWidth={largeScreenMode ? 4 : 2}
              strokeDasharray="5 5"
              hide={!visibleLines.includes("GENERATION")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="GENERATION_UPDATED"
              strokeWidth={largeScreenMode ? 4 : 2}
              stroke="black"
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              dot={false}
              hide={!visibleLines.includes("GENERATION_UPDATED")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="PAST_FORECAST"
              dot={false}
              connectNulls={true}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              stroke={yellow} //yellow
              fill="transparent"
              fillOpacity={100}
              strokeWidth={largeScreenMode ? 4 : 2}
              hide={!visibleLines.includes("FORECAST")}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="FORECAST"
              dot={false}
              xAxisId={"x-axis"}
              yAxisId={"y-axis"}
              strokeDasharray="5 5"
              stroke={yellow} //yellow
              fill="transparent"
              fillOpacity={100}
              strokeWidth={largeScreenMode ? 4 : 2}
              hide={!visibleLines.includes("FORECAST")}
              isAnimationActive={false}
            />
            {zoomEnabled && globalIsZooming && (
              <ReferenceArea
                x1={globalZoomArea?.x1}
                x2={globalZoomArea?.x2}
                fill="#FFD053"
                fillOpacity={0.3}
                xAxisId={"x-axis"}
                yAxisId={"y-axis"}
              />
            )}
            <Tooltip
              content={({ payload, label }) => {
                const data = payload && payload[0]?.payload;
                if (!data || (data["GENERATION"] === 0 && data["FORECAST"] === 0))
                  return <div></div>;

                let formattedDate = data?.formattedDate + ":00+00:00";
                if (view === VIEWS.SOLAR_SITES) {
                  const date = new Date(Number(data?.formattedDate));
                  formattedDate = dateToLondonDateTimeString(date);
                }

                return (
                  <div className="px-3 py-2 bg-mapbox-black bg-opacity-80 shadow">
                    <ul className="">
                      <li className={`flex justify-between pb-2 text-xs text-white font-sans`}>
                        <div className="pr-3">
                          {formatISODateStringHumanNumbersOnly(formattedDate)}
                          {" • "}
                          <span className="w-6">{data.SETTLEMENT_PERIOD}</span>
                        </div>
                        <div>{view === VIEWS.SOLAR_SITES ? "KW" : "MW"}</div>
                      </li>
                      {Object.entries(toolTiplabels)
                        .filter(
                          ([key]) =>
                            data[key] !== undefined &&
                            (visibleLines.includes(key.replace("PAST_", "")) ||
                              key.includes("PROBABILISTIC"))
                        )
                        .sort((a, b) => {
                          if (typeof data[b[0]] !== "number") return 1;
                          if (typeof data[a[0]] !== "number") return -1;
                          if (data[b[0]] === data[a[0]]) return 0;
                          return data[b[0]] - data[a[0]];
                        })
                        .map(([key, name]) => {
                          const value = data[key];
                          if (key === "DELTA" && !deltaView) return null;
                          if (typeof value !== "number") return null;
                          if (deltaView && key === "GENERATION" && data["GENERATION_UPDATED"] >= 0)
                            return null;
                          if (
                            key.includes("N_HOUR") &&
                            (!showNHourView || !visibleLines.some((key) => key.includes("N_HOUR")))
                          )
                            return null;
                          if (key.includes("PROBABILISTIC") && Math.round(value * 100) < 0)
                            return null;
                          let textClass = "font-normal text-xs";
                          if (["FORECAST", "PAST_FORECAST"].includes(key))
                            textClass = "font-semibold";
                          if (
                            ["PROBABILISTIC_UPPER_BOUND", "PROBABILISTIC_LOWER_BOUND"].includes(key)
                          )
                            textClass = "text-2xs";
                          const pvLiveTextClass =
                            data["GENERATION_UPDATED"] >= 0 &&
                            data["GENERATION"] >= 0 &&
                            key === "GENERATION"
                              ? "text-xs"
                              : "";
                          const sign = ["DELTA"].includes(key)
                            ? Number(value) > 0
                              ? "+"
                              : ""
                            : "";
                          const color = ["DELTA"].includes(key)
                            ? Number(value) > 0
                              ? deltaPos
                              : deltaNeg
                            : toolTipColors[key];
                          const computedValue =
                            key === "DELTA" &&
                            !showNHourView &&
                            `${data["formattedDate"]}:00.000Z` >= currentTime
                              ? "-"
                              : prettyPrintYNumberWithCommas(String(value), 1);
                          let title = name;
                          if (key.includes("N_HOUR")) {
                            title = title.replace("N-hour", `${nHourForecast}-hour`);
                          }

                          return (
                            <li className={`font-sans`} key={`item-${key}`} style={{ color }}>
                              <div
                                className={`flex justify-between ${textClass} ${pvLiveTextClass}`}
                              >
                                <div>{title}:</div>
                                <div className={`font-sans ml-4`}>
                                  {(showNHourView || key !== "DELTA") && sign}
                                  {computedValue}{" "}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RemixLine;
