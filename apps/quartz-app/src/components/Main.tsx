"use client";

import Sidebar from "@/src/components/Sidebar";
import Charts from "@/src/components/charts/Charts";
import useGlobalState from "@/src/components/helpers/globalState";
import {
  useGetForecastedGenerationForRegionQuery,
  useGetGenerationForRegionQuery,
  useGetRegionsQuery,
} from "@/src/hooks/queries";
import { CombinedData } from "@/src/types/data";
import { useEffect, useMemo } from "react";

export const Main = () => {
  const [combinedData, setCombinedData] = useGlobalState("combinedData");

  const { data: solarRegionsData, error: solarRegionsError } =
    useGetRegionsQuery("solar");

  const { data: windRegionsData, error: windRegionsError } =
    useGetRegionsQuery("wind");

  const { data: solarGenerationData, error: solarGenerationError } =
    useGetGenerationForRegionQuery(
      "solar",
      solarRegionsData?.regions[0] || "",
      !!solarRegionsData?.regions[0]
    );
  const { data: windGenerationData, error: windGenerationError } =
    useGetGenerationForRegionQuery(
      "wind",
      windRegionsData?.regions[0] || "",
      !!windRegionsData?.regions[0]
    );

  // Get forecast data
  const { data: solarForecastData, error: solarForecastError } =
    useGetForecastedGenerationForRegionQuery(
      "solar",
      solarRegionsData?.regions[0] || "",
      !!solarRegionsData?.regions[0]
    );
  const { data: windForecastData, error: windForecastError } =
    useGetForecastedGenerationForRegionQuery(
      "wind",
      windRegionsData?.regions[0] || "",
      !!windRegionsData?.regions[0]
    );

  const latestCombinedData: CombinedData = useMemo(() => {
    return {
      solarGenerationData,
      windGenerationData,
      solarForecastData,
      windForecastData,
    };
  }, [
    solarGenerationData,
    windGenerationData,
    solarForecastData,
    windForecastData,
  ]);

  useEffect(() => {
    console.log("combinedData updated", latestCombinedData);
    setCombinedData(latestCombinedData);
  }, [latestCombinedData]);

  if (
    solarRegionsError ||
    windRegionsError ||
    solarGenerationError ||
    windGenerationError ||
    solarForecastError ||
    windForecastError
  ) {
    console.log(
      "error",
      solarRegionsError,
      windRegionsError,
      solarGenerationError,
      windGenerationError,
      solarForecastError,
      windForecastError
    );
    return <div>Error</div>;
  }

  return (
    <>
      <Sidebar
        title={"Rajasthan"}
        solarForecastData={solarForecastData}
        windForecastData={windForecastData}
        solarGenerationData={solarGenerationData}
        windGenerationData={windGenerationData}
      />
      <Charts combinedData={combinedData} />
    </>
  );
};
