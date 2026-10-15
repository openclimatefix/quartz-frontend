/**
 * `/sites` boundary sources — D-map review, finding D5.
 *
 * `addOrUpdateMapGroup` runs on every cursor step. The GSP (9 MB) and DNO (1.4 MB) boundary
 * collections must reach the Mapbox worker once per source instance, not on every pass. The
 * case the unconditional `setData` was added for must still work: the source is added empty
 * before the fetch resolves and is populated on the next pass after the data arrives.
 */
import { expect, jest, test } from "@jest/globals";
import type mapboxgl from "mapbox-gl";
import type { FeatureCollection } from "geojson";

import { setBoundarySourceData } from "./mapUtils";

const fakeMap = () => {
  const sources = new Map<string, { data: unknown; setData: jest.Mock }>();
  const addSource = jest.fn((id: string, spec: { data: unknown }) => {
    const source = {
      data: spec.data,
      setData: jest.fn((next: unknown) => {
        source.data = next;
      })
    };
    sources.set(id, source);
  });
  return {
    map: {
      getSource: (id: string) => sources.get(id),
      addSource
    } as unknown as mapboxgl.Map,
    sources,
    addSource,
    /** What a style reload does to the sources. */
    dropSources: () => sources.clear()
  };
};

const shapes = (): FeatureCollection => ({
  type: "FeatureCollection",
  features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [0, 51] } }]
});

test("repeated passes with the same shape data send it once", () => {
  const { map, sources, addSource } = fakeMap();
  const gsp = shapes();

  setBoundarySourceData(map, "gspBoundaries", gsp);
  setBoundarySourceData(map, "gspBoundaries", gsp);
  setBoundarySourceData(map, "gspBoundaries", gsp);

  expect(addSource).toHaveBeenCalledTimes(1);
  expect(sources.get("gspBoundaries")!.data).toBe(gsp);
  expect(sources.get("gspBoundaries")!.setData).not.toHaveBeenCalled();
});

test("a source added empty before the fetch resolves is populated once the data arrives", () => {
  const { map, sources } = fakeMap();

  setBoundarySourceData(map, "dnoBoundaries", undefined);
  expect(sources.get("dnoBoundaries")!.data).toEqual({ type: "FeatureCollection", features: [] });

  const dno = shapes();
  setBoundarySourceData(map, "dnoBoundaries", dno);
  setBoundarySourceData(map, "dnoBoundaries", dno);

  const source = sources.get("dnoBoundaries")!;
  expect(source.setData).toHaveBeenCalledTimes(1);
  expect(source.data).toBe(dno);
});

test("a new shape data object is sent", () => {
  const { map, sources } = fakeMap();
  setBoundarySourceData(map, "gspBoundaries", shapes());
  const next = shapes();
  setBoundarySourceData(map, "gspBoundaries", next);
  expect(sources.get("gspBoundaries")!.setData).toHaveBeenCalledTimes(1);
  expect(sources.get("gspBoundaries")!.data).toBe(next);
});

test("after a style reload drops the source it is re-added with the data", () => {
  const { map, sources, addSource, dropSources } = fakeMap();
  const gsp = shapes();
  setBoundarySourceData(map, "gspBoundaries", gsp);

  dropSources();
  setBoundarySourceData(map, "gspBoundaries", gsp);

  expect(addSource).toHaveBeenCalledTimes(2);
  expect(sources.get("gspBoundaries")!.data).toBe(gsp);
});
