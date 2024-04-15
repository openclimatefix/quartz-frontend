"use client";
import { useGetRegionsQuery } from "@/src/hooks/queries";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
// @ts-ignore
import { theme } from "@/tailwind.config";
import { FC, ReactNode, useState, useEffect } from "react";
import {
  ACTUAL_SOLAR_COLOR,
  ACTUAL_WIND_COLOR,
  SOLAR_COLOR,
  WIND_COLOR,
} from "@/src/constants";
import { LegendContainer } from "@/src/components/charts/legend/LegendContainer";
import {
  formatEpochToDateTime,
  formatEpochToHumanDayName,
  formatEpochToPrettyTime,
  getEpochNowInTimezone,
  prettyPrintNowTime,
} from "@/src/helpers/datetime";
import { TooltipContent } from "@/src/components/charts/Tooltip";
import { CombinedData } from "@/src/types/data";
import { useChartData } from "@/src/hooks/useChartData";
import { CustomLabel } from "@/src/components/charts/labels/CustomLabel";
import { useGlobalState } from "../helpers/globalState";
import { DateTime } from "luxon";
import { ZoomOutIcon } from "@heroicons/react/solid";
import { format } from "path";

type ChartsProps = {
  combinedData: CombinedData;
  zoomEnabled?: boolean;
};

