import { describe, expect, it } from "@jest/globals";

import {
  CHART_SPLIT,
  MAP_CONTROL_WIDTH_PX,
  MIN_CHART_HEIGHT_PX,
  MIN_CHART_WIDTH_PX,
  STAGE_GUTTER_PX,
  chartModeFor,
  clampChartSplit,
  maxChartWidthPx,
  resolveChartSplit
} from "./geometry";

// The pure oracle for OPEN 5's override: seeding from `CHART_SPLIT`, per-mode isolation, mode
// switching restoring the right remembered size, and clamping (min, max, and the width cap that
// keeps the top-anchored chart clear of the top-right control dock). Drag feel and frame timing
// live in `use-resizable-chart-split.ts` and are not tested here — nothing there is a pure
// function of its inputs.

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

describe("maxChartWidthPx", () => {
  const containerWidthPx = 1400;
  const dockLeftEdgePx = containerWidthPx - STAGE_GUTTER_PX - MAP_CONTROL_WIDTH_PX;

  it("stops a gutter short of the dock's left edge, from a gutter's inset", () => {
    // The chart starts at `STAGE_GUTTER_PX` from the left, so its right edge lands at
    // `STAGE_GUTTER_PX + maxChartWidthPx` — which must clear the dock by one gutter.
    const chartRightEdgePx = STAGE_GUTTER_PX + maxChartWidthPx(containerWidthPx);
    expect(chartRightEdgePx).toBe(dockLeftEdgePx - STAGE_GUTTER_PX);
  });

  it("shrinks with the container, since the dock is pinned to its right edge", () => {
    expect(maxChartWidthPx(1000)).toBe(maxChartWidthPx(1400) - 400);
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

  it("caps width short of the control dock's column", () => {
    const huge = { width: 500, height: 10 };
    const clamped = clampChartSplit(huge, wideContainer);
    const expectedMaxWidthPercent =
      (maxChartWidthPx(wideContainer.widthPx) / wideContainer.widthPx) * 100;
    expect(clamped.width).toBeCloseTo(expectedMaxWidthPercent);
    // And that cap is strictly tighter than the bare gutters would give — the dock's column is
    // what is being reserved, so the chart may not simply span the inset.
    const gutteredWidthPercent =
      ((wideContainer.widthPx - STAGE_GUTTER_PX * 2) / wideContainer.widthPx) * 100;
    expect(clamped.width).toBeLessThan(gutteredWidthPercent);
  });

  it("reaches CHART_SPLIT.selected's 90% height on a normal-width stage", () => {
    // Regression from when the clamp reserved height for the dock unconditionally, discarding
    // the 90% seed. Top-anchored the dock costs width, never height, so this is now true of any
    // seed height at all — the panel runs to the bottom gutter whatever the dock is doing.
    const clamped = clampChartSplit(CHART_SPLIT.selected, wideContainer);
    expect(clamped).toEqual(CHART_SPLIT.selected);
  });

  it("caps height only at the bottom gutter, whatever the chart's width", () => {
    const tall = { width: 90, height: 99.9 };
    const expectedMaxHeightPercent =
      ((wideContainer.heightPx - STAGE_GUTTER_PX * 2) / wideContainer.heightPx) * 100;
    expect(clampChartSplit(tall, wideContainer).height).toBeCloseTo(expectedMaxHeightPercent);
    // A narrow chart on the same stage gets exactly the same height ceiling: width and height
    // are independent now, which is the whole simplification the top anchor bought.
    const narrow = { width: 30, height: 99.9 };
    expect(clampChartSplit(narrow, wideContainer).height).toBeCloseTo(expectedMaxHeightPercent);
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
