/**
 * `Map`'s `load` handler calls the *latest* `loadDataOverlay`, not the first render's.
 *
 * The handler is registered once, in a mount effect with `[]` deps, so calling the prop from it
 * closes over whatever the first render held. That render's overlay ran before its geometry had
 * arrived, and could overwrite geometry a later render had already pushed. Nothing errors: the
 * map just has no fill and no borders. The handler goes through `loadDataOverlayRef`, which is
 * reassigned every render; this pins that.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react";

import Map from "./map";

// Mapbox needs WebGL, which jsdom does not have. The `on("load", cb)` handlers are captured so
// the test can fire the event itself; the rest is just enough surface for the effects to run.
const loadHandlers: Array<() => void> = [];
jest.mock("mapbox-gl", () => {
  class FakeMap {
    on(type: string, handler: () => void) {
      if (type === "load") loadHandlers.push(handler);
    }
    off() {}
    resize() {}
    getStyle() {
      return { layers: [] };
    }
    getLayer() {
      return undefined;
    }
    getSource() {
      return undefined;
    }
  }
  return { __esModule: true, default: { Map: FakeMap, supported: () => true, accessToken: "" } };
});

// quick-lru ships ESM only, which this jest config does not transform; a plain Map will do (`globalThis`, as the component import shadows `Map`).
jest.mock("quick-lru", () => ({
  __esModule: true,
  default: class extends globalThis.Map {
    constructor() {
      super();
    }
  }
}));

jest.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}), { virtual: true });

describe("Map load handler", () => {
  const originalCi = process.env.NEXT_PUBLIC_CI;

  beforeEach(() => {
    loadHandlers.length = 0;
    // `NEXT_PUBLIC_CI === "true"` makes the init effect return before it creates the map.
    delete process.env.NEXT_PUBLIC_CI;
    // jsdom has no ResizeObserver; the map's resize effect constructs one on mount.
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    if (originalCi === undefined) delete process.env.NEXT_PUBLIC_CI;
    else process.env.NEXT_PUBLIC_CI = originalCi;
  });

  test("calls the overlay from the latest render, not the one that registered the handler", () => {
    const fnA = jest.fn();
    const fnB = jest.fn();
    const props = {
      controlOverlay: () => null,
      updateData: { newData: false, updateMapData: () => {} },
      title: "test"
    };

    const { rerender } = render(<Map {...props} loadDataOverlay={fnA} />);
    rerender(<Map {...props} loadDataOverlay={fnB} />);

    expect(loadHandlers).toHaveLength(1);
    loadHandlers.forEach((handler) => handler());

    expect(fnB).toHaveBeenCalledTimes(1);
    expect(fnA).not.toHaveBeenCalled();
  });
});
