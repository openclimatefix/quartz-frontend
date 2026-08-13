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
 * The drag model is asserted here too, since the split between the handle's rate and the
 * commit's rate is precisely the kind of thing that looks right and is not. jsdom gives every
 * element a zero-width `getBoundingClientRect`, so the track is given a measurable one; and
 * `requestAnimationFrame` is replaced by a manual queue, so frames are *stepped* rather than
 * waited on. Frame timing itself is not under test — only that commits coalesce to one per
 * frame and that a release always commits the true final position exactly once.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("./use-cursor-range", () => ({
  __esModule: true,
  default: () => mockRangeData,
  useCursorRange: () => mockRangeData
}));

import useGlobalState, {
  getGlobalState,
  setEnabledCountries,
  setFocusedCountry,
  setGlobalState
} from "../helpers/globalState";
import ScrubTrack from "./scrub-track";
import type { CursorRange } from "./scrub-scale";
import type { CursorRangeData } from "./use-cursor-range";

// A 48-hour window on the 30-minute grid, as a GB forecast axis is. No daylight windows are
// under test here — that's `use-cursor-range.test.ts` and `scrub-scale.test.ts`'s job — so this
// suite's mock always reports none, which also exercises the "no daylight data" render path.
const RANGE: CursorRange = { start: "2026-08-10T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" };
let mockRangeData: CursorRangeData | null = { range: RANGE, daylight: [] };

const slider = () => screen.getByRole("slider");
const cursor = () => getGlobalState("selectedISOTime");

// The track laid out 480px wide from x=0, so a client x IS a pixel offset along it: the
// 48-hour window works out at 6 minutes per pixel, i.e. 5px per 30-minute slot.
const TRACK_WIDTH = 480;
const measureTrack = () => {
  const node = slider();
  node.getBoundingClientRect = () =>
    ({
      left: 0,
      width: TRACK_WIDTH,
      right: TRACK_WIDTH,
      top: 0,
      bottom: 28,
      height: 28,
      x: 0,
      y: 0
    } as DOMRect);
  // jsdom has no pointer capture; the component's calls must not throw.
  node.setPointerCapture = () => undefined;
  node.releasePointerCapture = () => undefined;
  node.hasPointerCapture = () => true;
};

/**
 * jsdom implements no `PointerEvent`, so Testing Library falls back to a bare `Event` and
 * **silently drops `clientX` and `button`** — a drag fired without this shim arrives at the
 * handler with both `undefined`, which reads as "not the primary button" and does nothing.
 * `MouseEvent` is what `PointerEvent` extends in the standard, and it carries the coordinates.
 */
class PointerEventShim extends MouseEvent {
  public pointerId: number;
  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}
(globalThis as unknown as { PointerEvent: typeof PointerEventShim }).PointerEvent =
  PointerEventShim;

const down = (clientX: number) =>
  fireEvent.pointerDown(slider(), { clientX, button: 0, pointerId: 1 });
const move = (clientX: number) => fireEvent.pointerMove(slider(), { clientX, pointerId: 1 });
const up = (clientX: number) => fireEvent.pointerUp(slider(), { clientX, pointerId: 1 });

/** Frames only advance when a test says so, so "once per frame" is observable. */
let frames: Array<() => void> = [];
const stepFrame = () => {
  const due = frames;
  frames = [];
  act(() => due.forEach((callback) => callback()));
};

/**
 * The sequence of cursor values that actually reached the rest of the app.
 *
 * Recorded as *values* rather than as a render count on purpose: how many times React chooses
 * to re-render a subscriber for one write is an implementation detail of the state library, and
 * asserting on it would pin something this track does not control. What "once per frame rather
 * than once per event" is really a claim about is which instants the map and the charts were
 * asked to draw — so that is what is collected, with consecutive repeats collapsed.
 */
let committed: string[] = [];
const CommitCounter: React.FC = () => {
  const [value] = useGlobalState("selectedISOTime");
  if (committed[committed.length - 1] !== value) committed.push(value);
  return null;
};
const renderTrack = () => {
  const view = render(
    <>
      <ScrubTrack />
      <CommitCounter />
    </>
  );
  measureTrack();
  committed = [];
  return view;
};

