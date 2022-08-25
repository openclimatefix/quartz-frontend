import React, { FC } from "react";
import {
  ComposedChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { convertISODateStringToLondonTime, formatISODateStringHuman } from "../utils";
import { theme } from "../../tailwind.config";
const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;
export type ChartData = {
  GENERATION_UPDATED?: number;
  GENERATION?: number;
  FORECAST?: number;
  PAST_FORECAST?: number;
  formatedDate: string; // "2022-05-16T15:00",
};

const toolTiplabels: Record<string, string> = {
  GENERATION_UPDATED: "PV Live updated",
  GENERATION: "PV Live initial estimate",
  FORECAST: "OCF Forecast",
  PAST_FORECAST: "OCF Forecast",
};
const toolTipColors: Record<string, string> = {
  GENERATION_UPDATED: "black",
  GENERATION: "black",
  FORECAST: yellow,
  PAST_FORECAST: yellow,
};
type RemixLineProps = {
  timeOfInterest: string;
  data: ChartData[];
  setTimeOfInterest?: (t: string) => void;
  yMax: number | string;
  timeNow: string;
  resetTime?: () => void;
  id?: string;
};
const CustomizedLabel: FC<any> = ({
  value,
  offset,
  viewBox: { x },
  className,
  solidLine,
  onClick,
  dataE2e,
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
        <text
          x={x + 1}
          y={yy + 21}
          fill="black"
          id="time-now"
          textAnchor="middle"
          data-e2e={dataE2e}
        >
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
  id,
  timeNow,
  resetTime,
}) => {
  // Set the y max. If national then set to 12000, for gsp plot use 'auto'
  const preppedData = data.sort((a, b) => a.formatedDate.localeCompare(b.formatedDate));
  /** Ensures that the legend is ordered in the same way as the stacked items */
  function prettyPrintYNumberWithCommas(x: string | number) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function prettyPrintXdate(x: string) {
    return convertISODateStringToLondonTime(x + ":00+00:00");
  }

  return (
    <div style={{ position: "relative", width: "100%", paddingBottom: "240px" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          top: 0,
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
              left: 20,
            }}
            onClick={(e?: { activeLabel?: string }) =>
              setTimeOfInterest && e?.activeLabel && setTimeOfInterest(e.activeLabel)
            }
          >
            <CartesianGrid verticalFill={["#545454", "#6C6C6C"]} fillOpacity={0.5} />
            <XAxis
              dataKey="formatedDate"
              tickFormatter={prettyPrintXdate}
              scale="band"
              tick={{ fill: "white" }}
              tickLine={true}
              interval={11}
            />
            <YAxis
              tickFormatter={(val, i) => prettyPrintYNumberWithCommas(val)}
              tick={{ fill: "white" }}
              tickLine={false}
              domain={[0, yMax]}
            />

            <ReferenceLine
              x={timeOfInterest}
              stroke="white"
              strokeWidth={2}
              label={
                <CustomizedLabel
                  className={timeNow !== timeOfInterest ? "hidden" : ""}
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
              className={timeNow !== timeOfInterest ? "" : " invisible"}
              label={
                <CustomizedLabel
                  className="fill-amber-400    cursor-pointer"
                  value={"NOW"}
                  dataE2e={id + "-now-refrence"}
                  onClick={resetTime}
                ></CustomizedLabel>
              }
            />

            <Line
              type="monotone"
              dataKey="GENERATION"
              dot={false}
              stroke="black"
              strokeWidth={5}
              strokeDasharray="5 5"
            />
            <Line
              type="monotone"
              dataKey="GENERATION_UPDATED"
              strokeWidth={3}
              stroke="black"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="PAST_FORECAST"
              dot={false}
              stroke={yellow} //yellow
              strokeWidth={4}
            />
            <Line
              type="monotone"
              dataKey="FORECAST"
              dot={false}
              strokeDasharray="10 10"
              stroke={yellow} //yellow
              strokeWidth={3}
            />
            <Tooltip
              content={({ payload, label }) => {
                const data = payload && payload[0]?.payload;
                if (!data) return <div></div>;
                return (
                  <div className="p-2 bg-white bg-opacity-80 shadow">
                    <p className="mb-2 text-black">
                      {formatISODateStringHuman(data?.formatedDate + ":00+00:00")}
                    </p>
                    <ul className="">
                      {Object.entries(data)
                        .reverse()
                        .map(([name, value]) => {
                          if (name === "formatedDate") return null;
                          return (
                            <li
                              className="font-bold"
                              key={`item-${name}`}
                              style={{ color: toolTipColors[name] }}
                            >
                              {toolTiplabels[name]}: {prettyPrintYNumberWithCommas(value as string)}{" "}
                              MW
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
