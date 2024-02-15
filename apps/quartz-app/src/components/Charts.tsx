"use client";
import { useGetRegionsQuery } from "@/src/hooks/queries";
import { components } from "@/src/types/schema";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Area,
} from "recharts";
// @ts-ignore
import { theme } from "@/tailwind.config";

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
    const date = new Date(time);
    return date.getTime();
  };

  const formatDate = (time: number) => {
    const date = new Date(time);
    return date.toLocaleString();
  };

  const formattedGenerationData: {
    timestamp: number;
    solar_generation?: number;
    wind_generation?: number;
    solar_forecast?: number;
    wind_forecast?: number;
  }[] =
    solarGenerationData?.values.map((value) => {
      return {
        timestamp: convertDatestampToEpoch(value.Time),
        solar_generation: value.PowerKW / 1000,
      };
    }) || [];
  // Loop through wind generation and add to formattedSolarData
  if (windGenerationData?.values) {
    for (const value of windGenerationData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const solarData = formattedGenerationData?.find(
        (data) => data.timestamp === timestamp
      );
      if (solarData) {
        solarData.wind_generation = value.PowerKW / 1000;
      } else {
        formattedGenerationData?.push({
          timestamp,
          wind_generation: value.PowerKW / 1000,
        });
      }
    }
  }
  // Loop through solar forecast and add to formattedSolarData
  if (solarForecastData?.values) {
    for (const value of solarForecastData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const solarData = formattedGenerationData?.find(
        (data) => data.timestamp === timestamp
      );
      if (solarData) {
        solarData.solar_forecast = value.PowerKW;
      } else {
        formattedGenerationData?.push({
          timestamp,
          solar_forecast: value.PowerKW,
        });
      }
    }
  }

  // Loop through wind forecast and add to formattedSolarData
  if (windForecastData?.values) {
    for (const value of windForecastData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const solarData = formattedGenerationData?.find(
        (data) => data.timestamp === timestamp
      );
      if (solarData) {
        solarData.wind_forecast = value.PowerKW;
      } else {
        formattedGenerationData?.push({
          timestamp,
          wind_forecast: value.PowerKW,
        });
      }
    }
  }

  console.log("formattedGenerationData", formattedGenerationData);
  const now = new Date();
  const offsets = [-24, -18, -12, -6, 0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60];
  const ticks = offsets.map((o) => {
    return new Date(now).setHours(o, 0, 0, 0);
  });

  return (
    <div className="flex-1 flex flex-col justify-center items-center bg-ocf-grey-800">
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <ResponsiveContainer>
          <ComposedChart
            title={"Solar Generation"}
            // width={730}
            // height={550}
            data={formattedGenerationData}
            margin={{ top: 25, right: 30, left: 20, bottom: 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              interval={11}
              // type={"number"}
              // domain={["auto", "auto"]}
              tickFormatter={formatDate}
              scale={"time"}
              tickCount={5}
              ticks={ticks}
              tick={{ fill: "white", style: { fontSize: "12px" } }}
            />
            <YAxis tick={{ fill: "white", style: { fontSize: "12px" } }} />
            <Tooltip
              content={({ payload, label }) => {
                return (
                  <div className="flex flex-col bg-gray-900/50 text-white px-3 py-2">
                    <span>{formatDate(label)}</span>
                    {payload?.map((item) => (
                      <span key={`TooltipKey-${item.dataKey}-${item.name}`}>
                        {item.name}: {item.value}
                      </span>
                    ))}
                  </div>
                );
              }}
            />
            <Legend />
            <Area
              type="monotone"
              stackId={"1"}
              dataKey="solar_forecast"
              stroke={theme.extend.colors["ocf-yellow"].DEFAULT || "#FFD053"}
              strokeWidth={2}
              fillOpacity={0.75}
              fill={theme.extend.colors["ocf-yellow"].DEFAULT || "#FFD053"}
            />
            <Area
              type="monotone"
              stackId={"1"}
              dataKey="wind_forecast"
              stroke={theme.extend.colors["ocf-blue"].DEFAULT || "#48B0DF"}
              strokeWidth={2}
              fillOpacity={0.75}
              fill={theme.extend.colors["ocf-blue"].DEFAULT || "#48B0DF"}
            />
            <Area
              type="monotone"
              stackId={"2"}
              dataKey="solar_generation"
              stroke={"#ffffff"}
              fillOpacity={0}
            />
            <Area
              type="monotone"
              stackId={"2"}
              dataKey="wind_generation"
              stroke="#ffffff"
              fillOpacity={0}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Charts;
