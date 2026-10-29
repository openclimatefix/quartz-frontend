/**
 * `applyFeatureStates` writes only what changed.
 *
 * The old path blanket-cleared the whole source and rewrote every feature on every cursor
 * tick — two full passes over ~332 features for GB, ~664 with NL enabled. Holding an arrow
 * key ran that tens of times a second, which is what made the cursor feel heavy once Track F
 * drew a second country.
 *
 * What is pinned here is the *contract*, not the speed: with no previous set it still does
 * the full blanket-clear-and-write (the only safe thing when the map's state is unknown), and
 * with one it writes exactly the features whose state actually differs — no more, and
 * crucially no fewer, since a missed write is a region rendering last tick's colour.
 */
import { describe, expect, it, jest } from "@jest/globals";

import { PV_SOURCE_ID, applyFeatureStates } from "./feature-state";
import { MapFeatureState } from "../helpers/data";

const state = (over: Partial<MapFeatureState> = {}): MapFeatureState =>
  ({
    power: 100,
    normalized: 0.5,
    capacity: 200,
    delta: 0,
    deltaBucket: 0,
    hasDelta: false,
    dataState: "value",
    ...over
  } as unknown as MapFeatureState);

const fakeMap = (ready = true) => {
  const setFeatureState = jest.fn();
  const removeFeatureState = jest.fn();
  return {
    map: {
      getSource: () => (ready ? {} : undefined),
      isSourceLoaded: () => ready,
      setFeatureState,
      removeFeatureState
    } as unknown as mapboxgl.Map,
    setFeatureState,
    removeFeatureState
  };
};

describe("applyFeatureStates", () => {
  it("does nothing and reports failure while the source is not ready", () => {
    const { map, setFeatureState } = fakeMap(false);
    expect(applyFeatureStates(map, new Map([["GB:1", state()]]))).toBe(false);
    expect(setFeatureState).not.toHaveBeenCalled();
  });

  it("blanket-clears and writes everything when the previous set is unknown", () => {
    const { map, setFeatureState, removeFeatureState } = fakeMap();
    const states = new Map([
      ["GB:1", state()],
      ["GB:2", state({ power: 10 })]
    ]);

    expect(applyFeatureStates(map, states, null)).toBe(true);
    expect(removeFeatureState).toHaveBeenCalledWith({ source: PV_SOURCE_ID });
    expect(setFeatureState).toHaveBeenCalledTimes(2);
  });

  it("writes only the features whose state changed", () => {
    const { map, setFeatureState, removeFeatureState } = fakeMap();
    const previous = new Map([
      ["GB:1", state({ power: 100 })],
      ["GB:2", state({ power: 200 })],
      ["GB:3", state({ power: 300 })]
    ]);
    const next = new Map([
      ["GB:1", state({ power: 100 })], // unchanged, equal by value not identity
      ["GB:2", state({ power: 999 })], // changed
      ["GB:3", state({ power: 300 })] // unchanged
    ]);

    expect(applyFeatureStates(map, next, previous)).toBe(true);
    // No blanket clear: that is the cost this change exists to avoid.
    expect(removeFeatureState).not.toHaveBeenCalledWith({ source: PV_SOURCE_ID });
    expect(setFeatureState).toHaveBeenCalledTimes(1);
    expect(setFeatureState).toHaveBeenCalledWith(
      { source: PV_SOURCE_ID, id: "GB:2" },
      next.get("GB:2")
    );
  });

  it("clears ids that dropped out of the payload, one by one", () => {
    const { map, setFeatureState, removeFeatureState } = fakeMap();
    const previous = new Map([
      ["GB:1", state()],
      ["NL:1", state()]
    ]);
    const next = new Map([["GB:1", state()]]);

    applyFeatureStates(map, next, previous);
    // NL toggled off: its features must stop rendering, which the blanket clear used to do.
    expect(removeFeatureState).toHaveBeenCalledWith({ source: PV_SOURCE_ID, id: "NL:1" });
    expect(setFeatureState).not.toHaveBeenCalled();
  });

  it("writes a feature that is new since the previous set", () => {
    const { map, setFeatureState } = fakeMap();
    const previous = new Map([["GB:1", state()]]);
    const next = new Map([
      ["GB:1", state()],
      ["NL:1", state()]
    ]);

    applyFeatureStates(map, next, previous);
    expect(setFeatureState).toHaveBeenCalledTimes(1);
    expect(setFeatureState).toHaveBeenCalledWith(
      { source: PV_SOURCE_ID, id: "NL:1" },
      expect.anything()
    );
  });
});
