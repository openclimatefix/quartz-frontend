"use client";

import Sidebar from "@/src/components/Sidebar";
import Charts from "@/src/components/charts/Charts";
import useGlobalState from "@/src/components/helpers/globalState";
import {
  useGetForecastedGenerationForRegionQuery,
  useGetGenerationForRegionQuery,
  useGetRegionsQuery
} from "@/src/hooks/queries";
import { CombinedData } from "@/src/types/data";
import { useEffect, useMemo } from "react";

export const Main = () => {
  const [combinedData, setCombinedData] = useGlobalState("combinedData");
  const [forecastHorizon] = useGlobalState("forecastHorizon");
  const [forecastHorizonMinutes] = useGlobalState("forecastHorizonMinutes");

  const {
    data: solarRegionsData,
    isLoading: solarRegionsLoading,
    error: solarRegionsError
  } = useGetRegionsQuery("solar");

  const {
    data: windRegionsData,
    isLoading: windRegionsLoading,
    error: windRegionsError
  } = useGetRegionsQuery("wind");

  const {
    data: solarGenerationData,
    isLoading: solarGenerationLoading,
    error: solarGenerationError
  } = useGetGenerationForRegionQuery(
    "solar",
    solarRegionsData?.regions[0] || "",
    !!solarRegionsData?.regions[0]
  );
  const {
    data: windGenerationData,
    isLoading: windGenerationLoading,
    error: windGenerationError
  } = useGetGenerationForRegionQuery(
    "wind",
    windRegionsData?.regions[0] || "",
    !!windRegionsData?.regions[0]
  );

  // Get forecast data
  const {
    data: solarForecastData,
    isLoading: solarForecastLoading,
    error: solarForecastError
  } = useGetForecastedGenerationForRegionQuery(
    "solar",
    solarRegionsData?.regions[0] || "",
    !!solarRegionsData?.regions[0],
    forecastHorizon,
    forecastHorizonMinutes
  );
  const {
    data: windForecastData,
    isLoading: windForecastLoading,
    error: windForecastError
  } = useGetForecastedGenerationForRegionQuery(
    "wind",
    windRegionsData?.regions[0] || "",
    !!windRegionsData?.regions[0],
    forecastHorizon,
    forecastHorizonMinutes
  );

  const latestCombinedData: CombinedData = useMemo(() => {
    return {
      solarGenerationData,
      windGenerationData,
      solarForecastData,
      windForecastData
    };
  }, [solarGenerationData, windGenerationData, solarForecastData, windForecastData]);

  useEffect(() => {
    console.log("combinedData updated", latestCombinedData);
    setCombinedData(latestCombinedData);
  }, [setCombinedData, latestCombinedData]);

  const isLoading = useMemo(() => {
    return (
      solarForecastLoading ||
      windForecastLoading ||
      solarGenerationLoading ||
      windGenerationLoading ||
      solarRegionsLoading ||
      windRegionsLoading
    );
  }, [
    solarForecastLoading,
    windForecastLoading,
    solarGenerationLoading,
    windGenerationLoading,
    solarRegionsLoading,
    windRegionsLoading
  ]);

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
    return (
      <div className="text-white flex items-center justify-center absolute inset-0">
        An error has occurred. Please refresh, or try again shortly.
      </div>
    );
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
      <Charts combinedData={combinedData} isLoading={isLoading} />
    </>
  );
};
