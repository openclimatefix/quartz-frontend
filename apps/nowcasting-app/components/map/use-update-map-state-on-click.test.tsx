/**
 * The map's click path — `useUpdateMapStateOnClick`.
 *
 * The hazard this pins is the one the hook's own comments already name for *values*: the click
 * handler is registered exactly once (guarded by `isEventRegistertedRef`, deps `[map, isMapReady]`)
 * and therefore closes over whatever the render that registered it happened to hold. The hook
 * routes `focusedCountry` and `clickedMapRegionIds` through refs for precisely that reason.
 *
 * `useCountryState`'s *setter* has the same problem and is easy to miss, because it does not look
 * like captured data. It is memoised on `[setRecord, focusedCountry, key]` and writes through
 * `writeCountryScoped(previous, focusedCountry, next)` — so the setter captured at registration
 * writes to the country focused *then*, for the rest of the session, however many times focus
 * changes afterwards. The symptom is not an error: clicks silently land in another country's
 * slice, so the clicked country never appears to select and the other one accumulates a
 * selection nobody made.
 */
import { beforeEach, describe, expect, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react";

import {
  getGlobalState,
  setEnabledCountries,
  setFocusedCountry,
  setCountryState
} from "../helpers/globalState";
import useUpdateMapStateOnClick from "./use-update-map-state-on-click";

type ClickHandler = (event: {
  features?: Array<{ properties?: Record<string, unknown> }>;
  point: { x: number; y: number };
  originalEvent: { shiftKey: boolean };
}) => void;

/**
 * Just enough Mapbox for the click path: the layer lookup and filter the outline uses, and the
 * `on("click", layer, handler)` registration the hook hangs everything off.
 */
const fakeMap = () => {
  let filter: unknown = ["in", "featureKey", ""];
  const handlers: ClickHandler[] = [];
  return {
    map: {
      on: (_type: string, _layer: string, handler: ClickHandler) => handlers.push(handler),
      getLayer: () => ({}),
      getFilter: () => filter,
      setFilter: (_layer: string, next: unknown) => {
        filter = next;
      },
      queryRenderedFeatures: () => []
    } as unknown as mapboxgl.Map,
    click: (country: string, id: string) =>
      handlers.forEach((handler) =>
        handler({
          features: [{ properties: { id, regionCountry: country } }],
          point: { x: 10, y: 10 },
          originalEvent: { shiftKey: false }
        })
      )
  };
};

const selectionFor = (country: string): string[] =>
  (getGlobalState("selectedMapRegionIds") as Record<string, string[]>)[country] ?? [];

beforeEach(() => {
  setEnabledCountries(["GB", "NL"]);
  setFocusedCountry("GB");
  setCountryState("selectedMapRegionIds", [], "GB");
  setCountryState("selectedMapRegionIds", [], "NL");
});

describe("clicking a region writes to the country that was clicked", () => {
  test("the country focused at registration selects normally", () => {
    const { map, click } = fakeMap();
    renderHook(() => useUpdateMapStateOnClick({ map, isMapReady: true }));

    act(() => click("GB", "12"));

    expect(selectionFor("GB")).toEqual(["12"]);
  });

  test("a country focused *after* registration also selects — the stale-setter regression", () => {
    const { map, click } = fakeMap();
    const { rerender } = renderHook(() => useUpdateMapStateOnClick({ map, isMapReady: true }));

    // Focus moves after the click handler has already been registered. Nothing re-registers it:
    // `isEventRegistertedRef` is the point of the guard, and re-binding a Mapbox listener on
    // every focus change would be churn. The handler must therefore not depend on when it ran.
    act(() => setFocusedCountry("NL"));
    rerender();

    act(() => click("NL", "07"));

    // The clicked country holds the selection...
    expect(selectionFor("NL")).toEqual(["07"]);
    // ...and the country that merely happened to be focused at registration is untouched.
    expect(selectionFor("GB")).toEqual([]);
  });

  test("clicking a second region in the same country replaces the selection", () => {
    const { map, click } = fakeMap();
    const { rerender } = renderHook(() => useUpdateMapStateOnClick({ map, isMapReady: true }));

    act(() => setFocusedCountry("NL"));
    rerender();

    act(() => click("NL", "07"));
    rerender();
    act(() => click("NL", "08"));

    expect(selectionFor("NL")).toEqual(["08"]);
  });
});
