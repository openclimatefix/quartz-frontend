import { components } from "../../types/quartz-api";
import { CombinedData, GspDeltaValue, GspZoneGroupings, MapFeatureObject } from "../types";
import { Feature, FeatureCollection, GeoJsonProperties, Geometry, Position } from "geojson";
import gspShapeData from "../../data/gsp_regions_20220314.json";
import dnoShapeData from "../../data/dno_regions_lat_long_converted.json";
import nationalShapeData from "../../data/national_gsp_shape.json";
import ngGSPZoneGroupings from "../../data/ng_gsp_zone_groupings.json";
import dnoGspGroupings from "../../data/dno_gsp_groupings.json";
import nationalGspZone from "../../data/national_gsp_zone.json";
import ngZones from "../../data/ng_zones.json";
import { formatISODateString, getOpacityValueFromPVNormalized, getRoundedPv } from "./utils";
import { get30MinNow } from "./globalState";
import { NationalAggregation, SelectedData } from "../map/types";

const getGspActualValueMwForTime = (
  gspRealData: components["schemas"]["GSPYieldGroupByDatetime"][],
  targetTime: string,
  gspId: number
) => {
  return (
    Number(
      gspRealData?.find((realData) => realData.datetimeUtc.slice(0, 16) === targetTime)
        ?.generationKwByGspId?.[String(gspId)]
    ) / 1000
  );
};
const getGspForecastForTime = (
  gspForecastsDataByTimestamp: components["schemas"]["OneDatetimeManyForecastValues"][],
  targetTime: string
) => {
  return gspForecastsDataByTimestamp.find((fc) => fc.datetimeUtc.slice(0, 16) === targetTime);
};
const setFeatureObjectProps = (
  existingProperties: any,
  gspSystemInfo: any,
  selectedFCValue: number | undefined,
  selectedActualValueMW: number | undefined,
  roundingFactor: number = 100
) => {
  return {
    ...existingProperties,
    [SelectedData.expectedPowerGenerationMegawatts]:
      selectedFCValue && getRoundedPv(selectedFCValue, false, roundingFactor),
    [SelectedData.expectedPowerGenerationMegawattsRounded]:
      selectedFCValue && getRoundedPv(selectedFCValue, true, roundingFactor),
    [SelectedData.expectedPowerGenerationNormalized]:
      selectedFCValue &&
      getOpacityValueFromPVNormalized(
        (selectedFCValue || 0) / (gspSystemInfo?.installedCapacityMw || 1) || 0,
        false
      ),
    [SelectedData.expectedPowerGenerationNormalizedRounded]:
      selectedFCValue &&
      getOpacityValueFromPVNormalized(
        (selectedFCValue || 0) / (gspSystemInfo?.installedCapacityMw || 1) || 0
      ),
    [SelectedData.actualPowerGenerationMegawatts]:
      selectedActualValueMW && getRoundedPv(Number(selectedActualValueMW), false, roundingFactor),
    [SelectedData.installedCapacityMw]: getRoundedPv(
      gspSystemInfo?.installedCapacityMw || 0,
      false,
      roundingFactor
    ),
    gspDisplayName: gspSystemInfo?.regionName || ""
  };
};

