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

describe("getEarliestForecastTimestamp", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("should return the correct timestamp when the current time is exactly on a 6-hour boundary", () => {
    // Freeze time to a 6-hour boundary (e.g., 2023-12-07T12:00:00Z)
    jest.setSystemTime(new Date("2023-12-07T12:00:00Z"));

    const result = getEarliestForecastTimestamp();
    expect(result).toBe("2023-12-05T12:00:00.000Z"); // Two days ago, rounded to 6-hour boundary
  });

  test("should return the correct timestamp when the current time is not on a 6-hour boundary", () => {
    // Freeze time to a non-6-hour boundary (e.g., 2023-12-07T14:45:00Z)
    jest.setSystemTime(new Date("2023-12-07T14:45:00Z"));

    const result = getEarliestForecastTimestamp();
    expect(result).toBe("2023-12-05T12:00:00.000Z"); // Two days ago, rounded to 6-hour boundary
  });

  test("should handle edge cases near midnight correctly", () => {
    // Freeze time to just before midnight (e.g., 2023-12-07T23:59:59Z)
    jest.setSystemTime(new Date("2023-12-07T23:59:59Z"));

    const result = getEarliestForecastTimestamp();
    expect(result).toBe("2023-12-05T18:00:00.000Z"); // Two days ago, rounded to 6-hour boundary
  });

  test("Should handle British Summer time, away from 6h floor", () => {
    jest.setSystemTime(new Date("2025-06-12T20:11:00Z"));

    const result = getEarliestForecastTimestamp();
    expect(result).toBe("2025-06-10T17:00:00.000Z");
  });

  test("Should handle British Summer time, near 6 hour floor", () => {
    jest.setSystemTime(new Date("2025-06-12T17:11:00Z"));

    const result = getEarliestForecastTimestamp();
    // The API works with BST, so 17:11 is actually 18:11 BST,
    // which then gets rounded down to 18:00
    expect(result).toBe("2025-06-10T17:00:00.000Z");
  });
});
