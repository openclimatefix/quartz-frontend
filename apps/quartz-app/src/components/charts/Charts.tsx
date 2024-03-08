"use client";
import { useGetRegionsQuery } from "@/src/hooks/queries";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
// @ts-ignore
import { theme } from "@/tailwind.config";
import { FC, ReactNode } from "react";
import {
  ACTUAL_SOLAR_COLOR,
  ACTUAL_WIND_COLOR,
  SOLAR_COLOR,
  WIND_COLOR,
} from "@/src/constants";
import { LegendContainer } from "@/src/components/charts/legend/LegendContainer";
import {
  formatEpochToPrettyTime,
  getEpochNowInTimezone,
  prettyPrintNowTime,
} from "@/src/helpers/datetime";
import { TooltipContent } from "@/src/components/charts/Tooltip";
import { CombinedData } from "@/src/types/data";
import { useChartData } from "@/src/hooks/useChartData";
import { CustomLabel } from "@/src/components/charts/labels/CustomLabel";
import { useGlobalState } from "../helpers/globalState";

type ChartsProps = {
  combinedData: CombinedData;
};

const Charts: FC<ChartsProps> = ({ combinedData }) => {
  const { data, error } = useGetRegionsQuery("solar");
  console.log("Charts data test", data);
  const formattedChartData = useChartData(combinedData);

  // Create array of ticks for the x-axis
  const now = new Date();
  const offsets = [
    -42, -36, -30, -24, -18, -12, -6, 0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60,
    66,
  ];
  const ticks = offsets.map((o) => {
    return new Date(now).setHours(o, 0, 0, 0);
  });

  // Useful shared constants for the chart
  const forecastsStrokeWidth = 1;
  const actualsStrokeWidth = 3.5;
  const futureAreaOpacity = 0.8;
  const futureStrokeOpacity = 1;
  const pastAreaOpacity = 0.6;
  const pastStrokeOpacity = 1;

  const [visibleLines] = useGlobalState("visibleLines");

  return (
    <div className="flex-1 flex flex-col justify-center items-center bg-ocf-grey-800">
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {/* Helps with the resizing of the chart in both axes */}
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
              data={formattedChartData}
              margin={{ top: 25, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid
                verticalFill={[
                  theme.extend.colors["ocf-grey"]["900"],
                  theme.extend.colors["ocf-grey"]["800"],
                ]}
                fillOpacity={0.5}
              />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatEpochToPrettyTime}
                scale={"time"}
                type={"number"}
                domain={
                  formattedChartData?.length
                    ? [
                        formattedChartData[0]?.timestamp,
                        formattedChartData[formattedChartData.length - 1]
                          .timestamp,
                      ]
                    : ["auto", "auto"]
                }
                ticks={ticks}
                tick={{ fill: "white", style: { fontSize: "12px" } }}
              />
              <YAxis
                tick={{ fill: "white", style: { fontSize: "12px" } }}
                label={{
                  value: "Generation ( MW )",
                  angle: 270,
                  position: "outsideLeft",
                  fill: "white",
                  style: { fontSize: "12px" },
                  offset: 0,
                  dx: -26,
                  dy: 0,
                }}
              />
              <Tooltip
                cursor={{ stroke: "#EEEEEE", strokeDasharray: 5 }}
                filterNull={false}
                content={(props) => <TooltipContent {...props} />}
              />
              <Area
                type="monotone"
                name={"wind_forecast_past"}
                stackId={"1"}
                dataKey="wind_forecast_past"
                stroke={WIND_COLOR}
                strokeWidth={forecastsStrokeWidth}
                strokeOpacity={pastStrokeOpacity}
                fill={WIND_COLOR}
                fillOpacity={pastAreaOpacity}
                hide={!visibleLines.includes("Wind")}
              />
              <Area
                type="monotone"
                name={"wind_forecast_future"}
                stackId={"1"}
                dataKey="wind_forecast_future"
                stroke={WIND_COLOR}
                strokeWidth={forecastsStrokeWidth}
                strokeDasharray={"10 5"}
                strokeOpacity={futureStrokeOpacity}
                fill={WIND_COLOR}
                fillOpacity={futureAreaOpacity}
                hide={!visibleLines.includes("Wind")}
              />
              <Area
                type="monotone"
                name={"solar_forecast_past"}
                stackId={"1"}
                dataKey="solar_forecast_past"
                stroke={SOLAR_COLOR}
                strokeWidth={forecastsStrokeWidth}
                strokeOpacity={pastStrokeOpacity}
                fillOpacity={pastAreaOpacity}
                fill={SOLAR_COLOR}
                hide={!visibleLines.includes("Solar")}
              />
              <Area
                type="monotone"
                name={"solar_forecast_future"}
                stackId={"1"}
                dataKey="solar_forecast_future"
                stroke={SOLAR_COLOR}
                strokeWidth={forecastsStrokeWidth}
                strokeDasharray={"10 5"}
                strokeOpacity={futureStrokeOpacity}
                fill={SOLAR_COLOR}
                fillOpacity={futureAreaOpacity}
                hide={!visibleLines.includes("Solar")}
              />
              <Area
                type="monotone"
                name={"wind_generation"}
                stackId={"2"}
                dataKey="wind_generation"
                stroke={ACTUAL_WIND_COLOR}
                strokeWidth={actualsStrokeWidth}
                strokeOpacity={pastStrokeOpacity}
                // connectNulls={true}
                fill={"none"}
                hide={!visibleLines.includes("Wind")}
              />
              <Area
                type="monotone"
                name={"solar_generation"}
                stackId={"2"}
                dataKey="solar_generation"
                stroke={ACTUAL_SOLAR_COLOR}
                strokeWidth={actualsStrokeWidth}
                // strokeDasharray={"20 4 2 4"}
                strokeLinejoin={"round"}
                strokeLinecap={"square"}
                strokeOpacity={pastStrokeOpacity}
                // dot={true}
                // connectNulls={true}
                fill={"none"}
                hide={!visibleLines.includes("Solar")}
              />
              <ReferenceLine
                x={getEpochNowInTimezone()}
                label={
                  <CustomLabel
                    className={`fill-white cursor-pointer text-sm`}
                    solidLine={true}
                    value={prettyPrintNowTime()}
                  />
                }
                offset={"20"}
                stroke="white"
                strokeWidth={3}
                strokeDasharray={"20 5"}
                strokeOpacity={0.75}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/*<LegendContainer />*/}
    </div>
  );
};

export default Charts;
