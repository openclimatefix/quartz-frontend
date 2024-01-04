import { describe, expect, test } from "@jest/globals";
import {
  filterFutureDataCompact,
  filterHistoricDataCompact,
  getOldestTimestampFromCompactForecastValues
} from "./data";
import allGspForecastHistoricalDataCompact from "../../data/updatedDummyApiResponses/allGspForecastHistoricCompact.json";
import allGspActualHistoricCompact from "../../data/updatedDummyApiResponses/allGspActualHistoricCompact.json";
import { components } from "../../types/quartz-api";

describe("check func filters fake historical forecast data", () => {
  test("check func filters out data after prev30MinNow", () => {
    const filteredData = filterHistoricDataCompact<
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
    const filteredData = filterHistoricDataCompact<
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
    const filteredData = filterHistoricDataCompact<
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
  test("check filterHistoricDataCompact + filterFutureDataCompact", () => {
    const filteredHistoricData = filterHistoricDataCompact<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(
      allGspForecastHistoricalDataCompact,
      "2023-12-05T12:00:00+00:00",
      "2023-12-06T12:00:00+00:00"
    );
    const filteredFutureData = filterFutureDataCompact<
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
    const filteredHistoricData = filterHistoricDataCompact<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(
      allGspForecastHistoricalDataCompact,
      "2023-12-05T12:00:00+00:00",
      "2023-12-05T12:00:00+00:00"
    );
    const filteredFutureData = filterFutureDataCompact<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(allGspForecastHistoricalDataCompact, "2023-12-05T12:00:00+00:00");
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.length).toBe(allGspForecastHistoricalDataCompact.length);
    expect(filteredData).toMatchObject(allGspForecastHistoricalDataCompact);
  });
  test("check 'now' timestamp at end of data window", () => {
    const filteredHistoricData = filterHistoricDataCompact<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(
      allGspForecastHistoricalDataCompact,
      "2023-12-05T12:00:00+00:00",
      "2023-12-07T15:00:00+00:00"
    );
    const filteredFutureData = filterFutureDataCompact<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(allGspForecastHistoricalDataCompact, "2023-12-07T15:00:00+00:00");
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.length).toBe(allGspForecastHistoricalDataCompact.length);
    expect(filteredData).toMatchObject(allGspForecastHistoricalDataCompact);
  });
});

describe("check filter functions return empty array when no data", () => {
  test("check filterHistoricDataCompact + filterFutureDataCompact", () => {
    const filteredHistoricData = filterHistoricDataCompact<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >([], "2023-12-05T12:00:00+00:00", "2023-12-06T12:00:00+00:00");
    const filteredFutureData = filterFutureDataCompact<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >([], "2023-12-06T12:00:00+00:00");
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.length).toBe(0);
    expect(filteredData).toMatchObject([]);
  });
});

describe("check filter functions return correct data when only 1 timestamp", () => {
  test("check filterHistoricDataCompact + filterFutureDataCompact", () => {
    const filteredHistoricData = filterHistoricDataCompact<
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
    const filteredFutureData = filterFutureDataCompact<
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
  test("check filterHistoricDataCompact + filterFutureDataCompact", () => {
    const historicStartISO = "2023-12-05T12:30:00+00:00";
    const prev30MinFromNowISO = "2023-12-05T13:30:00+00:00";
    const filteredHistoricData = filterHistoricDataCompact<
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
    const filteredFutureData = filterFutureDataCompact<
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
  test("check filterHistoricDataCompact + filterFutureDataCompact", () => {
    const filteredHistoricData = filterHistoricDataCompact<
      components["schemas"]["GSPYieldGroupByDatetime"]
      // @ts-ignore
    >(allGspActualHistoricCompact, "2023-12-05T12:00:00+00:00", "2023-12-06T12:00:00+00:00");
    const filteredFutureData = filterFutureDataCompact<
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
    const filteredHistoricData = filterHistoricDataCompact<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(
      allGspForecastHistoricalDataCompact,
      "2023-12-06T12:00:00+00:00",
      "2023-12-07T12:00:00+00:00"
    );
    const filteredFutureData = filterFutureDataCompact<
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
    const filteredHistoricData = filterHistoricDataCompact<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(initialFetchedData, "2023-12-05T12:00:00+00:00", lastFetched30PreNowISO);
    const filteredFutureData = filterFutureDataCompact<
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
    const refetchedData = filterFutureDataCompact<
      components["schemas"]["OneDatetimeManyForecastValues"]
    >(allGspForecastHistoricalDataCompact, lastFetched30PreNowISO);
    lastFetched30PreNowISO = "2023-12-06T12:30:00+00:00";
    // amend data to check if refetched data is merged correctly
    expect(refetchedData.length).toBe(54);
    expect(refetchedData[0].datetimeUtc).toBe("2023-12-06T12:30:00+00:00");
    expect(refetchedData[0].forecastValues["1"]).toBe(29.58);
    refetchedData[0].forecastValues["1"] = 100;
    const newHistory = filterHistoricDataCompact<
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
    const newFutureData = filterFutureDataCompact<
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

describe("check oldest timestamp function returns correct timestamp", () => {
  test("check oldest timestamp function returns correct timestamp", () => {
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
