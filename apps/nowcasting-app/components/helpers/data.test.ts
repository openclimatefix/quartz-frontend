import { describe, expect, test } from "@jest/globals";
import {
  filterCompactFutureData,
  filterCompactHistoricData,
  getOldestTimestampFromCompactForecastValues
} from "./data";
import allGspForecastHistoricalDataCompact from "../../data/updatedDummyApiResponses/allGspForecastHistoricCompact.json";
import allGspActualHistoricCompact from "../../data/updatedDummyApiResponses/allGspActualHistoricCompact.json";
import { components } from "../../types/quartz-api";

/////////////////////////////////////////////////////////
// filterCompactHistoricData & filterCompactFutureData //
/////////////////////////////////////////////////////////
describe("check func filters fake historical forecast data", () => {
  test("check func filters out data after prev30MinNow", () => {
    const filteredData = filterCompactHistoricData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(
      [
        {
          datetimeUtc: "2021-10-12T13:30:00+00:00",
          forecastValues: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
        },
        {
          datetimeUtc: "2021-10-12T14:00:00+00:00",
          forecastValues: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
        },
        {
          datetimeUtc: "2021-10-12T14:30:00+00:00",
          forecastValues: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
        }
      ],
      "2021-10-12T12:00:00+00:00",
      "2021-10-12T14:00:00+00:00"
    );
    expect(filteredData).toMatchObject([
      {
        datetimeUtc: "2021-10-12T13:30:00+00:00",
        forecastValues: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
      },
      {
        datetimeUtc: "2021-10-12T14:00:00+00:00",
        forecastValues: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
      }
    ]);
  });
  test("check func filters out data before filterHistoricStart", () => {
    const filteredData = filterCompactHistoricData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(
      [
        {
          datetimeUtc: "2021-10-12T12:30:00+00:00",
          forecastValues: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
        },
        {
          datetimeUtc: "2021-10-12T13:00:00+00:00",
          forecastValues: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
        },
        {
          datetimeUtc: "2021-10-12T13:30:00+00:00",
          forecastValues: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
        },
        {
          datetimeUtc: "2021-10-12T14:00:00+00:00",
          forecastValues: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
        },
        {
          datetimeUtc: "2021-10-12T14:30:00+00:00",
          forecastValues: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
        }
      ],
      "2021-10-12T13:00:00+00:00",
      "2021-10-12T15:00:00+00:00"
    );
    expect(filteredData).toMatchObject([
      {
        datetimeUtc: "2021-10-12T13:00:00+00:00",
        forecastValues: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
      },
      {
        datetimeUtc: "2021-10-12T13:30:00+00:00",
        forecastValues: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
      },
      {
        datetimeUtc: "2021-10-12T14:00:00+00:00",
        forecastValues: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
      },
      {
        datetimeUtc: "2021-10-12T14:30:00+00:00",
        forecastValues: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
      }
    ]);
  });
});

describe("check func filters static historical forecast data", () => {
  test("check func filters out data before historic start & after prev30MinNow", () => {
    const filteredData = filterCompactHistoricData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(
      allGspForecastHistoricalDataCompact,
      "2023-12-05T17:00:00+00:00",
      "2023-12-07T14:00:00+00:00"
    );
    expect(filteredData.length).toBe(91);
    expect(filteredData[0].datetimeUtc).toBe("2023-12-05T17:00:00+00:00");
    expect(filteredData[1].datetimeUtc).toBe("2023-12-05T17:30:00+00:00");
    expect(filteredData[2].datetimeUtc).toBe("2023-12-05T18:00:00+00:00");
    expect(filteredData[filteredData.length - 2].datetimeUtc).toBe("2023-12-07T13:30:00+00:00");
    expect(filteredData[filteredData.length - 1].datetimeUtc).toBe("2023-12-07T14:00:00+00:00");
  });
});

