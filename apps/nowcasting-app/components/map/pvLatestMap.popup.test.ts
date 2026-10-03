/**
 * The hover popup's placement: never drawn before it has a position (meeting 2026-09-29 item 9),
 * and opened away from the floating chart and the top edge (item 10).
 *
 * The popup is a real `mapboxgl.Popup`; only the map is faked, with the handful of members the
 * popup calls. That keeps the Mapbox behaviour the fix depends on — `addTo` rebuilding the
 * container, `trackPointer` skipping placement until a mousemove — under test, not assumed.
 */
import { describe, expect, jest, test } from "@jest/globals";

jest.mock("next/router", () => ({ __esModule: true, default: { push: jest.fn() } }));
jest.mock("@sentry/nextjs", () => ({ __esModule: true, captureException: jest.fn() }));
jest.mock("@auth0/nextjs-auth0/client", () => ({
  __esModule: true,
  useUser: () => ({ user: null, isLoading: false, error: undefined })
}));
// The `<Map>` wrapper pulls in a stylesheet and ESM-only packages jest cannot parse, and none
// of it is under test here.
jest.mock("./index", () => ({
  __esModule: true,
  Map: () => null,
  FailedStateMap: () => null,
  LoadStateMap: () => null
}));

import mapboxgl from "mapbox-gl";
import { popupAnchorFor, showPopupAtPointer } from "./pvLatestMap";

/** Projects lng/lat straight to x/y pixels, so a position is easy to read back. */
const fakeMap = () => {
  const container = document.createElement("div");
  const listeners: Record<string, Array<(e: unknown) => void>> = {};
  const map = {
    getContainer: () => container,
    _canvasContainer: document.createElement("div"),
    on: (type: string, fn: (e: unknown) => void) => {
      (listeners[type] ??= []).push(fn);
    },
    off: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
    },
    fire: (type: string, e: unknown) => [...(listeners[type] ?? [])].forEach((f) => f(e)),
    _addPopup: () => undefined,
    _removePopup: () => undefined,
    _requestDomTask: (cb: () => void) => cb(),
    _showingGlobe: () => false,
    project: (ll: mapboxgl.LngLat) => new mapboxgl.Point(ll.lng, ll.lat),
    transform: { renderWorldCopies: false, width: 1000, height: 600 }
  };
  return map as typeof map & mapboxgl.Map;
};

const newPopup = () =>
  new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
    anchor: "bottom-right",
    maxWidth: "none"
  }).setHTML("<p>region</p>");

/** The popup's transform at the moment `addTo` returns, for every `addTo` call. */
const recordTransformOnAdd = (popup: mapboxgl.Popup) => {
  const seen: string[] = [];
  const addTo = popup.addTo.bind(popup);
  jest.spyOn(popup, "addTo").mockImplementation((m) => {
    addTo(m);
    seen.push(popup.getElement()?.style.transform ?? "");
    return popup;
  });
  return seen;
};

describe("showPopupAtPointer", () => {
  test("Mapbox leaves a closed popup unplaced after trackPointer().addTo() (the old call)", () => {
    const map = fakeMap();
    const popup = newPopup();
    const seen = recordTransformOnAdd(popup);

    popup.trackPointer().addTo(map);

    // The mechanism behind the top-left flash: no transform, so CSS puts it at (0, 0).
    expect(seen).toEqual([""]);
  });

  test("a closed popup is placed at the pointer by the time addTo returns", () => {
    const map = fakeMap();
    const popup = newPopup();
    const seen = recordTransformOnAdd(popup);

    showPopupAtPointer(popup, map, { lng: 120, lat: 80 }, "bottom-left");

    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("translate(120px,80px)");
    expect(popup.getElement()?.classList.contains("mapboxgl-popup-track-pointer")).toBe(true);
  });

  test("an open, tracking popup is not re-added, so its container is never rebuilt", () => {
    const map = fakeMap();
    const popup = newPopup();
    showPopupAtPointer(popup, map, { lng: 120, lat: 80 }, "bottom-right");
    const element = popup.getElement();
    const addTo = jest.spyOn(popup, "addTo");

    showPopupAtPointer(popup, map, { lng: 130, lat: 90 }, "bottom-left");
    map.fire("mousemove", { point: new mapboxgl.Point(130, 90) });

    expect(addTo).not.toHaveBeenCalled();
    expect(popup.getElement()).toBe(element);
    // The new anchor applies on the popup's own next placement.
    expect(element?.className).toContain("mapboxgl-popup-anchor-bottom-left");
    expect(element?.style.transform).toContain("translate(130px,90px)");
  });

  test("a popup the boundary layer pinned to a point goes back to tracking the pointer", () => {
    const map = fakeMap();
    const popup = newPopup();
    popup.setLngLat([10, 20]).addTo(map);

    showPopupAtPointer(popup, map, { lng: 120, lat: 80 }, "bottom-right");

    expect(popup.getElement()?.classList.contains("mapboxgl-popup-track-pointer")).toBe(true);
    expect(popup.getElement()?.style.transform).toContain("translate(120px,80px)");
  });
});

describe("popupAnchorFor", () => {
  // A 1000px map with the chart's right edge at 400px: the visible strip is 400–1000, midpoint 700.
  const mapWidth = 1000;
  const chartRight = 400;
  const height = 160;

  test("under the chart, the popup opens to the right of the pointer", () => {
    expect(popupAnchorFor({ x: 200, y: 400 }, mapWidth, chartRight, height)).toBe("bottom-left");
  });

  test("in the left half of the visible strip, it opens to the right", () => {
    expect(popupAnchorFor({ x: 650, y: 400 }, mapWidth, chartRight, height)).toBe("bottom-left");
  });

  test("in the right half of the visible strip, it opens to the left as before", () => {
    expect(popupAnchorFor({ x: 750, y: 400 }, mapWidth, chartRight, height)).toBe("bottom-right");
  });

  test("the split follows the chart's edge when the chart is resized", () => {
    // Same pointer as the previous test; a wider chart moves the midpoint past it.
    expect(popupAnchorFor({ x: 750, y: 400 }, mapWidth, 700, height)).toBe("bottom-left");
  });

  test("with no chart, the split is the middle of the map", () => {
    expect(popupAnchorFor({ x: 499, y: 400 }, mapWidth, 0, height)).toBe("bottom-left");
    expect(popupAnchorFor({ x: 501, y: 400 }, mapWidth, 0, height)).toBe("bottom-right");
  });

  test("near the top, the popup opens downwards", () => {
    expect(popupAnchorFor({ x: 650, y: 100 }, mapWidth, chartRight, height)).toBe("top-left");
    expect(popupAnchorFor({ x: 750, y: 100 }, mapWidth, chartRight, height)).toBe("top-right");
    expect(popupAnchorFor({ x: 750, y: 160 }, mapWidth, chartRight, height)).toBe("bottom-right");
  });
});
