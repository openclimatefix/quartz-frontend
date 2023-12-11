import { describe, test } from "@jest/globals";
import { filterFutureDataCompact, filterHistoricDataCompact } from "./data";
import allGspForecastHistoricalDataCompact from "../../data/updatedDummyApiResponses/allGspForecastHistoricCompact.json";

describe("check func filters fake historical data", () => {
  test("check func filters out data after prev30MinNow", () => {
    const filteredData = filterHistoricDataCompact(
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
    const filteredData = filterHistoricDataCompact(
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

describe("check func filters dummy actual historical data", () => {
  test("check func filters out data before historic start & after prev30MinNow", () => {
    const filteredData = filterHistoricDataCompact(
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

describe("check filter functions combine back into correct full timestamp data", () => {
  test("check filterHistoricDataCompact + filterFutureDataCompact", () => {
    const filteredHistoricData = filterHistoricDataCompact(
      allGspForecastHistoricalDataCompact,
      "2023-12-05T12:00:00+00:00",
      "2023-12-06T12:00:00+00:00"
    );
    const filteredFutureData = filterFutureDataCompact(
      allGspForecastHistoricalDataCompact,
      "2023-12-06T12:00:00+00:00"
    );
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.map((fc) => fc.datetimeUtc)).toMatchObject(
      allGspForecastHistoricalDataCompact.map((fc) => fc.datetimeUtc)
    );
    expect(filteredData.length).toBe(allGspForecastHistoricalDataCompact.length);
    expect(filteredData[0].datetimeUtc).toBe("2023-12-05T12:00:00+00:00");
    expect(filteredData[1].datetimeUtc).toBe("2023-12-05T12:30:00+00:00");
    expect(filteredData[filteredData.length - 2].datetimeUtc).toBe("2023-12-07T14:30:00+00:00");
    expect(filteredData[filteredData.length - 1].datetimeUtc).toBe("2023-12-07T15:00:00+00:00");
  });
  test("check 'now' timestamp at beginning of data window", () => {
    const filteredHistoricData = filterHistoricDataCompact(
      allGspForecastHistoricalDataCompact,
      "2023-12-05T12:00:00+00:00",
      "2023-12-05T12:00:00+00:00"
    );
    const filteredFutureData = filterFutureDataCompact(
      allGspForecastHistoricalDataCompact,
      "2023-12-05T12:00:00+00:00"
    );
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.length).toBe(allGspForecastHistoricalDataCompact.length);
    expect(filteredData.map((fc) => fc.datetimeUtc)).toMatchObject(
      allGspForecastHistoricalDataCompact.map((fc) => fc.datetimeUtc)
    );
  });
  test("check 'now' timestamp at end of data window", () => {
    const filteredHistoricData = filterHistoricDataCompact(
      allGspForecastHistoricalDataCompact,
      "2023-12-05T12:00:00+00:00",
      "2023-12-07T15:00:00+00:00"
    );
    const filteredFutureData = filterFutureDataCompact(
      allGspForecastHistoricalDataCompact,
      "2023-12-07T15:00:00+00:00"
    );
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.length).toBe(allGspForecastHistoricalDataCompact.length);
    expect(filteredData.map((fc) => fc.datetimeUtc)).toMatchObject(
      allGspForecastHistoricalDataCompact.map((fc) => fc.datetimeUtc)
    );
  });
});

describe("check funcs filter into subset data correctly", () => {
  test("check trim to 24h before 'now'", () => {
    const filteredHistoricData = filterHistoricDataCompact(
      allGspForecastHistoricalDataCompact,
      "2023-12-06T12:00:00+00:00",
      "2023-12-07T12:00:00+00:00"
    );
    const filteredFutureData = filterFutureDataCompact(
      allGspForecastHistoricalDataCompact,
      "2023-12-07T12:00:00+00:00"
    );
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.length).toBe(55);
    expect(filteredData.map((fc) => fc.datetimeUtc)).toMatchObject(
      allGspForecastHistoricalDataCompact
        .filter((fc) => fc.datetimeUtc >= "2023-12-06T12:00:00+00:00")
        .map((fc) => fc.datetimeUtc)
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
    const filteredHistoricData = filterHistoricDataCompact(
      initialFetchedData,
      "2023-12-05T12:00:00+00:00",
      lastFetched30PreNowISO
    );
    const filteredFutureData = filterFutureDataCompact(initialFetchedData, lastFetched30PreNowISO);
    const filteredData = [...filteredHistoricData, ...filteredFutureData];
    expect(filteredData.length).toBe(103);
    expect(filteredData.map((fc) => fc.datetimeUtc)).toMatchObject(
      initialFetchedData.map((fc) => fc.datetimeUtc)
    );
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
    const refetchedData = filterFutureDataCompact(
      allGspForecastHistoricalDataCompact,
      lastFetched30PreNowISO
    );
    lastFetched30PreNowISO = "2023-12-06T12:30:00+00:00";
    // amend data to check if refetched data is merged correctly
    expect(refetchedData.length).toBe(54);
    expect(refetchedData[0].datetimeUtc).toBe("2023-12-06T12:30:00+00:00");
    expect(refetchedData[0].forecastValues["1"]).toBe(29.58);
    refetchedData[0].forecastValues["1"] = 100;
    const newHistory = filterHistoricDataCompact(
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
    const newFutureData = filterFutureDataCompact(refetchedData, lastFetched30PreNowISO);
    const newCombinedData = [...newHistory, ...newFutureData];
    expect(newCombinedData.length).toBe(102); // lost 1 timestamp point due to mock refetching
    expect(newCombinedData[0].datetimeUtc).toBe("2023-12-05T12:30:00+00:00");
    expect(newCombinedData.map((fc) => fc.datetimeUtc)).toMatchObject(
      initialFetchedData
        .filter((fc) => fc.datetimeUtc >= "2023-12-05T12:30:00+00:00")
        .map((fc) => fc.datetimeUtc)
    );
  });
});
