/**
 * D-map review, finding D1.
 *
 * GB GSP features carry a NUMERIC `properties.id` (`buildMapGeometry` sets it to `gsp_id`).
 * The shift-click path once pushed it raw while the plain-click path stringified it, so
 * shift-clicking a selected GB region added a second copy (`["5", 5]`) instead of deselecting it.
 * Both paths now go through one normalising function.
 */
import { beforeEach, expect, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react";

import {
  getGlobalState,
  setCountryState,
  setEnabledCountries,
  setFocusedCountry
} from "../helpers/globalState";
import useUpdateMapStateOnClick from "./use-update-map-state-on-click";

type Handler = (e: unknown) => void;

const fakeMap = () => {
  let filter: unknown = ["in", "featureKey", ""];
  const handlers: Handler[] = [];
  let rendered: unknown[] = [];
  return {
    map: {
      on: (_t: string, _l: string, h: Handler) => handlers.push(h),
      getLayer: () => ({}),
      getFilter: () => filter,
      setFilter: (_l: string, next: unknown) => {
        filter = next;
      },
      queryRenderedFeatures: () => rendered
    } as unknown as mapboxgl.Map,
    click: (id: number, shiftKey: boolean) => {
      const feature = { properties: { id, country: "GB" } };
      rendered = [feature];
      handlers.forEach((h) =>
        h({ features: [feature], point: { x: 1, y: 1 }, originalEvent: { shiftKey } })
      );
    }
  };
};

beforeEach(() => {
  setEnabledCountries(["GB"]);
  setFocusedCountry("GB");
  setCountryState("selectedMapRegionIds", [], "GB");
});

test("shift-clicking a selected GB GSP deselects it", () => {
  const { map, click } = fakeMap();
  const { rerender } = renderHook(() => useUpdateMapStateOnClick({ map, isMapReady: true }));

  act(() => click(5, false));
  rerender();
  expect((getGlobalState("selectedMapRegionIds") as Record<string, unknown[]>).GB).toEqual(["5"]);

  act(() => click(5, true));
  rerender();

  expect((getGlobalState("selectedMapRegionIds") as Record<string, unknown[]>).GB).toEqual([]);
});

test("shift-clicking an unselected GB GSP adds it as a string", () => {
  const { map, click } = fakeMap();
  const { rerender } = renderHook(() => useUpdateMapStateOnClick({ map, isMapReady: true }));

  act(() => click(5, false));
  rerender();
  act(() => click(7, true));
  rerender();

  expect((getGlobalState("selectedMapRegionIds") as Record<string, unknown[]>).GB).toEqual([
    "5",
    "7"
  ]);
});
