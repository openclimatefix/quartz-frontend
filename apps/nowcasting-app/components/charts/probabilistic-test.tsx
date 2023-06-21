// Type: Component part
import { FC } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

import React from "react";
import ReactDOM from "react-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

const data = [
  { name: "January", upper: 2500, forecast: 2000, lowest: 1500 },
  { name: "February", upper: 1000, forecast: 500, lowest: 250 },
  { name: "March", upper: 2000, forecast: 1500, lowest: 1000 },
  { name: "April", upper: 1500, forecast: 1000, lowest: 500 },
  { name: "May", upper: 500, forecast: 250, lowest: 100 },
  { name: "June", upper: 2200, forecast: 1700, lowest: 1200 },
  { name: "July", upper: 2100, forecast: 1800, lowest: 1300 }
];
const SimpleAreaChart = React.createClass({
  render() {
    return (
      <AreaChart
        width={600}
        height={400}
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <XAxis dataKey="name" />
        <YAxis />

        <Tooltip />
        <Area strokeWidth="0" type="monotone" dataKey="upper" fill="#FF9999" />
        <Area
          type="monotone"
          dataKey="forecast"
          stroke="#009900"
          fill="#eeffee"
        />
        <Area
          type="monotone"
          dataKey="lowest"
          strokeWidth="0"
          fill="#ffffff"
          fillOpacity={100}
        />
        <CartesianGrid strokeDasharray="3 3" />
      </AreaChart>
    );
  }
});