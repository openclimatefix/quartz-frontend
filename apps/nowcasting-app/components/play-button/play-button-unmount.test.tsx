/**
 * `PlayButton` is unmounted while playing whenever `pages/index.tsx` swaps PvRemixChart <->
 * DeltaViewChart (Forecast <-> Delta), or when `chart-scrubber.tsx` drops it because `playBounds`
 * went null. Its interval must not outlive it: an orphaned one keeps moving the cursor while the
 * freshly mounted instance reads "Play".
 */
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { getGlobalState, setGlobalState } from "../helpers/globalState";
import PlayButton from ".";

const START = "2026-08-11T00:00:00.000Z";
const END = "2026-08-11T10:00:00.000Z";

beforeEach(() => {
  jest.useFakeTimers();
  setGlobalState("isPlaying", false);
  setGlobalState("intervals", []);
  setGlobalState("selectedISOTime", START);
  setGlobalState("playbackSpeed", 1);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test("unmounting mid-play (chart swap) stops the cursor moving", () => {
  const first = render(<PlayButton startTime={START} endTime={END} />);
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
  });
  act(() => {
    jest.advanceTimersByTime(2000);
  });
  expect(getGlobalState("isPlaying")).toBe(true);

  // Forecast -> Delta: the old chart (and its PlayButton) unmounts, the new one mounts.
  first.unmount();
  render(<PlayButton startTime={START} endTime={END} />);
  expect(getGlobalState("isPlaying")).toBe(false);
  expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();

  const parked = getGlobalState("selectedISOTime");
  act(() => {
    jest.advanceTimersByTime(5000);
  });
  expect(getGlobalState("selectedISOTime")).toBe(parked);
});
