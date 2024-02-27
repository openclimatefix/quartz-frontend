"use client";
import { useGetRegionsQuery } from "@/src/hooks/queries";
import { components } from "@/src/types/schema";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
// @ts-ignore
import { theme } from "@/tailwind.config";
import { DateTime } from "luxon";
import { FC, ReactNode } from "react";
import {
  NameType,
  Payload,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { SolarIcon24, WindIcon24 } from "@/src/components/icons/icons";

type ChartsProps = {
  solarGenerationData:
    | components["schemas"]["GetHistoricGenerationResponse"]
    | undefined;
  windGenerationData:
    | components["schemas"]["GetHistoricGenerationResponse"]
    | undefined;
  solarForecastData:
    | components["schemas"]["GetForecastGenerationResponse"]
    | undefined;
  windForecastData:
    | components["schemas"]["GetForecastGenerationResponse"]
    | undefined;
};

const Charts: React.FC<ChartsProps> = ({
  solarGenerationData,
  windGenerationData,
  solarForecastData,
  windForecastData,
}) => {
  const { data, error } = useGetRegionsQuery("solar");
  console.log("Charts data test", data);

  const convertDatestampToEpoch = (time: string) => {
    const date = new Date(time.slice(0, 16));
    return date.getTime();
  };

  const formatDate = (time: number) => {
    const date = DateTime.fromMillis(time);
    return date.toFormat("dd/MM/yyyy HH:mm");
  };

  const formatTick = (time: number) => {
    const date = DateTime.fromMillis(time);
    return date.toFormat("HH:mm");
  };

  const getNowInTimezone = () => {
    const now = DateTime.now().setZone("ist");
    return DateTime.fromISO(now.toString().slice(0, 16)).set({
      hour: now.minute >= 45 ? now.hour + 1 : now.hour,
      minute: now.minute < 45 ? Math.floor(now.minute / 15) * 15 : 0,
      second: 0,
      millisecond: 0,
    });
  };

  const getEpochNowInTimezone = () => {
    return getNowInTimezone().toMillis();
  };

  const prettyPrintNowTime = () => {
    return getNowInTimezone().toFormat("HH:mm");
  };

  type ChartDatum = {
    timestamp: number;
    solar_generation?: number | null;
    wind_generation?: number | null;
    solar_forecast_past?: number;
    solar_forecast_future?: number;
    wind_forecast_past?: number;
    wind_forecast_future?: number;
  };

  const TOOLTIP_DISPLAY_NAMES = {
    solar_forecast_past: "OCF Forecast",
    solar_forecast_future: "OCF Forecast",
    wind_forecast_past: "OCF Forecast",
    wind_forecast_future: "OCF Forecast",
    solar_generation: "Actual",
    wind_generation: "Actual",
  };

  let formattedChartData: ChartDatum[] = [];

  // Loop through wind forecast and add to formattedSolarData
  if (windForecastData?.values) {
    for (const value of windForecastData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedChartData?.find(
        (data) => data.timestamp === timestamp
      );
      const key =
        timestamp < getEpochNowInTimezone()
          ? "wind_forecast_past"
          : "wind_forecast_future";
      if (existingData) {
        existingData[key] = value.PowerKW / 1000;
      } else {
        formattedChartData?.push({
          timestamp,
          [key]: value.PowerKW / 1000,
        });
      }
    }
  }
  // Loop through solar forecast and add to formattedSolarData
  if (solarForecastData?.values) {
    for (const value of solarForecastData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedChartData?.find(
        (data) => data.timestamp === timestamp
      );
      const key =
        timestamp < getEpochNowInTimezone()
          ? "solar_forecast_past"
          : "solar_forecast_future";
      if (existingData) {
        existingData[key] = value.PowerKW / 1000;
      } else {
        formattedChartData?.push({
          timestamp,
          [key]: value.PowerKW / 1000,
        });
      }
    }
  }

  // Loop through solar generation and add to formattedSolarData
  if (solarGenerationData?.values) {
    for (const value of solarGenerationData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedChartData?.find(
        (data) => data.timestamp === timestamp
      );
      if (
        existingData &&
        (existingData.solar_forecast_past ||
          existingData.solar_forecast_future ||
          existingData.wind_forecast_future ||
          existingData.wind_forecast_past)
      ) {
        existingData.solar_generation = value.PowerKW / 1000;
      }
    }
  }

  // Loop through wind generation and add to formattedSolarData
  if (windGenerationData?.values) {
    for (const value of windGenerationData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedChartData?.find(
        (data) => data.timestamp === timestamp
      );
      if (
        existingData &&
        (existingData.solar_forecast_past ||
          existingData.solar_forecast_future ||
          existingData.wind_forecast_future ||
          existingData.wind_forecast_past)
      ) {
        existingData.wind_generation = value.PowerKW / 1000;
      }
    }
  }

  formattedChartData = formattedChartData.sort(
    (a, b) => a.timestamp - b.timestamp
  );

  console.log(
    "formattedGenerationData",
    formattedChartData.map((d) => ({
      prettyPrint: new Date(d.timestamp).toLocaleString(),
      ...d,
    }))
  );
  const now = new Date();
  const offsets = [
    -42, -36, -30, -24, -18, -12, -6, 0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60,
    66,
  ];
  const ticks = offsets.map((o) => {
    return new Date(now).setHours(o, 0, 0, 0);
  });
  const SOLAR_COLOR = theme.extend.colors["ocf-yellow"].DEFAULT || "#FFD053";
  const WIND_COLOR = theme.extend.colors["ocf-blue"].DEFAULT || "#48B0DF";

  const TooltipContent: FC<{
    payload?: Payload<ValueType, NameType>[];
    label?: number;
  }> = ({ payload, label }) => {
    const TooltipHeader: FC<{ title: string; icon: ReactNode }> = ({
      title,
      icon,
    }) => {
      return (
        <div className="text-lg flex justify-between items-center mt-2 mb-1">
          <span className="flex-initial">{title}</span>
          <hr className="flex-1 mx-2" />
          <span className="flex-initial">{icon}</span>
        </div>
      );
    };
    const TooltipRow: FC<{
      name: keyof typeof TOOLTIP_DISPLAY_NAMES;
      generationType: "solar" | "wind";
      dataType: "forecast" | "generation";
      payload?: Payload<ValueType, NameType>[];
    }> = ({ name, generationType, dataType, payload }) => {
      const rowData = payload?.find((item) => item.dataKey === name);
      if (!rowData) return null;

      const prettyName = TOOLTIP_DISPLAY_NAMES[name];
      let color = generationType === "solar" ? SOLAR_COLOR : WIND_COLOR;
      if (dataType === "generation") color = "white";

      return (
        <div className="text-sm flex justify-between" style={{ color }}>
          <span>{prettyName}</span>
          <span>
            {typeof rowData.value === "number"
              ? rowData.value?.toFixed(0)
              : rowData.value}
          </span>
        </div>
      );
    };

    return (
      <div className="flex flex-col bg-ocf-grey-900/60 text-white p-3 w-64">
        <div className="text-sm flex items-stretch justify-between">
          <span>{label ? formatDate(label) : "No timestamp"}</span>
          <span>MW</span>
        </div>
        {/* Wind Values */}
        <TooltipHeader title={"Wind"} icon={<WindIcon24 />} />
        <TooltipRow
          name="wind_generation"
          generationType={"wind"}
          dataType={"generation"}
          payload={payload}
        />
        <TooltipRow
          name="wind_forecast_past"
          generationType={"wind"}
          dataType={"forecast"}
          payload={payload}
        />
        <TooltipRow
          name="wind_forecast_future"
          generationType={"wind"}
          dataType={"forecast"}
          payload={payload}
        />
        {/* Solar Values */}
        <TooltipHeader title={"Solar"} icon={<SolarIcon24 />} />
        <TooltipRow
          name="solar_generation"
          generationType={"solar"}
          dataType={"generation"}
          payload={payload}
        />
        <TooltipRow
          name="solar_forecast_past"
          generationType={"solar"}
          dataType={"forecast"}
          payload={payload}
        />
        <TooltipRow
          name="solar_forecast_future"
          generationType={"solar"}
          dataType={"forecast"}
          payload={payload}
        />
      </div>
    );
  };

  const CustomizedLabel: FC<any> = ({
    value,
    offset,
    viewBox: { x },
    className,
    solidLine,
    onClick,
  }) => {
    const yy = 25;
    return (
      <g>
        {/*<line*/}
        {/*  stroke="white"*/}
        {/*  strokeWidth={solidLine ? "2" : "1"}*/}
        {/*  strokeDasharray={solidLine ? "" : "3 3"}*/}
        {/*  fill="none"*/}
        {/*  fillOpacity="1"*/}
        {/*  x1={x}*/}
        {/*  y1={yy + 30}*/}
        {/*  x2={x}*/}
        {/*  y2={yy}*/}
        {/*></line>*/}
        <g className={`fill-white ${className || ""}`} onClick={onClick}>
          <rect
            x={x - 24}
            y={yy}
            width="48"
            height="21"
            offset={offset}
            fill={"inherit"}
          ></rect>
          <text
            x={x}
            y={yy + 15}
            fill="black"
            className="text-xs"
            id="time-now"
            textAnchor="middle"
          >
            {value}
          </text>
        </g>
      </g>
    );
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center bg-ocf-grey-800">
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <ResponsiveContainer>
          <ComposedChart
            // width={730}
            // height={550}
            data={formattedChartData}
            margin={{ top: 25, right: 30, left: 20, bottom: 25 }}
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
              tickFormatter={formatTick}
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
              content={(props) => <TooltipContent {...props} />}
            />
            <Area
              type="monotone"
              stackId={"1"}
              dataKey="solar_forecast_past"
              stroke={theme.extend.colors["ocf-yellow"].DEFAULT || "#FFD053"}
              strokeWidth={2}
              fillOpacity={0.6}
              fill={theme.extend.colors["ocf-yellow"].DEFAULT || "#FFD053"}
            />
            <Area
              type="monotone"
              stackId={"1"}
              dataKey="solar_forecast_future"
              stroke={theme.extend.colors["ocf-yellow"].DEFAULT || "#FFD053"}
              strokeWidth={2}
              strokeDasharray={"10 5"}
              // strokeOpacity={0.75}
              fill={theme.extend.colors["ocf-yellow"].DEFAULT || "#FFD053"}
              fillOpacity={0.3}
            />
            <Area
              type="monotone"
              stackId={"1"}
              dataKey="wind_forecast_past"
              stroke={theme.extend.colors["ocf-blue"].DEFAULT || "#48B0DF"}
              strokeWidth={2}
              fill={theme.extend.colors["ocf-blue"].DEFAULT || "#48B0DF"}
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              stackId={"1"}
              dataKey="wind_forecast_future"
              stroke={theme.extend.colors["ocf-blue"].DEFAULT || "#48B0DF"}
              strokeWidth={2}
              strokeDasharray={"10 5"}
              // strokeOpacity={0.75}
              fill={theme.extend.colors["ocf-blue"].DEFAULT || "#48B0DF"}
              fillOpacity={0.3}
            />
            <Area
              type="monotone"
              stackId={"2"}
              dataKey="solar_generation"
              stroke={"#ffffff"}
              connectNulls={true}
              fillOpacity={0}
            />
            <Area
              type="monotone"
              stackId={"2"}
              dataKey="wind_generation"
              stroke="#ffffff"
              connectNulls={true}
              fillOpacity={0}
            />
            <ReferenceLine
              x={getEpochNowInTimezone()}
              label={
                <CustomizedLabel
                  className={`fill-white cursor-pointer text-sm`}
                  solidLine={true}
                  value={prettyPrintNowTime()}
                />
              }
              // label={prettyPrintNowTime()}
              offset={"20"}
              stroke="white"
              strokeWidth={2}
              strokeDasharray={"20 5"}
              strokeOpacity={0.75}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Charts;