const mapGspFeatures: (
  features: Feature[],
  combinedData?: CombinedData,
  gspForecastsDataByTimestamp?: components["schemas"]["OneDatetimeManyForecastValues"][],
  targetTime?: string,
  gspDeltas?: Map<string, GspDeltaValue>
) => Feature[] = (
  features,
  combinedData,
  gspForecastsDataByTimestamp = [],
  targetTime,
  gspDeltas
) => {
  return features.map((featureObj, index) => {
    const gspSystemInfo = combinedData?.allGspSystemData?.find(
      (system) => system.gspId === index + 1
    );
    let selectedFC;
    let selectedFCValue;
    let selectedActualValueMW: number | undefined;
    const gspRealData =
      combinedData?.allGspRealData as components["schemas"]["GSPYieldGroupByDatetime"][];
    // If targetTime selected on chart, find the forecast/actuals data for that time
    if (gspForecastsDataByTimestamp && targetTime) {
      selectedFC = getGspForecastForTime(
        gspForecastsDataByTimestamp,
        formatISODateString(targetTime)
      );
      if (selectedFC) selectedFCValue = selectedFC.forecastValues[index + 1];
      selectedActualValueMW = getGspActualValueMwForTime(
        gspRealData,
        formatISODateString(targetTime),
        index + 1
      );
    } else if (gspForecastsDataByTimestamp) {
      // If no targetTime selected, find the latest forecast/actuals data
      let latestTimestamp = get30MinNow();
      selectedFCValue = getGspForecastForTime(gspForecastsDataByTimestamp, latestTimestamp)
        ?.forecastValues[index];
      selectedActualValueMW = getGspActualValueMwForTime(gspRealData, latestTimestamp, index + 1);
    }

    // Update the feature object with the calculated forecast/actuals data
    const updatedFeatureObj: MapFeatureObject = {
      ...featureObj,
      properties: setFeatureObjectProps(
        { ...featureObj.properties, id: featureObj.properties?.gsp_id },
        gspSystemInfo,
        selectedFCValue,
        selectedActualValueMW
      )
    };
    if (gspDeltas) {
      const currentGspDelta: GspDeltaValue | undefined = gspDeltas.get(String(index + 1));
      updatedFeatureObj.properties = {
        ...updatedFeatureObj.properties,
        [SelectedData.expectedPowerGenerationMegawatts]: currentGspDelta?.delta || 0,
        [SelectedData.expectedPowerGenerationMegawattsRounded]: currentGspDelta?.delta || 0,
        [SelectedData.expectedPowerGenerationNormalized]:
          Number(currentGspDelta?.deltaNormalized) || 0,
        [SelectedData.expectedPowerGenerationNormalizedRounded]:
          Number(currentGspDelta?.deltaNormalized) || 0,
        [SelectedData.delta]: currentGspDelta?.delta || 0,
        deltaBucket: currentGspDelta?.deltaBucket || 0
      };
    }

    return updatedFeatureObj;
  });
};

const mapZoneFeatures: (
  features: Feature[],
  gspZoneGroupings: GspZoneGroupings,
  combinedData?: CombinedData,
  gspForecastsDataByTimestamp?: components["schemas"]["OneDatetimeManyForecastValues"][],
  targetTime?: string,
  gspDeltas?: Map<string, GspDeltaValue>,
  idKey?: string
) => Feature[] = (
  features,
  gspZoneGroupings,
  combinedData,
  gspForecastsDataByTimestamp = [],
  targetTime,
  gspDeltas,
  idKey = "id"
) => {
  if (!targetTime) return [];
  // Loop through ng_zones data and aggregate the forecast and actuals
  const newFeatures: Feature[] = features.map((feature) => {
    const zoneId = feature.properties?.[idKey as keyof typeof gspZoneGroupings];
    if (!zoneId) return feature;
    const zoneGspIds: number[] = gspZoneGroupings[zoneId as keyof typeof gspZoneGroupings];
    if (!zoneGspIds) return feature;
    let zoneForecastTotal = 0;
    let zoneActualTotal = 0;
    let zoneInstalledCapacity = 0;
    zoneGspIds.forEach((gsp: number) => {
      zoneForecastTotal +=
        gspForecastsDataByTimestamp.find(
          (fc) => fc.datetimeUtc.slice(0, 16) === formatISODateString(targetTime)
        )?.forecastValues[gsp] || 0;
      zoneActualTotal += getGspActualValueMwForTime(
        combinedData?.allGspRealData as components["schemas"]["GSPYieldGroupByDatetime"][],
        formatISODateString(targetTime),
        gsp
      );
      zoneInstalledCapacity += Number(
        combinedData?.allGspSystemData?.find((system) => system.gspId === gsp)?.installedCapacityMw
      );
    });
    return {
      ...feature,
      id: zoneId,
      type: "Feature" as "Feature",
      properties: setFeatureObjectProps(
        { ...feature.properties, id: zoneId },
        { regionName: zoneId, installedCapacityMw: zoneInstalledCapacity },
        zoneForecastTotal,
        zoneActualTotal,
        1000
      )
    } as Feature<Geometry, GeoJsonProperties>;
  });

  // TODO Deltas

  return newFeatures;
};

