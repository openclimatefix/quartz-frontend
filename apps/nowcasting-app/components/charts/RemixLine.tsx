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

// THIS IS WHAT WE WOULD WANT
// const data = [
//   {
//     time: "00:00",
//     datetimeUtc: "2022-05-16T15:00:00+00:00",
//     GENERATION: 0,
//     FORECAST: 0,
//   },
// ];

type RemixLineProps = {
  timeOfInterest: string;
  data: {
    time: string;
    GENERATION: number;
    FORECAST: number;
    GENERATION_UPDATED: number;
    datetimeUtc: string;
  }[];
};

const RemixLine: React.FC<RemixLineProps> = ({ timeOfInterest, data }) => {
  const preppedData = data;
  /** Ensures that the legend is ordered in the same way as the stacked items */
  const renderLegend = ({ payload }) => (
    <ul className="flex">
      {payload.map((entry, index) => (
        <li key={`item-${index}`} className="mr-2 text-white">
          <span
            className="inline-block w-3 h-3 mr-1"
            style={{ backgroundColor: entry.color }}
          ></span>
          {entry.value}
        </li>
      ))}
    </ul>
  );

  function prettyPrintNumberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  const renderTooltip = ({ payload, label }) => {
    const reversedPayload = [].concat(payload).reverse();

    return (
      <div className="p-2 bg-white border-2 border-black shadow">
        <p className="mb-1 text-lg font-bold">Time: {label}</p>
        <ul className="">
          {reversedPayload.map((entry, index) => (
            <li
              key={`item-${index}`}
              className={`p-1 ${
                (entry.name.startsWith("FORECAST") ||
                  entry.name.startsWith("Bio") ||
                  entry.name.startsWith("Other")) &&
                "text-white"
              }`}
              style={{ backgroundColor: entry.color }}
            >
              {entry.name}: {prettyPrintNumberWithCommas(entry.value)} MW
            </li>
          ))}
        </ul>
      </div>
    );
  };

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
        <XAxis dataKey="datetimeUtc" scale="band" tick={{ fill: "white" }} />
        <YAxis
          tickFormatter={(val, i) => prettyPrintNumberWithCommas(val) + " MW"}
          tick={{ fill: "white" }}
        />
        <Tooltip content={renderTooltip} />
        <Legend content={renderLegend} />
        <ReferenceLine
          x={timeOfInterest}
          stroke="#b0413e"
          strokeWidth={3}
          label={<Label value="sunrise" fill={"white"} />}
        />
        <ReferenceLine
          x="21:30"
          strokeWidth={3}
          stroke="#b0413e"
          label={<Label value="sunset" fill={"white"} />}
        />
        <ReferenceLine
          x={timeOfInterest}
          stroke="#b0413e"
          strokeWidth={8}
          label={<Label value="Time" fill={"white"} />}
        />
        <Line
          type="monotone"
          dataKey="FORECAST"
          stroke="#867DCC" //purple
          strokeWidth={4}
        />
        <Line
          type="monotone"
          dataKey="GENERATION"
          stroke="#FFC425" //yellow
          strokeWidth={8}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default RemixLine;
