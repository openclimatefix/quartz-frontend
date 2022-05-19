import React from "react";
import {
  ComposedChart,
  Line,
  CartesianGrid,
  CartesianAxis,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

export type ChartData = {
  GENERATION_UPDATED?: number;
  GENERATION?: number;
  FORECAST?: number;
  PAST_FORECAST?: number;
  datetimeUtc: string; // "2022-05-16T15:00",
};
type RemixLineProps = {
  timeOfInterest: string;
  data: ChartData[];
};
const CustomizedLabel = (props) => {
  const {
    value,
    offset,
    viewBox: { x },
  } = props;
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
      <rect
        x={x - 28}
        y={yy}
        width="58"
        height="30"
        offset={offset}
        fill="white"
      ></rect>
      <text x={x + 1} y={yy + 21} id="time-now" textAnchor="middle">
        {value}
      </text>
    </g>
  );
};
const RemixLine: React.FC<RemixLineProps> = ({ timeOfInterest, data }) => {
  const preppedData = data.sort((a, b) =>
    a.datetimeUtc.localeCompare(b.datetimeUtc)
  );
  /** Ensures that the legend is ordered in the same way as the stacked items */
  function prettyPrintYNumberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function prettyPrintXdate(x) {
    return x.slice(11, 16);
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
      >
        <XAxis
          dataKey="datetimeUtc"
          tickFormatter={prettyPrintXdate}
          scale="band"
          tick={{ fill: "white" }}
          tickLine={true}
          interval={11}
          padding={{ left: -4.5 }}
        />
        <YAxis
          tickFormatter={(val, i) => prettyPrintYNumberWithCommas(val)}
          tick={{ fill: "white" }}
          tickLine={false}
        />
        <CartesianGrid
          verticalFill={["#545454", "#6C6C6C"]}
          fillOpacity={0.5}
        />
        <ReferenceLine
          x={timeOfInterest}
          stroke="white"
          strokeWidth={1}
          strokeDasharray="3 3"
          label={
            <CustomizedLabel
              value={prettyPrintXdate(timeOfInterest)}
            ></CustomizedLabel>
          }
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
          strokeDasharray="7 7"
          stroke="#FFC425" //yellow
          strokeWidth={3}
        />
        <Line
          type="monotone"
          dataKey="GENERATION"
          strokeWidth={0}
          dot={{ fill: "black" }}
        />
        <Line
          type="monotone"
          dataKey="GENERATION_UPDATED"
          stroke="black"
          strokeWidth={3}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default RemixLine;
