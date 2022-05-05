import React from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const BarLineChart = ({ data }) => {
  const COLORS = [
    "#14120E",
    "#9597E4",
    "#351E29",
    "#468AC9",
    "#8DC77B",
    "#643173",
    "#A13D63",
    "#EA526F",
  ];
  const GENERATION = [
    // { key: "Oil", fill: COLORS[0] },
    // { key: "Coal", fill: COLORS[0] },
    { key: "Nuclear", fill: COLORS[1] },
    { key: "Wind", fill: COLORS[2] },
    { key: "Pumped Storage", fill: COLORS[3] },
    { key: "Hydro", fill: COLORS[3] },
    { key: "Combined Cycle Gas Turbines", fill: COLORS[4] },
    { key: "Open Cycle Gas Turbines", fill: COLORS[4] },
    { key: "Biomass", fill: COLORS[5] },
    { key: "Other", fill: COLORS[6] },
    { key: "INTFR", fill: COLORS[7] },
    { key: "INTIRL", fill: COLORS[7] },
    { key: "INTED", fill: COLORS[7] },
    { key: "INTEW", fill: COLORS[7] },
    { key: "INTNEM", fill: COLORS[7] },
    { key: "SOLAR", fill: "#FFC425" },
  ];

  /** Ensures that the legend is ordered in the same way as the stacked items */
  const renderLegend = ({ payload }) => (
    <ul className="flex">
      {payload.map((entry, index) => (
        <li key={`item-${index}`} className="mr-2">
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
                (entry.name.startsWith("INT") ||
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
        data={data}
        margin={{
          top: 20,
          right: 20,
          bottom: 20,
          left: 20,
        }}
      >
        <CartesianGrid stroke="#f5f5f5" />
        <XAxis dataKey="time" scale="band" />
        <YAxis
          tickFormatter={(val, i) => prettyPrintNumberWithCommas(val) + " MW"}
        />
        <Tooltip content={renderTooltip} />
        <Legend content={renderLegend} />

        {GENERATION.map(({ key, fill }) => (
          <Bar
            dataKey={key}
            key={key}
            stackId="a"
            fill={fill}
            stroke="white"
            strokeWidth={2}
          />
        ))}
        <Line
          type="monotone"
          dataKey="DEMAND"
          stroke="#201335"
          strokeWidth={10}
        />
        <Line
          type="monotone"
          dataKey="FORECAST"
          stroke="#867DCC"
          strokeWidth={10}
          strokeDasharray="3 3"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default BarLineChart;