/**
 * `generateGeoJsonForecastData` is a function that generates the GeoJson feature collection for forecast data.
 *
 * @param forecastData - An optional array of shapes representing different forecast values for a specific date and time.
 * @param targetTime - An optional String parameter that represents the time for which to generate the forecast data.
 * @param combinedData - An optional object that holds the combined data from different sources, the structure is defined by the `CombinedData` type.
 * @param gspDeltas - An optional Map where the keys are the GSP IDs and the values are `GspDeltaValue` objects.
 * @param aggregation - An optional NationalAggregation value to aggregate the data to a specific level.
 *
 * @returns An object containing the generated feature collection under the `forecastGeoJson` property.
 *
 * @remarks
 * This function is used to generate the forecast data in GeoJson format which can be utilized in map-based visualizations.
 * It combines different provided data sources and for each feature in the gspShapeJson dataset, it finds the corresponding data from the forecasts and combines them into a new feature object with updated properties.
 * If a `gspDeltas` Map is provided, the function also includes the corresponding delta values in the properties of each feature object.
 * The function then returns an object with the entire FeatureCollection of updated feature objects.
 */
export const generateGeoJsonForecastData: (
  forecastData?: components["schemas"]["OneDatetimeManyForecastValues"][],
  targetTime?: string,
  combinedData?: CombinedData,
  gspDeltas?: Map<string, GspDeltaValue>,
  aggregation?: NationalAggregation
) => { forecastGeoJson: FeatureCollection } = (
  forecastData,
  targetTime,
  combinedData,
  gspDeltas,
  aggregation = NationalAggregation.GSP
) => {
  console.log("aggregation", aggregation);
  const gspForecastsDataByTimestamp = forecastData || [];
  const gspShapeJson = gspShapeData as FeatureCollection;
  let features = gspShapeJson.features;
  if (aggregation === NationalAggregation.GSP) {
    features = mapGspFeatures(
      gspShapeJson.features,
      combinedData,
      gspForecastsDataByTimestamp,
      targetTime,
      gspDeltas
    );
  } else if (aggregation === NationalAggregation.zone) {
    console.log("aggregating to zone");
    features = mapZoneFeatures(
      ngZones.features as Feature<Geometry, GeoJsonProperties>[],
      ngGSPZoneGroupings,
      combinedData,
      gspForecastsDataByTimestamp,
      targetTime
    );
  } else if (aggregation === NationalAggregation.DNO) {
    console.log("aggregating to DNO");
    const dnoShapeJson = dnoShapeData as FeatureCollection;
    features = mapZoneFeatures(
      dnoShapeJson.features as Feature<Geometry, GeoJsonProperties>[],
      dnoGspGroupings,
      combinedData,
      gspForecastsDataByTimestamp,
      targetTime,
      undefined,
      "LongName"
    );
  } else if (aggregation === NationalAggregation.national) {
    console.log("aggregating to national");
    const nationalShapeJson = nationalShapeData as FeatureCollection;
    features = mapZoneFeatures(
      nationalShapeJson.features as Feature<Geometry, GeoJsonProperties>[],
      nationalGspZone,
      combinedData,
      gspForecastsDataByTimestamp,
      targetTime
    );
  }
  const forecastGeoJson = {
    type: "FeatureCollection" as "FeatureCollection",
    features
  };

  return { forecastGeoJson };
};