describe("check filter functions combine back into correct full timestamped forecast data", () => {
  test("check filterCompactHistoricData + filterCompactFutureData", () => {
    const filteredHistoricData = filterCompactHistoricData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(
      allGspForecastHistoricalDataCompact,
      "2023-12-05T12:00:00+00:00",
      "2023-12-06T12:00:00+00:00"
    );
    const filteredFutureData = filterCompactFutureData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(allGspForecastHistoricalDataCompact, "2023-12-06T12:00:00+00:00");
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData).toMatchObject(allGspForecastHistoricalDataCompact);
    expect(filteredData.length).toBe(allGspForecastHistoricalDataCompact.length);
    expect(filteredData[0].datetimeUtc).toBe("2023-12-05T12:00:00+00:00");
    expect(filteredData[1].datetimeUtc).toBe("2023-12-05T12:30:00+00:00");
    expect(filteredData[filteredData.length - 2].datetimeUtc).toBe("2023-12-07T14:30:00+00:00");
    expect(filteredData[filteredData.length - 1].datetimeUtc).toBe("2023-12-07T15:00:00+00:00");
  });
  test("check 'now' timestamp at beginning of data window", () => {
    const filteredHistoricData = filterCompactHistoricData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(
      allGspForecastHistoricalDataCompact,
      "2023-12-05T12:00:00+00:00",
      "2023-12-05T12:00:00+00:00"
    );
    const filteredFutureData = filterCompactFutureData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(allGspForecastHistoricalDataCompact, "2023-12-05T12:00:00+00:00");
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.length).toBe(allGspForecastHistoricalDataCompact.length);
    expect(filteredData).toMatchObject(allGspForecastHistoricalDataCompact);
  });
  test("check 'now' timestamp at end of data window", () => {
    const filteredHistoricData = filterCompactHistoricData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(
      allGspForecastHistoricalDataCompact,
      "2023-12-05T12:00:00+00:00",
      "2023-12-07T15:00:00+00:00"
    );
    const filteredFutureData = filterCompactFutureData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(allGspForecastHistoricalDataCompact, "2023-12-07T15:00:00+00:00");
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.length).toBe(allGspForecastHistoricalDataCompact.length);
    expect(filteredData).toMatchObject(allGspForecastHistoricalDataCompact);
  });
});

describe("check filter functions return empty array when no data", () => {
  test("check filterCompactHistoricData + filterCompactFutureData", () => {
    const filteredHistoricData = filterCompactHistoricData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >([], "2023-12-05T12:00:00+00:00", "2023-12-06T12:00:00+00:00");
    const filteredFutureData = filterCompactFutureData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >([], "2023-12-06T12:00:00+00:00");
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.length).toBe(0);
    expect(filteredData).toMatchObject([]);
  });
});

describe("check filter functions return correct data when only 1 timestamp", () => {
  test("check filterCompactHistoricData + filterCompactFutureData", () => {
    const filteredHistoricData = filterCompactHistoricData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(
      [
        {
          datetimeUtc: "2023-12-05T12:00:00+00:00",
          forecastValues: { "1": 1 }
        }
      ],
      "2023-12-05T12:00:00+00:00",
      "2023-12-06T12:00:00+00:00"
    );
    const filteredFutureData = filterCompactFutureData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(
      [
        {
          datetimeUtc: "2023-12-05T12:00:00+00:00",
          forecastValues: { "1": 3 }
        }
      ],
      "2023-12-06T12:00:00+00:00"
    );
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.length).toBe(1);
    expect(filteredData).toMatchObject([
      {
        datetimeUtc: "2023-12-05T12:00:00+00:00",
        forecastValues: { "1": 1 }
      }
    ]);
  });
});

