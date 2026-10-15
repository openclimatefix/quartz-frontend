/**
 * The geo asset cache.
 *
 * Three properties, each of which exists for a specific failure that would otherwise be
 * invisible: the forecast map and the delta map mount together and must not fetch GB's 9 MB
 * GSP file twice; a level revisited must not re-parse it; and a transient 502 on first load
 * must not blank the map for the rest of the session.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

import { clearGeoAssetCache, loadGeoAsset } from "./assets";

type FetchResponse = { ok: boolean; status: number; json: () => Promise<unknown> };
const fetchMock = jest.fn<(url?: unknown) => Promise<FetchResponse>>();

beforeEach(() => {
  clearGeoAssetCache();
  fetchMock.mockReset();
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
});
afterEach(() => {
  clearGeoAssetCache();
});

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("loadGeoAsset", () => {
  test("two simultaneous callers share one request — the in-flight promise is cached", async () => {
    let settle: ((value: FetchResponse) => void) | undefined;
    fetchMock.mockReturnValue(
      new Promise<FetchResponse>((resolve) => {
        settle = resolve;
      })
    );

    // Both maps ask in the same tick, before anything has resolved. Caching only the result
    // would issue two requests here.
    const first = loadGeoAsset<{ ok: boolean }>("/geo/gb/gsp.json");
    const second = loadGeoAsset<{ ok: boolean }>("/geo/gb/gsp.json");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    settle!(ok({ ok: true }));
    expect(await first).toEqual({ ok: true });
    expect(await second).toEqual({ ok: true });
    expect(await first).toBe(await second);
  });

  test("a resolved asset is served from cache, never refetched", async () => {
    fetchMock.mockResolvedValue(ok({ type: "FeatureCollection" }));

    await loadGeoAsset("/geo/gb/dno.json");
    await loadGeoAsset("/geo/gb/dno.json");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("distinct URLs are distinct entries", async () => {
    fetchMock.mockImplementation((url: unknown) => Promise.resolve(ok({ url })));

    expect(await loadGeoAsset("/geo/gb/national.json")).toEqual({ url: "/geo/gb/national.json" });
    expect(await loadGeoAsset("/geo/nl/national.json")).toEqual({ url: "/geo/nl/national.json" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("a rejected fetch is evicted, so a retry is possible", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    await expect(loadGeoAsset("/geo/gb/gsp.json")).rejects.toThrow("network");

    // Without eviction the failure would be cached for the life of the tab and the map would
    // stay blank with no way back short of a reload.
    fetchMock.mockResolvedValueOnce(ok({ recovered: true }));
    expect(await loadGeoAsset("/geo/gb/gsp.json")).toEqual({ recovered: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("a non-2xx response is an error, not a body", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    await expect(loadGeoAsset("/geo/gb/missing.json")).rejects.toThrow("404");

    // And is evicted like any other failure.
    fetchMock.mockResolvedValueOnce(ok({ ok: true }));
    expect(await loadGeoAsset("/geo/gb/missing.json")).toEqual({ ok: true });
  });
});