beforeEach(() => {
  frames = [];
  jest
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback: FrameRequestCallback) => {
      frames.push(() => callback(0));
      return frames.length;
    });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation((handle: number) => {
    frames[handle - 1] = () => undefined;
  });
  mockRangeData = { range: RANGE, daylight: [] };
  setEnabledCountries(["GB"]);
  setGlobalState("selectedISOTime", "2026-08-11T00:00:00.000Z");
  setGlobalState("timeNow", "2026-08-10T12:00:00.000Z");
  setGlobalState("isPlaying", false);
});

afterEach(() => {
  jest.restoreAllMocks();
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
    mockRangeData = null;
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

describe("dragging — the handle's rate and the commit's rate are not the same", () => {
  // x=240 is halfway, i.e. 2026-08-11T00:00 and slot 48. From there each 5px is one slot.
  test("a press commits at once, because a press is also a click", () => {
    renderTrack();
    down(250);
    expect(cursor()).toBe("2026-08-11T01:00:00.000Z");
    expect(committed).toEqual(["2026-08-11T01:00:00.000Z"]);
  });

  test("a run of moves commits once per frame, not once per event", () => {
    renderTrack();
    // Pressed at 01:00, not at the 00:00 the cursor already holds — writing a value identical
    // to the current one is free (React bails), so starting there would prove nothing.
    down(250);
    expect(cursor()).toBe("2026-08-11T01:00:00.000Z");
    expect(committed).toEqual(["2026-08-11T01:00:00.000Z"]);

    // Four pointer events inside one frame. This is the case that was janky: each of these
    // used to be a global write, and each global write rebuilds every enabled country's map
    // feature states and recomputes both charts.
    move(260);
    move(270);
    move(280);
    move(300);
    expect(committed).toEqual(["2026-08-11T01:00:00.000Z"]);
    expect(cursor()).toBe("2026-08-11T01:00:00.000Z");

    // The handle, meanwhile, has been tracking the pointer the whole time.
    expect(slider()).toHaveAttribute("aria-valuenow", "60");

    // One frame, one commit — and it carries the LATEST position, not a replay of the four.
    stepFrame();
    expect(cursor()).toBe("2026-08-11T06:00:00.000Z");
    // Two instants reached the app for five pointer events, and neither is an intermediate.
    expect(committed).toEqual(["2026-08-11T01:00:00.000Z", "2026-08-11T06:00:00.000Z"]);

    // No backlog left behind: a further frame has nothing to do.
    stepFrame();
    expect(committed).toEqual(["2026-08-11T01:00:00.000Z", "2026-08-11T06:00:00.000Z"]);
  });

  test("releasing commits the final position exactly once, and it is the snapped one", () => {
    renderTrack();
    down(250);
    move(260);
    move(283); // 1698 minutes from the start: 04:18, which is NOT on the grid

    // Release before the pending frame ever runs.
    up(283);
    // Ceiling, as everywhere: 04:18 belongs to the 04:30 slot. And 02:00, the intermediate the
    // pending frame was holding, never reached the app at all.
    expect(cursor()).toBe("2026-08-11T04:30:00.000Z");
    expect(committed).toEqual(["2026-08-11T01:00:00.000Z", "2026-08-11T04:30:00.000Z"]);

    // And the frame that was pending must not fire a second, stale commit.
    stepFrame();
    expect(cursor()).toBe("2026-08-11T04:30:00.000Z");
    expect(committed).toEqual(["2026-08-11T01:00:00.000Z", "2026-08-11T04:30:00.000Z"]);
  });

  test("the drag-local position is dropped on release, so the handle derives from state again", () => {
    renderTrack();
    down(240);
    move(300);
    up(300);
    expect(slider()).toHaveAttribute("aria-valuenow", "60");

    // Nothing of the drag outlives it: another input moves the handle as it does at rest.
    act(() => setGlobalState("selectedISOTime", "2026-08-10T12:00:00.000Z"));
    expect(slider()).toHaveAttribute("aria-valuenow", "24");
  });

  test("a drag does not fight the play button", () => {
    setGlobalState("isPlaying", true);
    renderTrack();
    down(250);
    // The play interval steps the cursor once a second from a ref of its own, which `stopTime`
    // does not clear. Without pausing it, it would walk over the drag.
    expect(getGlobalState("isPlaying")).toBe(false);
  });

  test("a pointer that leaves the track is clamped to its ends, not lost", () => {
    renderTrack();
    down(240);
    move(-500);
    stepFrame();
    expect(cursor()).toBe(RANGE.start);
    move(9999);
    stepFrame();
    expect(cursor()).toBe(RANGE.end);
  });

  test("moves before any press are ignored", () => {
    renderTrack();
    move(300);
    expect(committed).toEqual([]);
    expect(cursor()).toBe("2026-08-11T00:00:00.000Z");
  });
});

describe("when focus changes underneath it", () => {
  test("the grid refines when focus moves to the finer country, and positions double", () => {
    setEnabledCountries(["GB", "NL"]);
    const view = render(<ScrubTrack />);
    // Both countries are drawn, but GB is focused and GB publishes every 30 minutes — the
    // track steps on what is being read, not on the finest grid present.
    expect(slider()).toHaveAttribute("aria-valuemax", "96");

    act(() => setFocusedCountry("NL"));
    view.rerender(<ScrubTrack />);
    expect(slider()).toHaveAttribute("aria-valuemax", "192");
    expect(slider()).toHaveAccessibleName("Time cursor, 15-minute steps");

    // And a step is now a quarter hour rather than a half.
    fireEvent.keyDown(slider(), { key: "ArrowRight" });
    expect(cursor()).toBe("2026-08-11T00:15:00.000Z");
  });

  test("coarsening the grid moves the cursor forward onto a slot GB actually publishes", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("NL");
    const view = render(<ScrubTrack />);
    act(() => setGlobalState("selectedISOTime", "2026-08-11T00:15:00.000Z"));
    view.rerender(<ScrubTrack />);
    expect(slider()).toHaveAttribute("aria-valuenow", "97");

    // `globalState.resnapCursorToGrid` owns the re-snap; the track must agree with it rather
    // than round the other way and leave the handle a slot behind the map.
    act(() => setFocusedCountry("GB"));
    view.rerender(<ScrubTrack />);
    expect(cursor()).toBe("2026-08-11T00:30:00.000Z");
    expect(slider()).toHaveAttribute("aria-valuenow", "49");
  });

  test("enabling another country leaves the grid alone", () => {
    const view = render(<ScrubTrack />);
    expect(slider()).toHaveAttribute("aria-valuemax", "96");

    act(() => setEnabledCountries(["GB", "NL"]));
    view.rerender(<ScrubTrack />);
    expect(slider()).toHaveAttribute("aria-valuemax", "96");
  });
});

/**
 * Live is a mode, and the way back to it.
 *
 * The old readout chip rendered `selectedISOTime === timeNow` — an equality that is true while
 * nothing is following, if you scrub away and then land back on the current slot. What decides
 * it is whether `use-and-update-selected-time`'s 60-second interval exists. And until now there
 * was no way back to now at all except dragging the handle to the right pixel.
 */
describe("the live control", () => {
  test("offers the way back when the cursor is adrift, and says so", () => {
    setGlobalState("intervals", []);
    setGlobalState("selectedISOTime", "2026-08-11T06:00:00.000Z");
    render(<ScrubTrack zone="UTC" />);

    const live = screen.getByRole("button", { name: "Return to now" });
    expect(live).toHaveAttribute("aria-pressed", "false");
  });

  test("clicking it moves the cursor off its old slot and resumes following", () => {
    setGlobalState("intervals", []);
    setGlobalState("selectedISOTime", "2026-08-11T06:00:00.000Z");
    render(<ScrubTrack zone="UTC" />);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Return to now" }));
    });

    // Not compared against the `timeNow` global: `resetTime` derives now from the real clock,
    // so pinning an exact instant would pin the test to the machine's time. What the control
    // promises is that the cursor leaves where it was *and* that following restarts — the
    // second half is the mode, and is what the old equality-based chip could never express.
    expect(cursor()).not.toBe("2026-08-11T06:00:00.000Z");
    expect(getGlobalState("intervals").length).toBeGreaterThan(0);
  });

  test("gets out of the way once you are already there", () => {
    setGlobalState("selectedISOTime", "2026-08-11T06:00:00.000Z");
    setGlobalState("intervals", [1 as unknown as ReturnType<typeof setInterval>]);
    render(<ScrubTrack zone="UTC" />);

    // While live the cursor sits on the now mark, so the label lands on top of the handle and
    // hides the thing you would grab. It is a destination, and there is nowhere to go — so it
    // is not rendered at all. The tag's live dot is what says you are following.
    expect(screen.queryByRole("button", { name: /now/i })).not.toBeInTheDocument();
  });
});
