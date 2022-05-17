import React from "react";
import {
  ComposedChart,
  Line,
  Label,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const setDatasetValsToZeroAfterTOI = (dataset, timeSteps, timeOfInterest) => {
  const toiIndex = timeSteps.indexOf(timeOfInterest);
  return dataset.map((data, index) => {
    const MAGIC_NUMBER = 5; // don't ask me why...
    if (index < toiIndex - MAGIC_NUMBER) {
      return data;
    } else {
      return {
        ...data,
        GENERATION: undefined,
      };
    }
  });
};
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
        {/* <CartesianGrid stroke="#f5f5f5" /> */}
        <XAxis
          dataKey="datetimeUtc"
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
          label={
            <Label value={prettyPrintXdate(timeOfInterest)} fill={"white"} />
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
          strokeDasharray="4 4"
          stroke="#FFC425" //yellow
          strokeWidth={4}
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
