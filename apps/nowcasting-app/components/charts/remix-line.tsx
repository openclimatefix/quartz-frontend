import React, { FC } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  Rectangle,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import {
  convertISODateStringToLondonTime,
  formatISODateStringHuman,
  formatISODateStringHumanNumbersOnly,
  getRounded4HoursAgoString,
  getRoundedTickBoundary
} from "../helpers/utils";
import { theme } from "../../tailwind.config";
import useGlobalState from "../helpers/globalState";
import { DELTA_BUCKET } from "../../constant";
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
  formattedDate: string; // "2022-05-16T15:00",
};

const toolTiplabels: Record<string, string> = {
  GENERATION: "PV Live estimate",
  GENERATION_UPDATED: "PV Live updated",
  FORECAST: "OCF Forecast",
  PAST_FORECAST: "OCF Forecast",
  "4HR_FORECAST": `OCF ${getRounded4HoursAgoString()} Forecast`,
  "4HR_PAST_FORECAST": "OCF 4hr Forecast",
  DELTA: "Delta"
};
const toolTipColors: Record<string, string> = {
  GENERATION_UPDATED: "white",
  GENERATION: "white",
  FORECAST: yellow,
  PAST_FORECAST: yellow,
  "4HR_FORECAST": orange,
  "4HR_PAST_FORECAST": orange,
  DELTA: deltaPos
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
  const yy = 230;
  return (
    <g>
      <line
        stroke="white"
        strokeWidth={solidLine ? "2" : "1"}
        strokeDasharray={solidLine ? "" : "3 3"}
        fill="none"
        fillOpacity="1"
        x1={x}
        y1={yy - 50}
        x2={x}
        y2={yy}
      ></line>
      <g className={`fill-white ${className || ""}`} onClick={onClick}>
        <rect x={x - 28} y={yy} width="58" height="30" offset={offset} fill={"inherit"}></rect>
        <text x={x + 1} y={yy + 21} fill="black" id="time-now" textAnchor="middle">
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
  const fourHoursFromNow = new Date(timeNow);
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
  function prettyPrintXdate(x: string) {
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
  const isGSP = deltaYMaxOverride && deltaYMaxOverride < 1000;

  return (
    <div style={{ position: "relative", width: "100%", paddingBottom: "240px" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          top: 0
        }}
      >
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
            onClick={(e?: { activeLabel?: string }) =>
              setTimeOfInterest && e?.activeLabel && setTimeOfInterest(e.activeLabel)
            }
          >
            <CartesianGrid verticalFill={["#545454", "#6C6C6C"]} fillOpacity={0.5} />
            <XAxis
              dataKey="formattedDate"
              tickFormatter={prettyPrintXdate}
              scale="band"
              tick={{ fill: "white", style: { fontSize: "12px" } }}
              tickLine={true}
              interval={11}
            />
            <YAxis
              tickFormatter={(val, i) => prettyPrintYNumberWithCommas(val)}
              tick={{ fill: "white", style: { fontSize: "12px" } }}
              tickLine={false}
              domain={[0, yMax]}
            />
            {deltaView && (
              <>
                <YAxis
                  tickFormatter={(val, i) =>
                    prettyPrintYNumberWithCommas(val, roundTickMax ? 0 : 2)
                  }
                  tick={{
                    fill: "white",
                    style: { fontSize: "12px" },
                    textAnchor: "end",
                    dx: roundTickMax ? 36 : 24
                  }}
                  ticks={[deltaYMax, deltaYMax / 2, 0, -deltaYMax / 2, -deltaYMax]}
                  tickCount={5}
                  tickLine={false}
                  yAxisId="delta"
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
                <ReferenceLine y={0} stroke="white" strokeWidth={0.1} yAxisId={"delta"} />
              </>
            )}

            <ReferenceLine
              x={timeOfInterest}
              stroke="white"
              strokeWidth={2}
              label={
                <CustomizedLabel
                  className={
                    (!deltaView && timeNow !== timeOfInterest) || (deltaView && isGSP)
                      ? "hidden"
                      : ""
                  }
                  value={prettyPrintXdate(timeOfInterest)}
                  solidLine={true}
                ></CustomizedLabel>
              }
            />
            <ReferenceLine
              x={timeNow}
              stroke="white"
              strokeWidth={1}
              strokeDasharray="3 3"
              className={timeNow !== timeOfInterest ? "" : "hidden"}
              label={
                deltaView ? undefined : (
                  <CustomizedLabel
                    className={`fill-amber-400 cursor-pointer ${isGSP ? "hidden" : ""}`}
                    value={"NOW"}
                    onClick={resetTime}
                  />
                )
              }
            />
            {show4hView && (
              <>
                <Line
                  type="monotone"
                  dataKey="4HR_FORECAST"
                  dot={false}
                  strokeDasharray="5 5"
                  strokeDashoffset={3}
                  stroke={orange} // blue
                  strokeWidth={3}
                  hide={!visibleLines.includes("4HR_FORECAST")}
                />
                <Line
                  type="monotone"
                  dataKey="4HR_PAST_FORECAST"
                  dot={false}
                  // strokeDasharray="10 10"
                  stroke={orange} // blue
                  strokeWidth={3}
                  hide={!visibleLines.includes("4HR_PAST_FORECAST")}
                />
              </>
            )}
            <Line
              type="monotone"
              dataKey="GENERATION"
              dot={false}
              stroke="black"
              strokeWidth={3}
              strokeDasharray="5 5"
              hide={!visibleLines.includes("GENERATION")}
            />
            <Line
              type="monotone"
              dataKey="GENERATION_UPDATED"
              strokeWidth={3}
              stroke="black"
              dot={false}
              hide={!visibleLines.includes("GENERATION_UPDATED")}
            />
            <Line
              type="monotone"
              dataKey="PAST_FORECAST"
              dot={false}
              stroke={yellow} //yellow
              strokeWidth={3}
              hide={!visibleLines.includes("PAST_FORECAST")}
            />
            <Line
              type="monotone"
              dataKey="FORECAST"
              dot={false}
              strokeDasharray="5 5"
              stroke={yellow} //yellow
              strokeWidth={3}
              hide={!visibleLines.includes("FORECAST")}
            />
            {deltaView && (
              <Bar
                type="monotone"
                dataKey="DELTA"
                yAxisId={"delta"}
                // @ts-ignore
                shape={<CustomBar />}
                barSize={3}
              />
            )}
            <Tooltip
              content={({ payload, label }) => {
                const data = payload && payload[0]?.payload;
                if (!data || (data["GENERATION"] === 0 && data["FORECAST"] === 0))
                  return <div></div>;

                return (
                  <div className="px-3 py-2 bg-mapbox-black bg-opacity-70 shadow">
                    <ul className="">
                      {Object.entries(toolTiplabels).map(([key, name]) => {
                        const value = data[key];
                        if (key === "DELTA" && !deltaView) return null;
                        if (typeof value !== "number") return null;
                        if (deltaView && key === "GENERATION" && data["GENERATION_UPDATED"] >= 0)
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
                          (key === "DELTA" &&
                            !show4hView &&
                            `${data["formattedDate"]}:00.000Z` >= timeNow) ||
                          (show4hView &&
                            `${data["formattedDate"]}:00.000Z` >= fourHoursFromNow.toISOString())
                            ? "-"
                            : prettyPrintYNumberWithCommas(String(value));
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
                      <li className={`flex justify-between pt-4 text-sm text-white font-sans`}>
                        <div>
                          {formatISODateStringHumanNumbersOnly(data?.formattedDate + ":00+00:00")}{" "}
                        </div>
                        <div>MW</div>
                      </li>
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
