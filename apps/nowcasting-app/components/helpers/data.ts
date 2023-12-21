import { components } from "../../types/quartz-api";
import { Map } from "../map";
import { CombinedData, GspDeltaValue, MapFeatureObject } from "../types";
import { FeatureCollection } from "geojson";
import gspShapeData from "../../data/gsp_regions_20220314.json";
import { formatISODateString, getRoundedPv, getRoundedPvNormalized } from "./utils";
import { get30MinNow } from "./globalState";
import { SelectedData } from "../map/types";

export const generateGeoJsonForecastData: (
  forecastData?: components["schemas"]["OneDatetimeManyForecastValues"][],
  targetTime?: string,
  combinedData?: CombinedData,
  gspDeltas?: Map<string, GspDeltaValue>
) => { forecastGeoJson: FeatureCollection } = (
  forecastData,
  targetTime,
  combinedData,
  gspDeltas
) => {
  const gspForecastsDataByTimestamp = forecastData || [];
  const gspShapeJson = gspShapeData as FeatureCollection;
  const forecastGeoJson = {
    ...gspShapeData,
    type: "FeatureCollection" as "FeatureCollection",
    features: gspShapeJson.features.map((featureObj, index) => {
      const gspSystemInfo = combinedData?.allGspSystemData?.find(
        (system) => system.gspId === index + 1
      );
      let selectedFC;
      let selectedFCValue;
      if (gspForecastsDataByTimestamp && targetTime) {
        selectedFC = gspForecastsDataByTimestamp.find(
          (fc) => fc.datetimeUtc.slice(0, 16) === formatISODateString(targetTime)
        );
        if (selectedFC) selectedFCValue = selectedFC.forecastValues[index + 1];
      } else if (gspForecastsDataByTimestamp) {
        let latestTimestamp = get30MinNow();
        selectedFCValue = gspForecastsDataByTimestamp.find(
          (fc) => fc.datetimeUtc.slice(0, 16) === latestTimestamp
        )?.forecastValues[index];
      }

      const updatedFeatureObj: MapFeatureObject = {
        ...featureObj,
        properties: {
          ...featureObj.properties,
          [SelectedData.expectedPowerGenerationMegawatts]:
            selectedFCValue && getRoundedPv(selectedFCValue),
          [SelectedData.expectedPowerGenerationNormalized]:
            selectedFCValue &&
            getRoundedPvNormalized(
              (selectedFCValue || 0) / (gspSystemInfo?.installedCapacityMw || 1) || 0
            ),
          [SelectedData.installedCapacityMw]: getRoundedPv(gspSystemInfo?.installedCapacityMw || 0),
          gspDisplayName: gspSystemInfo?.regionName || ""
        }
      };
      if (gspDeltas) {
        const currentGspDelta: GspDeltaValue | undefined = gspDeltas.get(String(index + 1));
        updatedFeatureObj.properties = {
          ...updatedFeatureObj.properties,
          [SelectedData.expectedPowerGenerationMegawatts]: currentGspDelta?.delta || 0,
          [SelectedData.expectedPowerGenerationNormalized]:
            Number(currentGspDelta?.deltaNormalized) || 0,
          [SelectedData.delta]: currentGspDelta?.delta || 0,
          deltaBucket: currentGspDelta?.deltaBucket || 0
        };
      }

      return updatedFeatureObj;
    })
  };

  return { forecastGeoJson };
};

export const filterHistoricDataCompact = (
  data: components["schemas"]["OneDatetimeManyForecastValues"][],
  filterHistoricStart: string,
  prev30MinFromNowISO: string
) => {
  return (
    data?.filter((fc) => {
      if (!filterHistoricStart) return false;

      if (fc.datetimeUtc < filterHistoricStart) return false;

      return fc.datetimeUtc <= `${prev30MinFromNowISO}`;
    }) || []
  );
};

export const filterFutureDataCompact = (
  data: components["schemas"]["OneDatetimeManyForecastValues"][],
  prev30MinFromNowISO: string
) => {
  return data.filter((fc) => {
    if (!prev30MinFromNowISO) return false;

    return fc.datetimeUtc > `${prev30MinFromNowISO}`;
  });
};

export const getOldestTimestampFromCompactForecastValues = (
  data: components["schemas"]["OneDatetimeManyForecastValues"][]
) => {
  return data.sort((a, b) => {
    return a.datetimeUtc > b.datetimeUtc ? 1 : -1;
  })?.[0]?.datetimeUtc;
};

export const getHistoricBackwardIntervalMinutes = (
  data: components["schemas"]["OneDatetimeManyForecastValues"][]
) => {
  const oldestTimestamp = getOldestTimestampFromCompactForecastValues(data);
  const oldestDate = new Date(oldestTimestamp || "");
  const historicBackwardInterval = oldestDate.getTime() - new Date(get30MinNow(-30)).getTime();
  return historicBackwardInterval / 1000 / 60;
};