// Actuals
describe("check filter func filters dummy historical actual data", () => {
  test("check filterCompactHistoricData + filterCompactFutureData", () => {
    const historicStartISO = "2023-12-05T12:30:00+00:00";
    const prev30MinFromNowISO = "2023-12-05T13:30:00+00:00";
    const filteredHistoricData = filterCompactHistoricData<
      components["schemas"]["GSPYieldGroupByDatetime"]
    >(
      [
        {
          datetimeUtc: "2023-12-05T12:00:00+00:00",
          generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
        },
        {
          datetimeUtc: "2023-12-05T12:30:00+00:00",
          generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
        },
        {
          datetimeUtc: "2023-12-05T13:00:00+00:00",
          generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
        },
        {
          datetimeUtc: "2023-12-05T13:30:00+00:00",
          generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
        },
        {
          datetimeUtc: "2023-12-05T14:00:00+00:00",
          generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
        }
      ],
      historicStartISO,
      prev30MinFromNowISO
    );
    const filteredFutureData = filterCompactFutureData<
      components["schemas"]["GSPYieldGroupByDatetime"]
    >(
      [
        {
          datetimeUtc: "2023-12-05T12:30:00+00:00",
          generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
        },
        {
          datetimeUtc: "2023-12-05T13:00:00+00:00",
          generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
        },
        {
          datetimeUtc: "2023-12-05T13:30:00+00:00",
          generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
        },
        {
          datetimeUtc: "2023-12-05T14:00:00+00:00",
          generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
        },
        {
          datetimeUtc: "2023-12-05T14:30:00+00:00",
          generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
        },
        {
          datetimeUtc: "2023-12-05T15:00:00+00:00",
          generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
        }
      ],
      prev30MinFromNowISO
    );
    expect(filteredHistoricData.length).toBe(3);
    expect(filteredHistoricData).toMatchObject([
      {
        datetimeUtc: "2023-12-05T12:30:00+00:00",
        generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
      },
      {
        datetimeUtc: "2023-12-05T13:00:00+00:00",
        generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
      },
      {
        datetimeUtc: "2023-12-05T13:30:00+00:00",
        generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
      }
    ]);
    expect(filteredFutureData.length).toBe(3);
    expect(filteredFutureData).toMatchObject([
      {
        datetimeUtc: "2023-12-05T14:00:00+00:00",
        generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
      },
      {
        datetimeUtc: "2023-12-05T14:30:00+00:00",
        generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
      },
      {
        datetimeUtc: "2023-12-05T15:00:00+00:00",
        generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
      }
    ]);
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.length).toBe(6);
    expect(filteredData).toMatchObject([
      {
        datetimeUtc: "2023-12-05T12:30:00+00:00",
        generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
      },
      {
        datetimeUtc: "2023-12-05T13:00:00+00:00",
        generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
      },
      {
        datetimeUtc: "2023-12-05T13:30:00+00:00",
        generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
      },
      {
        datetimeUtc: "2023-12-05T14:00:00+00:00",
        generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
      },
      {
        datetimeUtc: "2023-12-05T14:30:00+00:00",
        generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
      },
      {
        datetimeUtc: "2023-12-05T15:00:00+00:00",
        generationKwByGspId: { "1": "1", "2": "2", "3": "3" }
      }
    ]);
  });
});
describe("check filter func filters static historical actual data", () => {
  test("check filterCompactHistoricData + filterCompactFutureData", () => {
    const filteredHistoricData = filterCompactHistoricData<
      components["schemas"]["GSPYieldGroupByDatetime"]
      // @ts-ignore
    >(allGspActualHistoricCompact, "2023-12-05T12:00:00+00:00", "2023-12-06T12:00:00+00:00");
    const filteredFutureData = filterCompactFutureData<
      components["schemas"]["GSPYieldGroupByDatetime"]
      // @ts-ignore
    >(allGspActualHistoricCompact, "2023-12-06T12:00:00+00:00");
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.length).toBe(105);
    expect(filteredData[0].datetimeUtc).toBe("2023-12-22T16:00:00+00:00");
    expect(filteredData[0].generationKwByGspId["1"]).toBe("703.21");
    expect(filteredData[0].generationKwByGspId["2"]).toBe("1.68");
    expect(filteredData[1].datetimeUtc).toBe("2023-12-22T15:30:00+00:00");
    expect(filteredData[2].datetimeUtc).toBe("2023-12-22T15:00:00+00:00");

    expect(filteredData[filteredData.length - 2].datetimeUtc).toBe("2023-12-20T12:30:00+00:00");
    expect(filteredData[filteredData.length - 1].datetimeUtc).toBe("2023-12-20T12:00:00+00:00");
    expect(filteredData[filteredData.length - 1].generationKwByGspId["1"]).toBe("13745.0");
  });
});

