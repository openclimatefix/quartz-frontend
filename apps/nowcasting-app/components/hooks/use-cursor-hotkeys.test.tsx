/**
 * An arrow-key step is a deliberate input, so it stops following now, as the scrub track's
 * `beginUserInput` and the chart click do. While the app is following now (the default on load)
 * the 60-second interval in `use-and-update-selected-time` writes the cursor to now, so a step
 * that left it running was silently undone within a minute.
 */
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import React from "react";
import { act, fireEvent, render } from "@testing-library/react";

import { getCursorNow, getGlobalState, setGlobalState } from "../helpers/globalState";
import useAndUpdateSelectedTime from "./use-and-update-selected-time";
import useCursorHotkeys from "./use-cursor-hotkeys";

const Harness = () => {
  useAndUpdateSelectedTime();
  useCursorHotkeys();
  return null;
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-02T12:10:00Z"));
  setGlobalState("intervals", []);
  setGlobalState("isPlaying", false);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test("an arrow-key step is not undone by the follow-now interval", () => {
  render(<Harness />);
  act(() => setGlobalState("selectedISOTime", getCursorNow()));
  expect(getGlobalState("intervals").length).toBeGreaterThan(0); // following now

  act(() => {
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    fireEvent.keyDown(document, { key: "ArrowLeft" });
  });
  const stepped = getGlobalState("selectedISOTime");
  expect(stepped).not.toBe(getCursorNow());

  act(() => {
    jest.advanceTimersByTime(60_000);
  });
  expect(getGlobalState("selectedISOTime")).toBe(stepped);
});

test("an arrow-key step pauses playback", () => {
  render(<Harness />);
  act(() => setGlobalState("isPlaying", true));

  act(() => {
    fireEvent.keyDown(document, { key: "ArrowRight" });
  });
  expect(getGlobalState("isPlaying")).toBe(false);
});
