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

////////////////////////////////////////////////////////////
// getEarliestForecastTimestamp / getFurthestForecastTimestamp //
////////////////////////////////////////////////////////////
import { getEarliestForecastTimestamp, getFurthestForecastTimestamp } from "./data";
import { ForecastData } from "../types";
import { Settings } from "luxon";
import { afterEach, beforeEach, it } from "@jest/globals";

/**
 * B2. These tests previously pinned the *broken* behaviour; they now assert the corrected one.
 * Two things changed:
 *
 * 1. `getFurthestForecastTimestamp` rounded up by adding `hour % 6`, which is not a round-up at
 *    all — 14:00 became 16:00, which is not one of the 6-hour boundaries the API serves. It now
 *    adds `(6 - hour % 6) % 6`, i.e. a true ceiling: 14:00 -> 18:00, and a value already on a
 *    boundary stays put rather than jumping a whole interval.
 * 2. Both helpers rounded in the *viewer's* local timezone and only then converted to UTC, so a
 *    viewer in Los Angeles or Sydney requested a different window from a viewer in the UK for the
 *    same instant (worst around the boundaries, and across the viewer's own DST changes, where
 *    calendar-day arithmetic in local time shifts the instant by an hour). Rounding now happens
 *    in UTC, which is the only zone the API knows about, so every viewer gets the same window.
 *
 * The old expectations that changed, for the record (frozen now = 2025-12-07T14:45:00Z, UTC
 * viewer): furthest was "2025-12-08T16:00:00.000Z", now "2025-12-08T18:00:00.000Z". Earliest was
 * already right for a UTC viewer; it was only wrong off-zone, e.g. an LA viewer at
 * 2025-11-03T12:00:00Z got "2025-11-01T07:00:00.000Z" where a UK viewer got
 * "2025-11-01T12:00:00.000Z".
 */
describe("forecast window helpers (B2)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Settings.defaultZone = "utc";
  });
  afterEach(() => {
    jest.useRealTimers();
    Settings.defaultZone = "system";
    jest.restoreAllMocks();
  });

  const freeze = (iso: string) => jest.setSystemTime(new Date(iso).getTime());

  describe("getEarliestForecastTimestamp — two days back, rounded DOWN to a 6-hour UTC boundary", () => {
    it.each([
      // [frozen now, expected]
      ["2025-12-07T14:45:00Z", "2025-12-05T12:00:00.000Z"],
      ["2025-12-07T05:59:59Z", "2025-12-05T00:00:00.000Z"],
      ["2025-12-07T23:59:59Z", "2025-12-05T18:00:00.000Z"],
      ["2025-12-07T11:59:59.999Z", "2025-12-05T06:00:00.000Z"],
      // BST, where the old local-zone rounding drifted for UK viewers too
      ["2025-07-15T14:45:00Z", "2025-07-13T12:00:00.000Z"],
      ["2025-07-15T00:30:00Z", "2025-07-13T00:00:00.000Z"],
      // spanning the UK DST boundaries
      ["2025-03-30T02:30:00Z", "2025-03-28T00:00:00.000Z"],
      ["2025-10-26T01:30:00Z", "2025-10-24T00:00:00.000Z"],
      ["2026-03-29T02:30:00Z", "2026-03-27T00:00:00.000Z"],
      ["2026-10-25T01:30:00Z", "2026-10-23T00:00:00.000Z"]
    ])("now = %s -> %s", (now, expected) => {
      freeze(now);
      expect(getEarliestForecastTimestamp()).toBe(expected);
    });

    it.each(["00:00", "06:00", "12:00", "18:00"])(
      "is idempotent on the boundary hour %s (does not jump back a full interval)",
      (hhmm) => {
        freeze(`2025-12-07T${hhmm}:00Z`);
        expect(getEarliestForecastTimestamp()).toBe(`2025-12-05T${hhmm}:00.000Z`);
      }
    );
  });

  describe("getFurthestForecastTimestamp — one day forward, rounded UP to a 6-hour UTC boundary", () => {
    it.each([
      // [frozen now, expected]
      ["2025-12-07T14:45:00Z", "2025-12-08T18:00:00.000Z"], // was "…T16:00:00.000Z" — not a boundary
      ["2025-12-07T14:00:00Z", "2025-12-08T18:00:00.000Z"], // the 14:00 -> 18:00 case from the bug report
      ["2025-12-07T00:00:01Z", "2025-12-08T06:00:00.000Z"],
      ["2025-12-07T18:00:01Z", "2025-12-09T00:00:00.000Z"],
      ["2025-12-07T23:30:00Z", "2025-12-09T00:00:00.000Z"],
      ["2025-07-15T14:45:00Z", "2025-07-16T18:00:00.000Z"],
      ["2025-03-30T02:30:00Z", "2025-03-31T06:00:00.000Z"],
      ["2025-10-26T01:30:00Z", "2025-10-27T06:00:00.000Z"]
    ])("now = %s -> %s", (now, expected) => {
      freeze(now);
      expect(getFurthestForecastTimestamp()).toBe(expected);
    });

    it.each(["00:00", "06:00", "12:00", "18:00"])(
      "is idempotent on the boundary hour %s (does not jump forward a full interval)",
      (hhmm) => {
        freeze(`2025-12-07T${hhmm}:00Z`);
        expect(getFurthestForecastTimestamp()).toBe(`2025-12-08T${hhmm}:00.000Z`);
      }
    );

    it("always returns a real 6-hour boundary, whatever the minute", () => {
      for (let hour = 0; hour < 24; hour++) {
        for (const minute of [0, 1, 29, 30, 45, 59]) {
          freeze(
            `2025-12-07T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`
          );
          const result = getFurthestForecastTimestamp();
          expect(result).toMatch(/T(00|06|12|18):00:00\.000Z$/);
        }
      }
    });
  });

  describe("the viewer's timezone must not change the UTC window", () => {
    const zones = [
      "utc",
      "Europe/London",
      "America/Los_Angeles",
      "Australia/Sydney",
      "Asia/Kolkata"
    ];

    it.each(zones)("a viewer in %s gets the same window as a UK viewer (BST)", (zone) => {
      Settings.defaultZone = zone;
      freeze("2025-07-15T14:45:00Z");
      expect(getEarliestForecastTimestamp()).toBe("2025-07-13T12:00:00.000Z");
      expect(getFurthestForecastTimestamp()).toBe("2025-07-16T18:00:00.000Z");
    });

    it.each(zones)("a viewer in %s gets the same window across their own DST change", (zone) => {
      // US DST ended 2025-11-02, UK's 2025-10-26: calendar-day arithmetic in local time used to
      // shift the instant by an hour here, so viewers disagreed.
      Settings.defaultZone = zone;
      freeze("2025-11-03T12:00:00Z");
      expect(getEarliestForecastTimestamp()).toBe("2025-11-01T12:00:00.000Z");
      expect(getFurthestForecastTimestamp()).toBe("2025-11-04T12:00:00.000Z");
    });
  });
});