const Charts: FC<ChartsProps> = ({ combinedData, zoomEnabled = true }) => {
  const { data, error } = useGetRegionsQuery("solar");
  console.log("Charts data test", data);
  const formattedChartData = useChartData(combinedData);

  // Create array of ticks for the x-axis
  const now = DateTime.now();
  const offsets = [
    -42, -36, -30, -24, -18, -12, -6, 0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60,
    66,
  ];
  const ticks = offsets.map((o) => {
    return now.set({ hour: o, minute: 0, second: 0 }).toMillis();
  });
  const dayTicks = offsets.map((tick) => {
    const epoch = now.set({ hour: tick, minute: 0, second: 0 }).toMillis();
    const time = formatEpochToPrettyTime(epoch);
    if (time === "12:00") return epoch;
    return "";
  });

  // Useful for the chart Zoom Feature
  const [filteredPreppedData, setFilteredPreppedData] =
    useState(formattedChartData);
  const defaultZoom = { x1: "", x2: "" };
  const [selectingZoomArea, setSelectingZoomArea] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [temporaryZoomArea, setTemporaryZoomArea] = useState(defaultZoom);

  //get Y axis boundary

  // const yMaxZoom_Levels = [
  //   10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 6000,
  //   7000, 8000, 9000, 10000, 11000, 12000
  // ];

  // let zoomYMax = getZoomYMax(filteredPreppedData);
  // zoomYMax = getRoundedTickBoundary(zoomYMax || 0, yMaxZoom_Levels);

  // reset chart to default zoom level

  function handleZoomOut() {
    setIsZoomed(false);
    setFilteredPreppedData(formattedChartData);
  }

  // useEffect(() => {
  //   if (!zoomEnabled) return;

  //   if (!selectingZoomArea) {
  //     console.log("Zooming in");
  //     const { x1, x2 } = temporaryZoomArea;

  //     const dataInAreaRange = formattedChartData?.filter(
  //       (d) => formatEpochToDateTime(d?.timestamp) >= formatEpochToDateTime(Number(x1)) && formatEpochToDateTime(d?.timestamp) <= formatEpochToDateTime(Number(x2))
  //     );
  //     setFilteredPreppedData(dataInAreaRange);
  //     console.log("Filtered Data", dataInAreaRange);

  //   }
  // }, [
  //   temporaryZoomArea,
  //   selectingZoomArea,
  //   isZoomed,
  //   formattedChartData,
  //   filteredPreppedData,
  //   zoomEnabled,
  // ]);

  // Useful shared constants for the chart
  const forecastsStrokeWidth = 1;
  const actualsStrokeWidth = 3;
  const futureAreaOpacity = 0.8;
  const futureStrokeOpacity = 1;
  const pastAreaOpacity = 0.5;
  const pastStrokeOpacity = 1;

  const [visibleLines] = useGlobalState("visibleLines");

  return (
    <div className="flex-1 flex flex-col justify-center items-center bg-ocf-grey-800 select-none">
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
          {zoomEnabled && isZoomed && (
            <div className={`absolute top-5 z-10 right-4`}>
              <button
                type="button"
                onClick={handleZoomOut}
                style={{ position: "relative", top: "0", left: "20" }}
                className="flex font-bold items-center p-1.5 border-ocf-gray-800 text-white bg-ocf-gray-800 hover:bg-ocf-gray-700 focus:z-10 focus:text-white h-auto"
              >
                <ZoomOutIcon className="w-8 h-8" />
              </button>
            </div>
          )}
          <ResponsiveContainer>
            <ComposedChart
              data={
                zoomEnabled && isZoomed
                  ? filteredPreppedData
                  : formattedChartData
              }
              //data={zoomEnabled && globalIsZoomed ? filteredPreppedData : preppedData}
              margin={{ top: 25, right: 30, left: 20, bottom: 20 }}
              onMouseDown={(e?: { activeLabel?: string }) => {
                if (!zoomEnabled) return;

                setSelectingZoomArea(true);
                let xValue = e?.activeLabel;
                if (xValue) {
                  setTemporaryZoomArea({ x1: xValue, x2: xValue });
                }
              }}
              onMouseMove={(e?: { activeLabel?: string }) => {
                if (!zoomEnabled) return;

                if (selectingZoomArea) {
                  let xValue = e?.activeLabel;
                  setTemporaryZoomArea((zoom) => ({
                    ...zoom,
                    x2: xValue || "",
                  }));
                }
                console.log(
                  "xValue",
                  e?.activeLabel,
                  "Area to Zoom in on",
                  temporaryZoomArea
                );
              }}
              onMouseUp={(e?: { activeLabel?: string }) => {
                if (!zoomEnabled) return;

                if (selectingZoomArea) {
                  if (temporaryZoomArea.x1 && temporaryZoomArea.x2) {
                    let { x1 } = temporaryZoomArea;
                    let x2 = e?.activeLabel || "";
                    if (x1 > x2) {
                      [x1, x2] = [x2, x1];
                    }
                    const dataInAreaRange = formattedChartData?.filter(
                      (d) =>
                        formatEpochToDateTime(d?.timestamp) >=
                          formatEpochToDateTime(Number(temporaryZoomArea.x1)) &&
                        formatEpochToDateTime(d?.timestamp) <=
                          formatEpochToDateTime(Number(temporaryZoomArea.x2))
                    );

                    setFilteredPreppedData(dataInAreaRange);

                    setTemporaryZoomArea({ x1, x2 });
                    setIsZoomed(true);
                  }
                  console.log(
                    "xValue",
                    e?.activeLabel,
                    "Area to Zoom in on",
                    temporaryZoomArea,
                    "data in range",
                    filteredPreppedData
                  );
                  setSelectingZoomArea(false);
                }
              }}
            >
              <CartesianGrid
                verticalFill={[
                  theme.extend.colors["ocf-grey"]["900"],
                  theme.extend.colors["ocf-grey"]["800"],
                ]}
                fillOpacity={0.5}
              />

              {/* add an x-axis for when data is filtered with filteredPreppedData */}
              {zoomEnabled && isZoomed && (
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatEpochToPrettyTime}
                  scale={"time"}
                  type={"number"}
                  domain={
                    filteredPreppedData?.length
                      ? [
                          filteredPreppedData[0]?.timestamp,
                          filteredPreppedData[filteredPreppedData.length - 1]
                            .timestamp,
                        ]
                      : ["auto", "auto"]
                  }
                  ticks={ticks}
                  tick={{ fill: "white", style: { fontSize: "12px" } }}
                />
              )}
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
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatEpochToHumanDayName}
                scale={"time"}
                type={"number"}
                xAxisId={"x-axis-3"}
                orientation="bottom"
                domain={
                  formattedChartData?.length
                    ? [
                        formattedChartData[0]?.timestamp,
                        formattedChartData[formattedChartData.length - 1]
                          .timestamp,
                      ]
                    : ["auto", "auto"]
                }
                tickLine={false}
                ticks={dayTicks}
                tick={{ fill: "white", style: { fontSize: "12px" } }}
                tickMargin={-10}
                axisLine={false}
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
              {zoomEnabled && selectingZoomArea && (
                <ReferenceArea
                  x1={temporaryZoomArea?.x1}
                  x2={temporaryZoomArea?.x2}
                  fill="#FFD053"
                  fillOpacity={0.3}
                />
              )}
              <Tooltip
                cursor={{ stroke: "#EEEEEE", strokeDasharray: 5 }}
                filterNull={false}
                content={(props) => (
                  <TooltipContent {...props} visibleLines={visibleLines} />
                )}
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
                stackId={"2"}
                dataKey="wind_forecast_future"
                stroke={WIND_COLOR}
                strokeWidth={forecastsStrokeWidth}
                // strokeDasharray={"10 5"}
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
                stackId={"2"}
                dataKey="solar_forecast_future"
                stroke={SOLAR_COLOR}
                strokeWidth={forecastsStrokeWidth}
                // strokeDasharray={"10 5"}
                strokeOpacity={futureStrokeOpacity}
                fill={SOLAR_COLOR}
                fillOpacity={futureAreaOpacity}
                hide={!visibleLines.includes("Solar")}
              />
              <Area
                type="monotone"
                name={"wind_generation"}
                stackId={"3"}
                dataKey="wind_generation"
                stroke={ACTUAL_WIND_COLOR}
                strokeLinecap={"round"}
                strokeLinejoin={"bevel"}
                strokeWidth={actualsStrokeWidth}
                strokeOpacity={pastStrokeOpacity}
                // connectNulls={true}
                fill={"none"}
                hide={!visibleLines.includes("Wind")}
              />
              <Area
                type="monotone"
                name={"solar_generation"}
                stackId={"3"}
                dataKey="solar_generation"
                stroke={ACTUAL_SOLAR_COLOR}
                strokeWidth={actualsStrokeWidth}
                // strokeDasharray={"20 4 2 4"}
                strokeLinejoin={"round"}
                strokeLinecap={"round"}
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
                    className={`fill-white text-sm`}
                    solidLine={true}
                    value={prettyPrintNowTime()}
                  />
                }
                offset={"20"}
                stroke="white"
                strokeWidth={2}
                // strokeDasharray={"20 5"}
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
