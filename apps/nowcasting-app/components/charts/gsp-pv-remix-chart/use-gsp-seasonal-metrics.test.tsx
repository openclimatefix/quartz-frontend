import { expect, jest, test } from "@jest/globals";
import { renderHook, waitFor } from "@testing-library/react";
import useGspSeasonalMetrics from "./use-gsp-seasonal-metrics";

const metrics = {
  keys: { pLevels: ["p10", "p90"] },
  data: { "7": { "1": { mean: [0.5], pLevels: [[0.4], [0.6]] } } }
};

test("an NL province fetches its own file by name and scales by the province's capacity", async () => {
  const fetchMock = jest
    .fn<() => Promise<unknown>>()
    .mockResolvedValue({ json: () => Promise.resolve(metrics) });
  global.fetch = fetchMock as unknown as typeof fetch;

  const { result } = renderHook(() => useGspSeasonalMetrics([], "province", "noord-brabant", 4200));

  await waitFor(() => expect(result.current).not.toBeNull());
  expect(fetchMock).toHaveBeenCalledWith("/data/nl/province-metrics/noord-brabant.json");
  expect(result.current).toEqual({ metrics, capacity: 4200 });
});

test("a DE TSO fetches its own file by name, the same way", async () => {
  const fetchMock = jest.fn<() => Promise<unknown>>().mockResolvedValue({
    json: () => Promise.resolve(metrics)
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  const { result } = renderHook(() => useGspSeasonalMetrics([], "tso", "50hertz", 25000));

  await waitFor(() => expect(result.current).not.toBeNull());
  expect(fetchMock).toHaveBeenCalledWith("/data/de/tso-metrics/50hertz.json");
  expect(result.current).toEqual({ metrics, capacity: 25000 });
});