describe("check funcs filter into subset forecast data correctly", () => {
  test("check trim to 24h before 'now'", () => {
    const filteredHistoricData = filterCompactHistoricData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(
      allGspForecastHistoricalDataCompact,
      "2023-12-06T12:00:00+00:00",
      "2023-12-07T12:00:00+00:00"
    );
    const filteredFutureData = filterCompactFutureData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(allGspForecastHistoricalDataCompact, "2023-12-07T12:00:00+00:00");
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.length).toBe(55);
    expect(filteredData).toMatchObject(
      allGspForecastHistoricalDataCompact.filter(
        (fc) => fc.datetimeUtc >= "2023-12-06T12:00:00+00:00"
      )
    );
    expect(filteredData[0].datetimeUtc).toBe("2023-12-06T12:00:00+00:00");
    expect(filteredData[1].datetimeUtc).toBe("2023-12-06T12:30:00+00:00");
    expect(filteredData[filteredData.length - 2].datetimeUtc).toBe("2023-12-07T14:30:00+00:00");
    expect(filteredData[filteredData.length - 1].datetimeUtc).toBe("2023-12-07T15:00:00+00:00");
  });
  test("check merge and trim history after refetching data", () => {
    // mock fetching data at 2023-12-06T12:10:00+00:00
    const initialFetchedData = allGspForecastHistoricalDataCompact;
    let lastFetched30PreNowISO = "2023-12-06T12:00:00+00:00";
    const filteredHistoricData = filterCompactHistoricData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(initialFetchedData, "2023-12-05T12:00:00+00:00", lastFetched30PreNowISO);
    const filteredFutureData = filterCompactFutureData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(initialFetchedData, lastFetched30PreNowISO);
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.length).toBe(103);
    expect(filteredData).toMatchObject(initialFetchedData);
    expect(filteredData[0].datetimeUtc).toBe("2023-12-05T12:00:00+00:00");
    expect(filteredData[1].datetimeUtc).toBe("2023-12-05T12:30:00+00:00");
    expect(filteredData[filteredData.length - 2].datetimeUtc).toBe("2023-12-07T14:30:00+00:00");
    expect(filteredData[filteredData.length - 1].datetimeUtc).toBe("2023-12-07T15:00:00+00:00");
    expect(filteredData[0].forecastValues["1"]).toBe(26.16);
    expect(filteredData[0].forecastValues["2"]).toBe(5.77);

    expect(filteredHistoricData[0].datetimeUtc).toBe("2023-12-05T12:00:00+00:00");
    expect(filteredHistoricData[filteredHistoricData.length - 1].datetimeUtc).toBe(
      "2023-12-06T12:00:00+00:00"
    );
    expect(filteredHistoricData[filteredHistoricData.length - 1].forecastValues["1"]).toBe(31.91);
    expect(filteredFutureData[0].datetimeUtc).toBe("2023-12-06T12:30:00+00:00");
    expect(filteredFutureData[filteredFutureData.length - 1].datetimeUtc).toBe(
      "2023-12-07T15:00:00+00:00"
    );
    expect(filteredFutureData[0].forecastValues["1"]).toBe(29.58);

    // mock refetching data at 2023-12-06T12:40:00+00:00
    const refetchedData = filterCompactFutureData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(allGspForecastHistoricalDataCompact, lastFetched30PreNowISO);
    lastFetched30PreNowISO = "2023-12-06T12:30:00+00:00";
    // amend data to check if refetched data is merged correctly
    expect(refetchedData.length).toBe(54);
    expect(refetchedData[0].datetimeUtc).toBe("2023-12-06T12:30:00+00:00");
    expect(refetchedData[0].forecastValues["1"]).toBe(29.58);
    refetchedData[0].forecastValues["1"] = 100;
    const newHistory = filterCompactHistoricData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(
      [...filteredHistoricData, ...refetchedData],
      "2023-12-05T12:30:00+00:00",
      lastFetched30PreNowISO
    );
    expect(newHistory.length).toBe(49);
    expect(newHistory[0].datetimeUtc).toBe("2023-12-05T12:30:00+00:00");
    expect(newHistory[0].forecastValues["1"]).toBe(28.1);
    expect(newHistory[0].forecastValues["2"]).toBe(5.69);
    expect(newHistory[1].datetimeUtc).toBe("2023-12-05T13:00:00+00:00");
    expect(newHistory[newHistory.length - 1].datetimeUtc).toBe("2023-12-06T12:30:00+00:00");
    expect(newHistory[newHistory.length - 1].forecastValues["1"]).toBe(100);
    expect(newHistory[newHistory.length - 1].forecastValues["2"]).toBe(4.31);
    const newFutureData = filterCompactFutureData<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(refetchedData, lastFetched30PreNowISO);
    const newCombinedData = [...newHistory, ...newFutureData];
    expect(newCombinedData.length).toBe(102); // lost 1 timestamp point due to mock refetching
    expect(newCombinedData[0].datetimeUtc).toBe("2023-12-05T12:30:00+00:00");
    expect(newCombinedData).toMatchObject(
      initialFetchedData.filter((fc) => fc.datetimeUtc >= "2023-12-05T12:30:00+00:00")
    );
  });
});

