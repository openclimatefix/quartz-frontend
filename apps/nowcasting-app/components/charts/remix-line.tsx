import React, { FC } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  convertISODateStringToLondonTime,
  convertToLocaleDateString,
  dateToLondonDateTimeString,
  formatISODateStringHumanNumbersOnly,
  getRounded4HoursAgoString,
  getRoundedTickBoundary
} from "../helpers/utils";
import { theme } from "../../tailwind.config";
import useGlobalState, { getNext30MinSlot } from "../helpers/globalState";
import { DELTA_BUCKET, VIEWS } from "../../constant";

const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;
const orange = theme.extend.colors["ocf-orange"].DEFAULT;
const deltaNeg = theme.extend.colors["ocf-delta"]["100"];
const deltaPos = theme.extend.colors["ocf-delta"]["900"];
const deltaMaxTicks = [2000, 2500, 3000, 3500, 4000, 4500, 5000];
export type ChartData = {
  GENERATION_UPDATED?: number;
  GENERATION?: number;
  FORECAST?: number;
  PAST_FORECAST?: number;
  "4HR_FORECAST"?: number;
  "4HR_PAST_FORECAST"?: number;
  DELTA?: number;
  DELTA_BUCKET?: DELTA_BUCKET;
  PROBABILISTIC_RANGE?: Array<number>;
  formattedDate: string; // "2022-05-16T15:00",
};

const toolTiplabels: Record<string, string> = {
  GENERATION: "PV Live estimate",
  GENERATION_UPDATED: "PV Actual",
  FORECAST: "OCF Forecast",
  PAST_FORECAST: "OCF Forecast",
  // "4HR_FORECAST": `OCF ${getRounded4HoursAgoString()} Forecast`,
  "4HR_FORECAST": `OCF 4hr+ Forecast`,
  "4HR_PAST_FORECAST": "OCF 4hr Forecast",
  DELTA: "Delta",
  PROBABILISTIC_RANGE: "P"
};

