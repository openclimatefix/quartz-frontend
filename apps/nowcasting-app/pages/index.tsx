import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import Layout from "../components/layout/layout";
import { PvLatestMap } from "../components/map";
import SideLayout from "../components/side-layout";
import PvRemixChart from "../components/charts/pv-remix-chart";
import useAndUpdateSelectedTime from "../components/hooks/use-and-update-selected-time";
import React, { useEffect, useMemo, useState } from "react";
import Header from "../components/layout/header";
import ForecastHeader from "../components/charts/forecast-header";
import DeltaViewChart from "../components/charts/delta-view/delta-view-chart";
import { API_PREFIX, getAllForecastUrl, VIEWS } from "../constant";
import useGlobalState from "../components/helpers/globalState";
import useSWRImmutable from "swr/immutable";
import {
  AllGspRealData,
  CombinedData,
  CombinedErrors,
  FcAllResData,
  ForecastData,
  ForecastValue,
  GspAllForecastData,
  GspRealData,
  National4HourData,
  PvRealData
} from "../components/types";
import { axiosFetcherAuth, formatISODateString, getDeltaBucket } from "../components/helpers/utils";
import useSWR from "swr";
import { ActiveUnit } from "../components/map/types";
import DeltaMap from "../components/map/deltaMap";

export default function Home() {
  useAndUpdateSelectedTime();
  const [view, setView] = useState<VIEWS>(VIEWS.FORECAST);
  const [activeUnit, setActiveUnit] = useState<ActiveUnit>(ActiveUnit.MW);
  const [show4hView] = useGlobalState("show4hView");
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());

  // Assuming first item in the array is the latest
  const useGetForecastsData = (isNormalized: boolean) => {
    const [forecastLoading, setForecastLoading] = useState(true);
    const [, setForecastCreationTime] = useGlobalState("forecastCreationTime");
    const bareForecastData = useSWRImmutable<FcAllResData>(
      () => getAllForecastUrl(false, false),
      axiosFetcherAuth,
      {
        onSuccess: (data) => {
          if (data.forecasts?.length)
            setForecastCreationTime(data.forecasts[0].forecastCreationTime);
          setForecastLoading(false);
        }
      }
    );

    const allForecastData = useSWR<FcAllResData>(
      () => getAllForecastUrl(true, true),
      axiosFetcherAuth,
      {
        refreshInterval: 1000 * 60 * 5, // 5min
        isPaused: () => forecastLoading,
        onSuccess: (data) => {
          setForecastCreationTime(data.forecasts[0].forecastCreationTime);
        }
      }
    );
    useEffect(() => {
      if (!forecastLoading) {
        allForecastData.mutate();
      }
    }, [forecastLoading]);

    if (isNormalized) return allForecastData;
    else return allForecastData.data ? allForecastData : bareForecastData;
  };

  const { data: nationalForecastData, error: nationalForecastError } = useSWR<ForecastData>(
    `${API_PREFIX}/solar/GB/national/forecast?historic=false&only_forecast_values=true`,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );
  const { data: pvRealDayInData, error: pvRealDayInError } = useSWR<PvRealData>(
    `${API_PREFIX}/solar/GB/national/pvlive?regime=in-day`,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );
  const { data: pvRealDayAfterData, error: pvRealDayAfterError } = useSWR<PvRealData>(
    `${API_PREFIX}/solar/GB/national/pvlive?regime=day-after`,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );
  const { data: national4HourData, error: national4HourError } = useSWR<National4HourData>(
    show4hView
      ? `${API_PREFIX}/solar/GB/national/forecast?forecast_horizon_minutes=240&historic=true&only_forecast_values=true`
      : null,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );
  const { data: allGspForecastData, error: allGspForecastError } = useSWR<GspAllForecastData>(
    `${API_PREFIX}/solar/GB/gsp/forecast/all/?historic=true`,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );
  const { data: allGspRealData, error: allGspRealError } = useSWR<AllGspRealData>(
    `${API_PREFIX}/solar/GB/gsp/pvlive/all?regime=in-day`,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );

  const currentYields =
    allGspRealData?.map((datum) => {
      const gspYield = datum.gspYields.find((yieldDatum, index) => {
        return yieldDatum.datetimeUtc === `${selectedTime}:00+00:00`;
      });
      return {
        gspId: datum.gspId,
        gspRegion: datum.regionName,
        gspCapacity: datum.installedCapacityMw,
        yield: gspYield?.solarGenerationKw || 0
      };
    }) || [];
  const gspDeltas = useMemo(() => {
    let tempGspDeltas = new Map();

    for (let i = 0; i < currentYields.length; i++) {
      const currentYield = currentYields[i];
      let gspForecastData = allGspForecastData?.forecasts[i];
      if (gspForecastData?.location.gspId !== currentYield.gspId) {
        gspForecastData = allGspForecastData?.forecasts.find((gspForecastDatum) => {
          return gspForecastDatum.location.gspId === currentYield.gspId;
        });
      }
      const currentGspForecast = gspForecastData?.forecastValues.find((forecastValue) => {
        return forecastValue.targetTime === `${selectedTime}:00+00:00`;
      });
      const delta =
        currentYield.yield / 1000 - (currentGspForecast?.expectedPowerGenerationMegawatts || 0);
      const deltaNormalized =
        (currentYield.yield / 1000 - (currentGspForecast?.expectedPowerGenerationMegawatts || 0)) /
          currentYield.gspCapacity || 0;
      tempGspDeltas.set(currentYield.gspId, {
        gspId: currentYield.gspId,
        gspRegion: currentYield.gspRegion,
        gspCapacity: currentYield.gspCapacity,
        currentYield: currentYield.yield / 1000,
        forecast: currentGspForecast?.expectedPowerGenerationMegawatts || 0,
        delta,
        deltaPercentage:
          (currentYield.yield /
            1000 /
            (currentGspForecast?.expectedPowerGenerationMegawatts || 0)) *
          100,
        deltaNormalized,
        deltaBucket: getDeltaBucket(delta)
      });
    }
    console.log("gspDeltas calculated");
    return tempGspDeltas;
  }, [allGspForecastData, allGspRealData, selectedTime]);

  const combinedData: CombinedData = {
    nationalForecastData,
    pvRealDayInData,
    pvRealDayAfterData,
    national4HourData,
    allGspForecastData,
    allGspRealData,
    gspDeltas
  };
  const combinedErrors: CombinedErrors = {
    nationalForecastError,
    pvRealDayInError,
    pvRealDayAfterError,
    national4HourError,
    allGspForecastError,
    allGspRealError
  };

  const currentView = (v: VIEWS) => v === view;
  return (
    <Layout>
      <div className="h-full relative pt-16">
        <Header view={view} setView={setView} />
        <div id="map-container" className={`relative float-right h-full`} style={{ width: "56%" }}>
          <PvLatestMap
            className={currentView(VIEWS.FORECAST) ? "" : "hidden"}
            getForecastsData={useGetForecastsData}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
          />
          <DeltaMap
            className={currentView(VIEWS.DELTA) ? "" : "hidden"}
            getForecastsData={useGetForecastsData}
            combinedData={combinedData}
            combinedErrors={combinedErrors}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
          />
        </div>

        <SideLayout>
          <PvRemixChart className={currentView(VIEWS.FORECAST) ? "" : "hidden"} />
          <DeltaViewChart
            combinedData={combinedData}
            combinedErrors={combinedErrors}
            className={currentView(VIEWS.DELTA) ? "" : "hidden"}
          />
        </SideLayout>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
