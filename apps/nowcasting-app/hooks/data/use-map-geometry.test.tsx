/**
 * The async geometry seam.
 *
 * Geometry stopped being synchronous in Phase 5: it is fetched from `public/geo/{country}/`
 * rather than `require`d into the bundle. That introduced one failure mode that no amount of
 * looking at the map would catch — an out-of-order resolve, where switching aggregation level
 * while a fetch is in flight lets the slower response land last and paints one level's
 * polygons under another level's numbers. It looks like plausible data.
 *
 * The contract's obligation is stated as: resolve level B's fetch after level A's and assert
 * A's feature states are never applied to B's geometry. That is what the first test does,
 * with the timing forced rather than raced — A's promise is resolved *after* B's, which is
 * the ordering the guard exists for and the one a real 9 MB-then-1.4 MB pair produces.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { FeatureCollection } from "geojson";

import type { AggregationLevel } from "../../components/helpers/aggregationLevels";
import type { Region } from "../../lib/domain/types";

jest.mock("./use-countries", () => ({
  __esModule: true,
  useFocusedCountry: () => "GB"
}));

// Deferred per URL, so a test decides the settle order rather than the event loop. The stub
// caches per URL exactly as the real `loadGeoAsset` does — that is the property that makes a
// second visit to a level free, and stubbing it away would make the "no second fetch"
// assertion below a statement about the stub. The cache itself is tested in
// `lib/geo/assets.test.ts`.
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

import { useLevelGroupings, useMapGeometry } from "./use-map-geometry";

const GSP_URL = "/geo/gb/gsp.json";
const DNO_SHAPES_URL = "/geo/gb/dno.json";
const DNO_GROUPINGS_URL = "/geo/gb/dno-groupings.json";

const GSP_LEVEL: AggregationLevel = {
  regionType: "gsp",
  level: 10,
  label: "Grid Supply Point",
  minZoom: 7,
  maxZoom: 8.5,
  derived: false
};
const DNO_LEVEL: AggregationLevel = {
  regionType: "dno",
  level: 5,
  label: "DNO",
  minZoom: 5,
  maxZoom: 7,
  derived: true
};

const regions: Region[] = [
  {
    name: "citr_1",
    label: "City Road",
    regionType: "gsp",
    capacityMw: 4,
    centroid: null,
    metadata: { gsp_id: 67 }
  }
];

/** GB's GSP file spells the join key uppercase in `properties.GSPs`. */
const gspShapes: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: undefined,
      properties: { GSPs: "CITR_1" },
      geometry: { type: "Point", coordinates: [0, 51] }
    }
  ]
};

/** The DNO polygons carry the grouping name verbatim in `LongName`. */
const dnoShapes: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: undefined,
      properties: { LongName: "UKPN (East)" },
      geometry: { type: "Point", coordinates: [1, 52] }
    }
  ]
};

const settle = async (url: string, value: unknown) => {
  const deferral = deferrals.get(url);
  if (!deferral) throw new Error(`nothing requested ${url}`);
  await act(async () => {
    deferral.resolve(value);
  });
};

beforeEach(() => {
  deferrals.clear();
  promises.clear();
  requestedUrls.length = 0;
});
afterEach(() => {
  jest.clearAllMocks();
});

describe("useMapGeometry — the out-of-order resolve", () => {
  test("a level's fetch resolving after the level has moved on is never applied", async () => {
    const view = renderHook(
      ({ level }: { level: AggregationLevel }) => useMapGeometry(level, regions),
      { initialProps: { level: GSP_LEVEL } }
    );

    expect(requestedUrls).toContain(GSP_URL);
    expect(view.result.current.geometry).toBeUndefined();
    expect(view.result.current.isLoading).toBe(true);

    // The user switches to DNO while the 9 MB GSP file is still in flight.
    view.rerender({ level: DNO_LEVEL });
    expect(requestedUrls).toContain(DNO_SHAPES_URL);
    expect(requestedUrls).toContain(DNO_GROUPINGS_URL);

    // The smaller DNO assets land first.
    await settle(DNO_SHAPES_URL, dnoShapes);
    await settle(DNO_GROUPINGS_URL, { "UKPN (East)": ["citr_1"] });

    await waitFor(() => expect(view.result.current.geometry).toBeDefined());
    expect(view.result.current.geometry!.features[0].id).toBe("UKPN (East)");
    expect(view.result.current.groupings).toEqual({ "UKPN (East)": ["citr_1"] });

    // Now the stale GSP fetch finally resolves. This is the whole test: nothing about the
    // displayed geometry may move, and in particular the GSP feature id (67, the numeric
    // gsp_id the click handler coerces with `Number()`) must not appear on the DNO polygons.
    const beforeStale = view.result.current.geometry;
    await settle(GSP_URL, gspShapes);

    expect(view.result.current.geometry).toBe(beforeStale);
    expect(view.result.current.geometry!.features).toHaveLength(1);
    expect(view.result.current.geometry!.features[0].id).toBe("UKPN (East)");
    expect(view.result.current.geometry!.features.map((f) => f.id)).not.toContain(67);
    expect(view.result.current.groupings).toEqual({ "UKPN (East)": ["citr_1"] });
  });

  test("switching back to a level whose asset already resolved uses it immediately", async () => {
    const view = renderHook(
      ({ level }: { level: AggregationLevel }) => useMapGeometry(level, regions),
      { initialProps: { level: GSP_LEVEL } }
    );

    view.rerender({ level: DNO_LEVEL });
    await settle(DNO_SHAPES_URL, dnoShapes);
    await settle(DNO_GROUPINGS_URL, { "UKPN (East)": ["citr_1"] });
    await settle(GSP_URL, gspShapes);

    // Back to GSP. The response arrived while the level was elsewhere and was correctly
    // ignored; it must not have been *lost*, so this resolves without a second fetch.
    view.rerender({ level: GSP_LEVEL });
    await waitFor(() => expect(view.result.current.geometry?.features[0].id).toBe(67));
    expect(view.result.current.groupings).toBeUndefined();
    expect(requestedUrls.filter((url) => url === GSP_URL)).toHaveLength(1);
  });

  test("a failed fetch surfaces as an error and stops reporting as loading", async () => {
    const view = renderHook(() => useMapGeometry(GSP_LEVEL, regions));
    await act(async () => {
      deferrals.get(GSP_URL)!.reject(new Error("502"));
      promises.delete(GSP_URL); // the real module evicts a rejection so a retry is possible
    });
    await waitFor(() => expect(view.result.current.error).toBeDefined());
    expect(view.result.current.isLoading).toBe(false);
    expect(view.result.current.geometry).toBeUndefined();
  });
});

describe("useLevelGroupings", () => {
  test("fetches the grouping file alone — not the level's polygons", async () => {
    const view = renderHook(() => useLevelGroupings(DNO_LEVEL));

    // The point of the separate hook: the GSP chart resolving a DNO selection must not drag
    // GB's 9 MB boundary file in behind it.
    expect(requestedUrls).toEqual([DNO_GROUPINGS_URL]);

    await settle(DNO_GROUPINGS_URL, { ENWL: ["bred_1", "carr_1"] });
    await waitFor(() => expect(view.result.current.data).toBeDefined());
    expect(view.result.current.data!.ENWL).toEqual(["bred_1", "carr_1"]);
  });

  test("a non-derived level has no groupings and fetches nothing", () => {
    const view = renderHook(() => useLevelGroupings(GSP_LEVEL));
    expect(requestedUrls).toEqual([]);
    expect(view.result.current.data).toBeUndefined();
    expect(view.result.current.isLoading).toBe(false);
  });
});
