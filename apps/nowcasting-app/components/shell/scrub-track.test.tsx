/**
 * The scrub track's wiring, through the real component.
 *
 * The arithmetic is pinned in `scrub-scale.test.ts`; what this adds is the two claims the pure
 * tests cannot make. First, that the track has **no position state of its own** — the handle is
 * derived from `selectedISOTime`, which is what makes it follow the chart click, the arrow keys
 * and the play button without any of them knowing it exists. Second, that the **grain is
 * re-derived from the enabled set**, so toggling NL changes what the control can reach rather
 * than only what the readout says.
 *
 * Pointer dragging is deliberately not asserted here: jsdom gives every element a zero-width
 * `getBoundingClientRect`, so a synthetic drag would exercise the fallback rather than the
 * conversion. The conversion is `fractionForClientX` and it is pinned pure.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("./use-cursor-range", () => ({
  __esModule: true,
  default: () => mockRange,
  useCursorRange: () => mockRange
}));

import { setEnabledCountries, setGlobalState } from "../helpers/globalState";
import ScrubTrack from "./scrub-track";
import type { CursorRange } from "./scrub-scale";

// A 48-hour window on the 30-minute grid, as a GB forecast axis is.
const RANGE: CursorRange = { start: "2026-08-10T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" };
let mockRange: CursorRange | null = RANGE;

const slider = () => screen.getByRole("slider");
const cursor = () => require("../helpers/globalState").getGlobalState("selectedISOTime");

beforeEach(() => {
  mockRange = RANGE;
  setEnabledCountries(["GB"]);
  setGlobalState("selectedISOTime", "2026-08-11T00:00:00.000Z");
  setGlobalState("timeNow", "2026-08-10T12:00:00.000Z");
});

afterEach(() => {
  setEnabledCountries(["GB"]);
});

describe("what the track reports", () => {
  test("counts positions in slots, not pixels or milliseconds", () => {
    render(<ScrubTrack />);
    expect(slider()).toHaveAttribute("aria-valuemin", "0");
    expect(slider()).toHaveAttribute("aria-valuemax", "96");
    expect(slider()).toHaveAttribute("aria-valuenow", "48");
    expect(slider()).toHaveAttribute("aria-valuetext", "Tue 11 Aug 00:00 UTC");
  });

  test("names the grain it is currently stepping on", () => {
    render(<ScrubTrack />);
    expect(slider()).toHaveAccessibleName("Time cursor, 30-minute steps");
  });

  test("draws an inert track rather than guessing a window it has no data for", () => {
    mockRange = null;
    render(<ScrubTrack />);
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.getByTestId("scrub-track-idle")).toBeInTheDocument();
  });
});

describe("following the cursor's other inputs", () => {
  test("the handle is derived from shared state, so anything that writes it moves the handle", () => {
    const view = render(<ScrubTrack />);
    expect(slider()).toHaveAttribute("aria-valuenow", "48");

    // Exactly what the chart click, an arrow key and a play tick all do.
    act(() => setGlobalState("selectedISOTime", "2026-08-11T06:00:00.000Z"));
    view.rerender(<ScrubTrack />);
    expect(slider()).toHaveAttribute("aria-valuenow", "60");
  });

  test("a cursor written off the track is shown at the end it ran past", () => {
    setGlobalState("selectedISOTime", "2026-09-01T00:00:00.000Z");
    render(<ScrubTrack />);
    expect(slider()).toHaveAttribute("aria-valuenow", "96");
  });
});

describe("the keyboard", () => {
  test("arrows step one slot, and the ends do not wrap", () => {
    render(<ScrubTrack />);
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(cursor()).toBe("2026-08-11T00:30:00.000Z");
    fireEvent.keyDown(slider(), { key: "ArrowLeft" });
    fireEvent.keyDown(slider(), { key: "ArrowLeft" });
    expect(cursor()).toBe("2026-08-10T23:30:00.000Z");

    fireEvent.keyDown(slider(), { key: "Home" });
    expect(cursor()).toBe(RANGE.start);
    fireEvent.keyDown(slider(), { key: "ArrowLeft" });
    expect(cursor()).toBe(RANGE.start);

    fireEvent.keyDown(slider(), { key: "End" });
    expect(cursor()).toBe(RANGE.end);
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(cursor()).toBe(RANGE.end);
  });

  test("page keys jump three hours, on the grid", () => {
    render(<ScrubTrack />);
    fireEvent.keyDown(slider(), { key: "PageUp" });
    expect(cursor()).toBe("2026-08-11T03:00:00.000Z");
    fireEvent.keyDown(slider(), { key: "PageDown" });
    expect(cursor()).toBe("2026-08-11T00:00:00.000Z");
  });

  test("a key the track does not own is left alone for the app's other handlers", () => {
    render(<ScrubTrack />);
    fireEvent.keyDown(slider(), { key: "a" });
    expect(cursor()).toBe("2026-08-11T00:00:00.000Z");
  });
});

describe("when the enabled set changes underneath it", () => {
  test("the grid refines with NL enabled, and the reachable positions double", () => {
    const view = render(<ScrubTrack />);
    expect(slider()).toHaveAttribute("aria-valuemax", "96");

    act(() => setEnabledCountries(["GB", "NL"]));
    view.rerender(<ScrubTrack />);
    expect(slider()).toHaveAttribute("aria-valuemax", "192");
    expect(slider()).toHaveAccessibleName("Time cursor, 15-minute steps");

    // And a step is now a quarter hour rather than a half.
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(cursor()).toBe("2026-08-11T00:15:00.000Z");
  });

  test("coarsening the grid moves the cursor forward onto a slot GB actually publishes", () => {
    setEnabledCountries(["GB", "NL"]);
    const view = render(<ScrubTrack />);
    act(() => setGlobalState("selectedISOTime", "2026-08-11T00:15:00.000Z"));
    view.rerender(<ScrubTrack />);
    expect(slider()).toHaveAttribute("aria-valuenow", "97");

    // `globalState.resnapCursorToGrid` owns the re-snap; the track must agree with it rather
    // than round the other way and leave the handle a slot behind the map.
    act(() => setEnabledCountries(["GB"]));
    view.rerender(<ScrubTrack />);
    expect(cursor()).toBe("2026-08-11T00:30:00.000Z");
    expect(slider()).toHaveAttribute("aria-valuenow", "49");
  });
});
