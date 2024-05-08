"use client";
import Image from "next/image";
import Sidebar from "../src/components/Sidebar";
import Charts from "../src/components/charts/Charts";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { GET_REGIONS, getRegionsQuery } from "@/src/data/queries";
import {
  useGetForecastedGenerationForRegionQuery,
  useGetGenerationForRegionQuery,
  useGetRegionsQuery,
} from "@/src/hooks/queries";
import { CombinedData } from "@/src/types/data";
import { useEffect, useMemo } from "react";
import useGlobalState from "@/src/components/helpers/globalState";

export default function Home() {
  const [combinedData, setCombinedData] = useGlobalState("combinedData");

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
        refetchInterval: 60 * 1000,
      },
    }, //
  });

  queryClient.prefetchQuery({
    queryKey: [GET_REGIONS, "solar"],
    queryFn: () => getRegionsQuery("solar"),
  });

  const { data: solarRegionsData, error: solarRegionsError } =
    useGetRegionsQuery("solar");
  console.log("page solarRegionsData", solarRegionsData);

  const { data: windRegionsData, error: windRegionsError } =
    useGetRegionsQuery("wind");
  console.log("page windRegionsData", windRegionsData);

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

  console.log("page solarGenerationData", solarGenerationData);
  console.log("page windGenerationData", windGenerationData);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="flex min-h-screen bg-ocf-gray-900 flex-row items-stretch justify-between pt-16">
        <Sidebar
          title={"Rajasthan"}
          solarForecastData={solarForecastData}
          windForecastData={windForecastData}
          solarGenerationData={solarGenerationData}
          windGenerationData={windGenerationData}
        />
        <Charts combinedData={combinedData} />
      </main>
    </HydrationBoundary>
  );
}
