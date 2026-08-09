/**
 * `useSeasonalNorms` replaces `use-format-chart-data.tsx`'s bundled
 * `import nationalMetrics from "data/national_metrics.json"` (Phase 5). It follows the same
 * URL-keyed idiom as `useMapGeometry`'s `useGeoAsset`, for the same reason: a country switch
 * mid-fetch must not let the previous country's stale response land after the switch and
 * paint one country's norms under another's chart. That was a live bug for NL before this
 * hook existed — the bundled import was applied unconditionally regardless of which country
 * was selected.
 *
 * Uses the real `config/countries.ts` registry (unmocked) so these tests exercise GB's actual
 * configured `seasonalNorms` URL and NL's actual `null`, rather than a URL a mock invented.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react";

let currentCountry: string = "GB";
jest.mock("./use-countries", () => ({
  __esModule: true,
  useCurrentCountry: () => currentCountry
}));

// Deferred per URL, matching `use-map-geometry.test.tsx`'s stub: a test decides the settle
// order rather than the event loop, and the stub caches per URL like the real `loadGeoAsset`.
const deferrals = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (e: unknown) => void }
>();
const promises = new Map<string, Promise<unknown>>();
const requestedUrls: string[] = [];

jest.mock("../../lib/geo/assets", () => ({
  __esModule: true,
  loadGeoAsset: (url: string) => {
    const cached = promises.get(url);
    if (cached) return cached;
    requestedUrls.push(url);
    const promise = new Promise((resolve, reject) => {
      deferrals.set(url, { resolve: resolve as (value: unknown) => void, reject });
    });
    promises.set(url, promise);
    return promise;
  }
}));

import { useSeasonalNorms, type SeasonalNormsData } from "./use-seasonal-norms";

const GB_URL = "/data/gb/national-metrics.json";

const fixture: SeasonalNormsData = {
  data: { "7": { "1": { mean: [0.5], pLevels: [[0.3], [0.7]] } } },
  keys: { pLevels: ["p10", "p90"] }
};

const settle = async (url: string, value: unknown) => {
  const deferral = deferrals.get(url);
  if (!deferral) throw new Error(`nothing requested ${url}`);
  await act(async () => {
    deferral.resolve(value);
  });
};

beforeEach(() => {
  currentCountry = "GB";
  deferrals.clear();
  promises.clear();
  requestedUrls.length = 0;
});
afterEach(() => {
  jest.clearAllMocks();
});

describe("useSeasonalNorms", () => {
  test("GB fetches its configured asset and resolves it", async () => {
    const view = renderHook(() => useSeasonalNorms());
    expect(requestedUrls).toEqual([GB_URL]);
    expect(view.result.current).toBeUndefined();

    await settle(GB_URL, fixture);
    await waitFor(() => expect(view.result.current).toBeDefined());
    expect(view.result.current).toEqual(fixture);
  });

  test("NL has no seasonal-norm dataset: no fetch, and undefined forever", async () => {
    currentCountry = "NL";
    const view = renderHook(() => useSeasonalNorms());
    expect(requestedUrls).toEqual([]);
    expect(view.result.current).toBeUndefined();

    // Give any stray microtask a turn; there is nothing in flight for it to resolve.
    await act(async () => {});
    expect(view.result.current).toBeUndefined();
  });

  test("a country switch mid-fetch never applies the stale country's response", async () => {
    const view = renderHook(() => useSeasonalNorms());
    expect(requestedUrls).toEqual([GB_URL]);

    // The user switches to NL — which has no dataset — before GB's fetch lands.
    currentCountry = "NL";
    view.rerender();
    expect(view.result.current).toBeUndefined();

    // GB's response arrives late. It must not be applied: the hook is now keyed on `undefined`
    // (NL has no url), not on GB_URL, so there is nowhere for this answer to land.
    await settle(GB_URL, fixture);
    expect(view.result.current).toBeUndefined();
  });

  test("switching back to a country whose asset already resolved uses it without refetching", async () => {
    const view = renderHook(() => useSeasonalNorms());
    await settle(GB_URL, fixture);
    await waitFor(() => expect(view.result.current).toBeDefined());

    currentCountry = "NL";
    view.rerender();
    expect(view.result.current).toBeUndefined();

    currentCountry = "GB";
    view.rerender();
    await waitFor(() => expect(view.result.current).toEqual(fixture));
    expect(requestedUrls).toEqual([GB_URL]);
  });
});