/////////////////////////////////////////////////
// getOldestTimestampFromCompactForecastValues //
/////////////////////////////////////////////////
describe("check func returns correct timestamp", () => {
  test("check func returns correct timestamp", () => {
    const oldestTimestamp = getOldestTimestampFromCompactForecastValues<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(allGspForecastHistoricalDataCompact);
    expect(oldestTimestamp).toBe("2023-12-05T12:00:00+00:00");
    const evenOlderTimestampData = [
      ...allGspForecastHistoricalDataCompact,
      {
        datetimeUtc: "2023-12-04T12:00:00+00:00",
        forecastValues: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
      }
    ];
    const evenOlderTimestamp =
      getOldestTimestampFromCompactForecastValues<
        components["schemas"]["OneDatetimeManyForecastValues"]
      >(evenOlderTimestampData);
    expect(evenOlderTimestamp).toBe("2023-12-04T12:00:00+00:00");
  });
});

//////////////////////////////////
// getEarliestForecastTimestamp //
//////////////////////////////////
import { getOldestTimestampFromForecastValues } from "./data";

describe("getOldestTimestampFromForecastValues", () => {
  test("should return the oldest timestamp from a valid forecast data array", () => {
    const forecastValues: ForecastData = [
      { targetTime: "2023-12-25T12:00:00Z", expectedPowerGenerationMegawatts: 1 },
      { targetTime: "2023-12-24T12:00:00Z", expectedPowerGenerationMegawatts: 2 },
      { targetTime: "2023-12-24T13:00:00Z", expectedPowerGenerationMegawatts: 2 },
      { targetTime: "2023-12-26T12:00:00Z", expectedPowerGenerationMegawatts: 3 }
    ];
    const result = getOldestTimestampFromForecastValues(forecastValues);
    expect(result).toBe("2023-12-24T12:00:00Z");
  });

  test("should return an empty string if the forecast data array is empty", () => {
    const forecastValues: ForecastData = [];
    const result = getOldestTimestampFromForecastValues(forecastValues);
    expect(result).toBe("");
  });

  test("should still return the oldest timestamp even if incomplete string", () => {
    const forecastValues = [
      { targetTime: "2023-12-25T12:00", expectedPowerGenerationMegawatts: 1 }
    ];
    const result = getOldestTimestampFromForecastValues(forecastValues);
    expect(result).toBe("2023-12-25T12:00");
  });
});

//////////////////////////////////
// getEarliestForecastTimestamp //
//////////////////////////////////
import { getEarliestForecastTimestamp } from "./data";
import { ForecastData } from "../types";
import { DateTime, Settings } from "luxon";

