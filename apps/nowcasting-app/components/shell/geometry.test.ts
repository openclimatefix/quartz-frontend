import { describe, expect, it } from "@jest/globals";

import {
  CHART_SPLIT,
  MAP_CONTROL_WIDTH_PX,
  MIN_CHART_HEIGHT_PX,
  MIN_CHART_WIDTH_PX,
  STAGE_GUTTER_PX,
  chartModeFor,
  clampChartSplit,
  overlapsControlDock,
  resolveChartSplit
} from "./geometry";

// The pure oracle for OPEN 5's override: seeding from `CHART_SPLIT`, per-mode isolation, mode
// switching restoring the right remembered size, and clamping (min, max, and the overlap-aware
// version of the control-panel reserve that fixed the `selected` height bug). Drag feel and
// frame timing live in `use-resizable-chart-split.ts` and are not tested here — nothing there
// is a pure function of its inputs.

describe("chartModeFor", () => {
  it("is plain with neither comparison nor a selection", () => {
    expect(chartModeFor(false, false)).toBe("plain");
  });

  it("is comparing with a comparison active and nothing selected", () => {
    expect(chartModeFor(true, false)).toBe("comparing");
  });

  it("is selected with a region selected and no comparison", () => {
    expect(chartModeFor(false, true)).toBe("selected");
  });

  it("is comparingSelected with both", () => {
    expect(chartModeFor(true, true)).toBe("comparingSelected");
  });
});

describe("resolveChartSplit", () => {
  it("seeds from CHART_SPLIT when nothing is stored", () => {
    expect(resolveChartSplit("plain", {})).toEqual(CHART_SPLIT.plain);
    expect(resolveChartSplit("selected", {})).toEqual(CHART_SPLIT.selected);
  });

  it("prefers a stored override over the seed", () => {
    const overrides = { plain: { width: 60, height: 70 } };
    expect(resolveChartSplit("plain", overrides)).toEqual({ width: 60, height: 70 });
  });

  it("keeps modes isolated — sizing one does not touch another", () => {
    const overrides = { plain: { width: 60, height: 70 } };
    // `comparing` has no entry of its own, so it must still read its seed, not `plain`'s size.
    expect(resolveChartSplit("comparing", overrides)).toEqual(CHART_SPLIT.comparing);
  });

  it("restores a mode's remembered size on switching back to it, not a default", () => {
    const overrides = {
      plain: { width: 60, height: 70 },
      selected: { width: 80, height: 95 }
    };
    expect(resolveChartSplit("plain", overrides)).toEqual({ width: 60, height: 70 });
    expect(resolveChartSplit("selected", overrides)).toEqual({ width: 80, height: 95 });
    // Switching back — same lookup, same answer, no drift.
    expect(resolveChartSplit("plain", overrides)).toEqual({ width: 60, height: 70 });
  });
});

describe("overlapsControlDock", () => {
  const containerWidthPx = 1400;
  const dockLeftEdgePx = containerWidthPx - STAGE_GUTTER_PX - MAP_CONTROL_WIDTH_PX;

  it("does not overlap when the chart's right edge stays left of the dock", () => {
    const chartWidthPx = dockLeftEdgePx - STAGE_GUTTER_PX - 1;
    expect(overlapsControlDock(chartWidthPx, containerWidthPx)).toBe(false);
  });

  it("overlaps once the chart's right edge reaches the dock's column", () => {
    const chartWidthPx = dockLeftEdgePx - STAGE_GUTTER_PX + 1;
    expect(overlapsControlDock(chartWidthPx, containerWidthPx)).toBe(true);
  });
});

describe("clampChartSplit", () => {
  // A generous desktop stage — wide enough that a `selected`-width chart (54%) never reaches
  // the control dock's column, and tall enough that a modest height has real headroom.
  const wideContainer = { widthPx: 1400, heightPx: 900 };

  it("passes a split through unclamped before the container is measured", () => {
    const split = { width: 200, height: 200 };
    expect(clampChartSplit(split, { widthPx: 0, heightPx: 0 })).toEqual(split);
  });

  it("enforces the minimum size so the chart cannot shrink to a sliver", () => {
    const tiny = { width: 0.1, height: 0.1 };
    const clamped = clampChartSplit(tiny, wideContainer);
    expect(clamped.width).toBeCloseTo((MIN_CHART_WIDTH_PX / wideContainer.widthPx) * 100);
    expect(clamped.height).toBeCloseTo((MIN_CHART_HEIGHT_PX / wideContainer.heightPx) * 100);
  });

  it("caps width at the inset's gutters, regardless of the control dock", () => {
    const huge = { width: 500, height: 10 };
    const clamped = clampChartSplit(huge, wideContainer);
    const expectedMaxWidthPercent =
      ((wideContainer.widthPx - STAGE_GUTTER_PX * 2) / wideContainer.widthPx) * 100;
    expect(clamped.width).toBeCloseTo(expectedMaxWidthPercent);
  });

  it("reaches CHART_SPLIT.selected's 90% height on a normal-width stage — the bug this fixes", () => {
    // Regression: `selected` used to be clamped by a height cap applied unconditionally,
    // discarding the 90% seed even though a 54%-wide chart never reaches the dock's column on
    // any realistic screen. It must be fully reachable here.
    const clamped = clampChartSplit(CHART_SPLIT.selected, wideContainer);
    expect(clamped).toEqual(CHART_SPLIT.selected);
  });

  it("reserves height for the control dock once the chart's width actually overlaps it", () => {
    // A wide, short container where the seed's width does reach under the dock.
    const narrowerContainer = { widthPx: 700, heightPx: 900 };
    const wide = { width: 90, height: 95 };
    const controlPanelReservePx = 350;
    const clamped = clampChartSplit(wide, narrowerContainer, controlPanelReservePx);
    const expectedMaxHeightPercent =
      ((narrowerContainer.heightPx - (controlPanelReservePx + STAGE_GUTTER_PX)) /
        narrowerContainer.heightPx) *
      100;
    expect(clamped.height).toBeCloseTo(expectedMaxHeightPercent);
  });

  it("never lets the maximum fall below the minimum on a very small container", () => {
    const tinyContainer = { widthPx: 200, heightPx: 200 };
    const clamped = clampChartSplit({ width: 50, height: 50 }, tinyContainer);
    expect(clamped.width).toBeGreaterThan(0);
    expect(clamped.height).toBeGreaterThan(0);
    expect(Number.isFinite(clamped.width)).toBe(true);
    expect(Number.isFinite(clamped.height)).toBe(true);
  });
});