/**
 * This function filters an array of historic data elements based on a specified date-time range.
 *
 * @template T - The type of the elements in the array to be filtered. This type must include a `datetimeUtc` string value and may optionally include `generationKwByGspId` and `forecastValues` fields.
 * @param {T[]} data - The array of data to be filtered.
 * @param {string} filterHistoricStart - The start point (ISO DateTime string) of the date-time range within which data elements are considered for inclusion.
 * @param {string} prev30MinFromNowISO - The end point (ISO DateTime string) of the date-time range within which data elements are considered for inclusion.
 *
 * @returns {T[]} - Returns a new array containing only the elements from the original `data` array that fall within the specified date-time range.
 *
 * Note: This function treats any `datetimeUtc` values that are equal to `prev30MinFromNowISO` as falling within the range.
 *
 * Example Usage:
 * ```typescript
 * filterCompactHistoricData<
 *   components["schemas"]["OneDatetimeManyForecastValues"]
 * >(
 *   allGspForecastHistoricalDataCompact,
 *   "2023-12-05T17:00:00+00:00",
 *   "2023-12-07T14:00:00+00:00"
 * );
 * ```
 */
export const filterCompactHistoricData = <
  T extends { datetimeUtc: string; generationKwByGspId?: any; forecastValues?: any }
>(
  data: T[],
  filterHistoricStart: string,
  prev30MinFromNowISO: string
): T[] => {
  return (
    data?.filter((fc) => {
      if (!filterHistoricStart) return false;

      if (fc.datetimeUtc < filterHistoricStart) return false;

      return fc.datetimeUtc <= `${prev30MinFromNowISO}`;
    }) || []
  );
};

/**
 *
 * Filters future data from a compacted forecast array.
 *
 * This function returns a subset of the original data that has a `datetimeUtc` which is greater than `prev30MinFromNowISO`.
 *
 * If `prev30MinFromNowISO` is not set or empty, this function will always return an empty array.
 *
 * @template T - a generic type that extends a shape with a `datetimeUtc` property and optionally
 *              `generationKwByGspId` and `forecastValues` properties.
 *
 * @param {T[]} data - The forecast array. Each element must be of the provided generic type
 *                     which should include at least a `datetimeUtc` property.
 *
 * @param {string} prev30MinFromNowISO - The boundary datetime in ISO format.
 *                                       Items in the `data` whose `datetimeUtc` are strictly after this time will be included in the output.
 *
 * @returns {T[]} - the subset of the `data` array that falls within provided parameters.
 *
 * @example
 * // Filtering future data
 * const forecastData = [
 *   { datetimeUtc: '2023-12-05T12:00:00+00:00', forecastValues: { '1': 1 }, generationKwByGspId: { '1': 1 } },
 *   { datetimeUtc: '2023-12-06T12:00:00+00:00', forecastValues: { '2': 2 }, generationKwByGspId: { '2': 2 } }
 * ]
 * const futureData = filterCompactFutureData(forecastData, '2023-12-06T00:00:00+00:00');
 * console.log(futureData); // Outputs: [{ datetimeUtc: '2023-12-06T12:00:00+00:00', forecastValues: { '2': 2 }, generationKwByGspId: { '2': 2 } }]
 */
export const filterCompactFutureData = <
  T extends { datetimeUtc: string; generationKwByGspId?: any; forecastValues?: any }
>(
  data: T[],
  prev30MinFromNowISO: string
): T[] => {
  return data.filter((fc) => {
    if (!prev30MinFromNowISO) return false;

    return fc.datetimeUtc > `${prev30MinFromNowISO}`;
  });
};

/**
 * This function gets the oldest date-time from an array of objects.
 *
 * The function accepts an array of objects, where each object `T`
 * needs at least one property `datetimeUtc` defined as a string.
 * In the array provided, objects can also optionally include properties `generationKwByGspId` and `forecastValues`.
 *
 * The function then sorts these objects based on the `datetimeUtc` property,
 * and returns the oldest (i.e., earliest) date-time string.
 * If the array is empty or no date-time is found, it defaults to return an empty string.
 *
 * @template T A type constraint that extends at least to objects having a `datetimeUtc` property.
 *
 * @example
 * // data set with dates
 * const data = [
 *   { datetimeUtc: "2023-12-25", ... },
 *   { datetimeUtc: "2023-12-24", ... },
 *   { datetimeUtc: "2023-12-26", ... }
 * ];
 * console.log(getOldestTimestampFromCompactForecastValues(data));
 * // Output: "2023-12-24"
 *
 * @param {T[]} data An array of objects containing at least the `datetimeUtc` property.
 *
 * @returns {string} The oldest date-time as a string, or an empty string if no date-time is found.
 */