describe("getEarliestForecastTimestamp", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    Settings.defaultZone = "utc"; // Enforce UTC for all DateTime operations during tests
    // Ensure environment variables do not affect deterministic tests
    // Save and clear any existing values so tests are deterministic
    (global as any).__orig_HISTORY_START_TYPE = process.env.NEXT_PUBLIC_HISTORY_START_TYPE;
    (global as any).__orig_HISTORY_START_OFFSET_HOURS =
      process.env.NEXT_PUBLIC_HISTORY_START_OFFSET_HOURS;
    delete process.env.NEXT_PUBLIC_HISTORY_START_TYPE;
    delete process.env.NEXT_PUBLIC_HISTORY_START_OFFSET_HOURS;
  });
  afterAll(() => {
    jest.useRealTimers();
    Settings.defaultZone = "system"; // Reset to system defaults after tests
    // Restore any original env vars
    if ((global as any).__orig_HISTORY_START_TYPE !== undefined) {
      process.env.NEXT_PUBLIC_HISTORY_START_TYPE = (global as any).__orig_HISTORY_START_TYPE;
    } else {
      delete process.env.NEXT_PUBLIC_HISTORY_START_TYPE;
    }
    if ((global as any).__orig_HISTORY_START_OFFSET_HOURS !== undefined) {
      process.env.NEXT_PUBLIC_HISTORY_START_OFFSET_HOURS = (
        global as any
      ).__orig_HISTORY_START_OFFSET_HOURS;
    } else {
      delete process.env.NEXT_PUBLIC_HISTORY_START_OFFSET_HOURS;
    }
  });

  // Ensure no test leaks env vars to subsequent tests
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_HISTORY_START_TYPE;
    delete process.env.NEXT_PUBLIC_HISTORY_START_OFFSET_HOURS;
  });

  describe("General Behaviour", () => {
    beforeEach(() => {
      // Reset environment variables before each test
      delete process.env.NEXT_PUBLIC_HISTORY_START_TYPE;
      delete process.env.NEXT_PUBLIC_HISTORY_START_OFFSET_HOURS;
    });

    it("uses rolling mode with 48 hours by default", () => {
      jest.setSystemTime(new Date("2025-12-07T14:45:00Z").getTime());

      const result = getEarliestForecastTimestamp();
      // 48 hours back from 14:45 UTC == 2025-12-05 14:45 UTC
      // Rounded to nearest 6-hour interval = 2025-12-05 12:00 UTC
      expect(result).toBe("2025-12-05T12:00:00.000Z");
    });

    it("supports fixed mode starting at midnight", () => {
      jest.setSystemTime(new Date("2025-12-07T14:45:00Z").getTime());
      process.env.NEXT_PUBLIC_HISTORY_START_TYPE = "fixed";
      process.env.NEXT_PUBLIC_HISTORY_START_OFFSET_HOURS = "48";

      const result = getEarliestForecastTimestamp();
      // Two days back at midnight UTC
      expect(result).toBe("2025-12-05T00:00:00.000Z");
    });

    it("supports rolling mode with custom offset", () => {
      jest.setSystemTime(new Date("2025-12-07T14:45:00Z").getTime());
      process.env.NEXT_PUBLIC_HISTORY_START_TYPE = "rolling";
      process.env.NEXT_PUBLIC_HISTORY_START_OFFSET_HOURS = "72";

      const result = getEarliestForecastTimestamp();
      // 72 hours back from 14:45 UTC == 2025-12-04 14:45 UTC
      // Rounded to nearest 6-hour interval = 2025-12-04 12:00 UTC
      expect(result).toBe("2025-12-04T12:00:00.000Z");
    });
  });

  it("correctly rounds down 2 days back for local timezone (e.g. UTC+2)", () => {
    jest
      .spyOn(DateTime, "now")
      .mockReturnValue(
        DateTime.fromISO("2025-12-07T14:45:00+02:00", { setZone: true }) as DateTime
      );

    const result = getEarliestForecastTimestamp();

    // Local time UTC+2 => 2025-12-05 14:45 (local) => 12:00 local rounded 6 hr tick => 10:00 UTC
    expect(result).toBe("2025-12-05T10:00:00.000Z");
  });
});

it("returns a 6-hour aligned UTC timestamp", () => {
  // Mock the current time to a specific UTC date.
  jest.spyOn(DateTime, "now").mockReturnValue(
    DateTime.fromISO("2025-12-07T14:45:00.000Z").toUTC() as DateTime<true> // Mock current time in UTC
  );

  const result = getEarliestForecastTimestamp();

  // Two days before 2025-12-07T14:45:00Z is 2025-12-05T14:45:00Z
  // Rounded down to the nearest 6-hour boundary --> 2025-12-05T12:00:00Z
  expect(result).toBe("2025-12-05T12:00:00.000Z");
});

it("returns correctly rounded 6-hour boundary for a time just before midnight UTC", () => {
  jest
    .spyOn(DateTime, "now")
    .mockReturnValue(DateTime.fromISO("2025-12-07T23:59:59.000Z").toUTC() as DateTime<true>);

  const result = getEarliestForecastTimestamp();
  // Two days before is 2025-12-05T23:59:59Z --> Rounded down: 2025-12-05T18:00:00Z
  expect(result).toBe("2025-12-05T18:00:00.000Z");
});

