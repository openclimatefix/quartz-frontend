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
  GENERATION_UPDATED: "#24292E",
  GENERATION: "#24292E",
  FORECAST: "#FFC425",
  PAST_FORECAST: "#FFC425",
};
type RemixLineProps = {
  timeOfInterest: string;
  data: ChartData[];
  setTimeOfInterest?: (t: string) => void;
};
const CustomizedLabel: FC<any> = ({ value, offset, viewBox: { x } }) => {
  const yy = 230;
  return (
    <g>
      <line
        stroke="white"
        strokeWidth="1"
        strokeDasharray="3 3"
        fill="none"
        fillOpacity="1"
        x1={x}
        y1={yy - 50}
        x2={x}
        y2={yy}
      ></line>
      <rect x={x - 28} y={yy} width="58" height="30" offset={offset} fill="white"></rect>
      <text x={x + 1} y={yy + 21} id="time-now" textAnchor="middle">
        {value}
      </text>
    </g>
  );
};
const RemixLine: React.FC<RemixLineProps> = ({ timeOfInterest, data, setTimeOfInterest }) => {
  const preppedData = data.sort((a, b) => a.formatedDate.localeCompare(b.formatedDate));
  /** Ensures that the legend is ordered in the same way as the stacked items */
  function prettyPrintYNumberWithCommas(x: string | number) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function prettyPrintXdate(x: string) {
    return convertISODateStringToLondonTime(x + ":00+00:00");
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
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
        />

        <ReferenceLine
          x={timeOfInterest}
          stroke="white"
          strokeWidth={1}
          strokeDasharray="3 3"
          label={<CustomizedLabel value={prettyPrintXdate(timeOfInterest)}></CustomizedLabel>}
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
          stroke="#FFC425" //yellow
          strokeWidth={4}
        />
        <Line
          type="monotone"
          dataKey="FORECAST"
          dot={false}
          strokeDasharray="10 10"
          stroke="#FFC425" //yellow
          strokeWidth={3}
        />
        <Tooltip
          content={({ payload, label }) => {
            const data = payload && payload[0]?.payload;
            if (!data) return <div></div>;
            return (
              <div className="p-2 bg-white shadow">
                <p className="mb-2 text-black">
                  {formatISODateStringHuman(data?.formatedDate + ":00+00:00")}
                </p>
                <ul className="">
                  {Object.entries(data)
                    .reverse()
                    .map(([name, value]) => {
                      if (name === "formatedDate") return null;
                      return (
                        <li key={`item-${name}`} style={{ color: toolTipColors[name] }}>
                          {toolTiplabels[name]}: {prettyPrintYNumberWithCommas(value as string)} MW
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
  );
};

export default RemixLine;