export const getOldestTimestampFromCompactForecastValues = <
  T extends { datetimeUtc: string; generationKwByGspId?: any; forecastValues?: any }
>(
  data: T[]
): string => {
  return (
    data.sort((a, b) => {
      return a.datetimeUtc > b.datetimeUtc ? 1 : -1;
    })?.[0]?.datetimeUtc || ""
  );
};

const MILLISECONDS_PER_MINUTE = 1000 * 60;

/**
 * This function calculates the difference (interval duration) in minutes between two dates.
 * Specifically, it subtracts the timestamp of `dateTwo` from `dateOne` to get the difference in milliseconds
 * and then converts this into minutes.
 *
 * Note: This function makes use of the JavaScript `Date` object's `getTime` method, which gets
 * the number of milliseconds since the Unix Epoch (1970-01-01 00:00:00 UTC).
 * This is used to ensure an accurate and standardised measurement of time between the two dates provided.
 *
 * This function is used in conjunction with other datetime processing functions such as `calculateHistoricDataStartIntervalInMinutes`,
 * `getOldestTimestampFromCompactForecastValues`, `get30MinNow`, and `getNext30MinSlot` to process and analyze interval data.
 *
 * @example
 * const dateOne = new Date("2023-12-25T23:30:00");
 * const dateTwo = new Date("2023-12-25T23:00:00");
 * console.log(calculateIntervalDuration(dateOne, dateTwo));
 * // Output: 30
 *
 * @param {Date} dateOne The first date from which to measure the interval.
 * @param {Date} dateTwo The second date to which the interval is measured.
 *
 * @returns {number} The interval duration in minutes.
 */
const calculateIntervalDuration = (dateOne: Date, dateTwo: Date): number => {
  const durationMilliseconds = dateOne.getTime() - dateTwo.getTime();
  return durationMilliseconds / MILLISECONDS_PER_MINUTE;
};

/**
 * This function calculates the backward historical interval in minutes.
 *
 * Given an array `data` of objects `T` where each object has a `datetimeUtc` field
 * (and optional `generationKwByGspId` and `forecastValues`), it determines the
 * oldest timestamp using the `getOldestTimestampFromCompactForecastValues` method.
 * It then creates a comparison date that is a rounded up 30 minutes from now
 * (using `get30MinNow` with an offset of -30 minutes). The interval duration
 * between the oldest timestamp and the comparison date is then calculated using
 * `calculateIntervalDuration`, and returned.
 *
 * If no oldest timestamp can be derived from the input data, the function defaults
 * to returning `0`.
 *
 * @template T The object type which must include a `datetimeUtc` field and can
 * optionally include `generationKwByGspId` and `forecastValues` fields.
 *
 * @example
 * // Example data set
 * const data = [
 *   { datetimeUtc: "2023-12-24T22:00:00" },
 *   { datetimeUtc: "2023-12-24T23:00:00" },
 *   { datetimeUtc: "2023-12-25T00:00:00" }
 * ];
 * console.log(calculateHistoricDataStartIntervalInMinutes(data));
 * // Output: 30 (assuming current time is 2023-12-25T00:30:00)
 *
 * @param {T[]} data An array of objects `T` that includes a `datetimeUtc` field.
 *
 * @returns {number} The calculated interval duration in minutes, or `0` if no oldest timestamp is found.
 */
export const calculateHistoricDataStartIntervalInMinutes = <
  T extends {
    datetimeUtc: string;
    generationKwByGspId?: any;
    forecastValues?: any;
  }
>(
  data: T[]
): number => {
  const oldestTimestamp = getOldestTimestampFromCompactForecastValues(data);
  if (!oldestTimestamp) return 0;

  const oldestDate = new Date(oldestTimestamp);
  const comparisonDate = new Date(get30MinNow(-30));
  return calculateIntervalDuration(oldestDate, comparisonDate);
};