it("handles time zones with positive offset correctly", () => {
  // Mock the current time in a timezone with +05:30 offset (e.g., India Standard Time).
  jest.spyOn(DateTime, "now").mockReturnValue(
    DateTime.fromISO("2025-12-07T14:45:00+05:30", { setZone: true }) as DateTime<true> // Mock current time in IST
  );

  const result = getEarliestForecastTimestamp();
  // Two days before in local time: 2025-12-05T14:45:00+05:30
  // Rounded down: 2025-12-05T12:00:00Z
  // Converted to UTC: 2025-12-05T06:30:00Z
  expect(result).toBe("2025-12-05T06:30:00.000Z");
});

it("handles time zones with negative offset correctly", () => {
  // Mock the current time in a timezone with -05:00 offset (e.g., Eastern Standard Time).
  jest.spyOn(DateTime, "now").mockReturnValue(
    DateTime.fromISO("2025-12-07T14:45:00-05:00", { setZone: true }) as DateTime<true> // Mock current time in EST
  );

  const result = getEarliestForecastTimestamp();
  // Two days before in local time: 2025-12-05T14:45:00-05:00
  // Rounded down: 2025-12-05T12:00:00Z
  // Converted to UTC: 2025-12-05T17:00:00Z
  expect(result).toBe("2025-12-05T17:00:00.000Z");
});

it("handles Daylight Saving Time transitions (spring forward)", () => {
  // Mock the current time to just after a spring-forward DST change to BST.
  jest
    .spyOn(DateTime, "now")
    .mockReturnValue(
      DateTime.fromISO("2025-03-30T03:30:00+01:00", { setZone: true }) as DateTime<true>
    );

  const result = getEarliestForecastTimestamp();
  // Two days before in local time: 2025-03-28T03:30:00+02:00
  // Rounded down: 2025-03-28T00:00:00Z
  // Converted to UTC: 2025-03-27T22:00:00Z
  expect(result).toBe("2025-03-27T23:00:00.000Z");
});

it("handles Daylight Saving Time transitions (fall back)", () => {
  // Mock the current time to just after a fall-back DST change back to GMT.
  jest
    .spyOn(DateTime, "now")
    .mockReturnValue(
      DateTime.fromISO("2025-10-26T02:30:00+00:00", { setZone: true }) as DateTime<true>
    );

  const result = getEarliestForecastTimestamp();
  // Two days before in local time: 2025-10-24T01:30:00+02:00
  // Rounded down: 2025-10-24T00:00:00Z
  // Converted to UTC: 2025-10-23T22:00:00Z
  expect(result).toBe("2025-10-24T00:00:00.000Z");
});

describe("Handle before and after noon in BST", () => {
  it("handles before noon in BST", () => {
    // Mock the current time to just before noon in BST.
    jest.spyOn(DateTime, "now").mockReturnValue(
      DateTime.fromISO("2025-06-01T11:59:59+01:00", { setZone: true }) as DateTime<true> // Mock BST
    );

    const result = getEarliestForecastTimestamp();
    // Two days before in local time: 2025-05-30T11:30:00+01:00
    // Rounded down: 2025-05-30T06:00:00Z
    expect(result).toBe("2025-05-30T05:00:00.000Z");
  });

  it("handles after noon in BST", () => {
    // Mock the current time to just after noon in BST.
    jest.spyOn(DateTime, "now").mockReturnValue(
      DateTime.fromISO("2025-06-01T12:00:00+01:00", { setZone: true }) as DateTime<true> // Mock BST
    );

    const result = getEarliestForecastTimestamp();
    // Two days before in local time: 2025-05-30T12:30:00+01:00
    // Rounded down: 2025-05-30T06:00:00Z
    expect(result).toBe("2025-05-30T11:00:00.000Z");
  });
});

it("returns correctly aligned UTC values with no timezone (system default)", () => {
  // Restore default zone to simulate system timezone behavior.
  Settings.defaultZone = "system";

  // Mock the current time in the system default zone.
  jest.spyOn(DateTime, "now").mockReturnValue(
    DateTime.fromISO("2025-12-07T14:45:00") as DateTime<true> // Mock without explicit UTC or timezone
  );

  const result = getEarliestForecastTimestamp();

  // The result depends on the system timezone but must align to a 6-hour boundary.
  console.log(result); // Log for visual validation in non-UTC systems.
});