const toolTipColors: Record<string, string> = {
  GENERATION_UPDATED: "white",
  GENERATION: "white",
  FORECAST: yellow,
  PAST_FORECAST: yellow,
  "4HR_FORECAST": orange,
  "4HR_PAST_FORECAST": orange,
  DELTA: deltaPos,
  PROBABILISTIC_RANGE: yellow
};
type RemixLineProps = {
  timeOfInterest: string;
  data: ChartData[];
  setTimeOfInterest?: (t: string) => void;
  yMax: number | string;
  timeNow: string;
  resetTime?: () => void;
  visibleLines: string[];
  deltaView?: boolean;
  deltaYMaxOverride?: number;
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
        <text x={x} y={yy + 15} fill="BLACK" className="text-xs" id="time-now" textAnchor="middle">
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
  deltaView = false,
  deltaYMaxOverride
}) => {
  // Set the y max. If national then set to 12000, for gsp plot use 'auto'
  const preppedData = data.sort((a, b) => a.formattedDate.localeCompare(b.formattedDate));
  const [show4hView] = useGlobalState("show4hView");
  const [view] = useGlobalState("view");
  const [largeScreenMode] = useGlobalState("dashboardMode");
  const currentTime = getNext30MinSlot(new Date()).toISOString().slice(0, 16);
  const localeTimeOfInterest = convertToLocaleDateString(timeOfInterest + "Z").slice(0, 16);
  const fourHoursFromNow = new Date(currentTime);
  fourHoursFromNow.setHours(fourHoursFromNow.getHours() + 4);

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
  function prettyPrintXdate(x: string | number) {
    if (typeof x === "number") {
      return convertISODateStringToLondonTime(new Date(x).toISOString());
    }
    return convertISODateStringToLondonTime(x + ":00+00:00");
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

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ResponsiveContainer>
        <ComposedChart
          width={500}
          height={400}
          data={preppedData}
          margin={{
            top: 20,
            right: 20,
            bottom: 20,
            left: 20
          }}
          onClick={(e?: { activeLabel?: string }) => {
            if (setTimeOfInterest && e?.activeLabel) {
              view === VIEWS.SOLAR_SITES
                ? setTimeOfInterest(
                    new Date(Number(e.activeLabel))?.toISOString() || new Date().toISOString()
                  )
                : setTimeOfInterest(e.activeLabel);
            }
          }}
        >
          <CartesianGrid verticalFill={["#545454", "#6C6C6C"]} fillOpacity={0.5} />
          <XAxis
            dataKey="formattedDate"
            xAxisId={"x-axis"}
            tickFormatter={prettyPrintXdate}
            scale={view === VIEWS.SOLAR_SITES ? "time" : "auto"}
            tick={{ fill: "white", style: { fontSize: "12px" } }}
            tickLine={true}
            type={view === VIEWS.SOLAR_SITES ? "number" : "category"}
            ticks={view === VIEWS.SOLAR_SITES ? ticks : undefined}
            domain={view === VIEWS.SOLAR_SITES ? [ticks[0], ticks[ticks.length - 1]] : undefined}
            interval={view === VIEWS.SOLAR_SITES ? undefined : 11}
          />
          <XAxis
            dataKey="formattedDate"
            xAxisId={"x-axis-2"}
            tickFormatter={prettyPrintXdate}
            scale={view === VIEWS.SOLAR_SITES ? "time" : "auto"}
            tick={{ fill: "white", style: { fontSize: "12px" } }}
            tickLine={true}
            type={view === VIEWS.SOLAR_SITES ? "number" : "category"}
            ticks={view === VIEWS.SOLAR_SITES ? ticks : undefined}
            domain={view === VIEWS.SOLAR_SITES ? [ticks[0], ticks[ticks.length - 1]] : undefined}
            interval={view === VIEWS.SOLAR_SITES ? undefined : 11}
            orientation="top"
            hide={true}
          />
          <YAxis
            tickFormatter={
              view === VIEWS.SOLAR_SITES ? undefined : (val, i) => prettyPrintYNumberWithCommas(val)
            }
            yAxisId={"y-axis"}
            tick={{ fill: "white", style: { fontSize: "12px" } }}
            tickLine={false}
            domain={[0, yMax]}
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
                tickFormatter={(val, i) => prettyPrintYNumberWithCommas(val, roundTickMax ? 0 : 2)}
                tick={{
                  fill: "white",
                  style: { fontSize: "12px" },
                  textAnchor: "end",
                  dx: roundTickMax ? 36 : 24
                }}
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
                  style: { fontSize: "12px" },
                  offset: 0,
                  dx: roundTickMax ? 0 : -10,
                  dy: 30
                }}
                domain={[-deltaYMax, deltaYMax]}
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
              view === VIEWS.SOLAR_SITES ? new Date(localeTimeOfInterest).getTime() : timeOfInterest
            }
            stroke="white"
            strokeWidth={2}
            yAxisId={"y-axis"}
            xAxisId={"x-axis"}
            scale={view === VIEWS.SOLAR_SITES ? "time" : "auto"}
            label={
              <CustomizedLabel
                className={`text-sm ${currentTime === timeOfInterest ? "fill-amber-400" : ""}`}
                value={prettyPrintXdate(timeOfInterest)}
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
          {show4hView && (
            <>
              <Line
                type="monotone"
                dataKey="4HR_FORECAST"
                dot={false}
                yAxisId={"y-axis"}
                xAxisId={"x-axis"}
                strokeDasharray="5 5"
                strokeDashoffset={3}
                stroke={orange} // blue
                strokeWidth={largeScreenMode ? 4 : 2}
                hide={!visibleLines.includes("4HR_FORECAST")}
              />
              <Line
                type="monotone"
                dataKey="4HR_PAST_FORECAST"
                dot={false}
                yAxisId={"y-axis"}
                xAxisId={"x-axis"}
                // strokeDasharray="10 10"
                stroke={orange} // blue
                strokeWidth={largeScreenMode ? 4 : 2}
                hide={!visibleLines.includes("4HR_PAST_FORECAST")}
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
            hide={!visibleLines.includes("PAST_FORECAST")}
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
          />

          <Tooltip
            content={({ payload, label }) => {
              console.log("payload", payload);
              const data = payload && payload[0]?.payload;
              if (!data || (data["GENERATION"] === 0 && data["FORECAST"] === 0)) return <div></div>;

              let formattedDate = data?.formattedDate + ":00+00:00";
              if (view === VIEWS.SOLAR_SITES) {
                const date = new Date(Number(data?.formattedDate));
                formattedDate = dateToLondonDateTimeString(date);
              }

              return (
                <div className="px-3 py-2 bg-mapbox-black bg-opacity-70 shadow">
                  <ul className="">
                    {Object.entries(toolTiplabels).map(([key, name]) => {
                      const value = data[key];
                      if (key === "DELTA" && !deltaView) return null;
                      if (typeof value !== "number") return null;
                      if (deltaView && key === "GENERATION" && data["GENERATION_UPDATED"] >= 0)
                        return null;
                      if (key.includes("4HR") && (!show4hView || !visibleLines.includes(key)))
                        return null;

                      const textClass = ["FORECAST", "PAST_FORECAST"].includes(name)
                        ? "font-semibold"
                        : "font-normal";
                      const sign = ["DELTA"].includes(key) ? (Number(value) > 0 ? "+" : "") : "";
                      const color = ["DELTA"].includes(key)
                        ? Number(value) > 0
                          ? deltaPos
                          : deltaNeg
                        : toolTipColors[key];
                      const computedValue =
                        key === "DELTA" &&
                        !show4hView &&
                        `${data["formattedDate"]}:00.000Z` >= currentTime
                          ? // `${data["formattedDate"]}:00.000Z` >= currentTime ||
                            // (show4hView &&
                            //   key.includes("4HR") &&
                            //   `${data["formattedDate"]}:00.000Z` >= fourHoursFromNow.toISOString())
                            "-"
                          : prettyPrintYNumberWithCommas(String(value), 1);

                      return (
                        <li className={`font-sans`} key={`item-${key}`} style={{ color }}>
                          <div className={`flex justify-between ${textClass}`}>
                            <div>{toolTiplabels[key]}: </div>
                            <div className={`font-sans ml-7`}>
                              {(show4hView || key !== "DELTA") && sign}
                              {computedValue}{" "}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                    {/* adding probabilistic values to the tooltip */}
                    {Object.entries(toolTiplabels).map(([key, name]) => {
                      const value = data[key];
                      const color = toolTipColors[key];
                      const pLevelLabels = ["P 10%", "P 90%"];
                      const pLevelComputed = pLevelLabels.map((pLevel: any) => (
                        <li key={key}>{pLevel}:</li>
                      ));
                      if (key === "PROBABILISTIC_RANGE" && !value) return null;
                      if (key === "PROBABILISTIC_RANGE" && deltaView) return null;
                      if (
                        key === "PROBABILISTIC_RANGE" &&
                        typeof value[0] !== "number" &&
                        typeof value[1] !== "number"
                      )
                        return null;
                      if (
                        key === "PROBABILISTIC_RANGE" &&
                        (Math.round(value[0] * 100) < 0 || Math.round(value[1] * 100) < 0)
                      )
                        return null;
                      const pLevelValue =
                        key === "PROBABILISTIC_RANGE" && value
                          ? value.map((v: any) => (
                              <li key={key} className={`flex justify-end`}>
                                {prettyPrintYNumberWithCommas(String(v), 1).replace("-", "")}
                              </li>
                            ))
                          : null;
                      if (key === "PROBABILISTIC_RANGE" && !deltaView)
                        return (
                          <li className={`font-sans`} style={{ color }}>
                            <div className={`flex justify-between`}>
                              <div className={`font-sans ml-14`}>{pLevelComputed}</div>
                              <div>{pLevelValue}</div>
                            </div>
                          </li>
                        );
                    })}
                    <li className={`flex justify-between pt-4 text-sm text-white font-sans`}>
                      <div className="pr-4">
                        {formatISODateStringHumanNumbersOnly(formattedDate)}{" "}
                      </div>
                      <div>{view === VIEWS.SOLAR_SITES ? "KW" : "MW"}</div>
                    </li>
                  </ul>
                </div>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RemixLine;
