/**
 * Play/follow mutual exclusion — Phase 6 followup, Track P.
 *
 * There are two different ways the cursor moves on its own — playing (`isPlaying`, this
 * component's own interval) and following now (`intervals`, `use-and-update-selected-time`'s
 * 60-second interval) — and the brief's whole point is that they can never both be true.
 * `play()` already stopped following (it calls `stopTime`); what was missing, and what this
 * pins, is the other direction: resuming following — exactly what the footer's `now` button
 * does via `resetTime` — must stop an in-progress play.
 */
import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { getGlobalState, setGlobalState } from "../helpers/globalState";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import PlayButton from "./index";

const START = "2026-08-11T00:00:00.000Z";
const END = "2026-08-11T02:00:00.000Z";

// The real mechanism the footer's `now` button uses — exercising this rather than poking
// `intervals` directly is what makes the second test prove the actual wiring, not a stand-in.
const NowButton: React.FC = () => {
  const { resetTime } = useStopAndResetTime();
  return (
    <button type="button" onClick={resetTime}>
      now
    </button>
  );
};

beforeEach(() => {
  setGlobalState("isPlaying", false);
  setGlobalState("intervals", []);
  setGlobalState("selectedISOTime", START);
});

afterEach(() => {
  // `resetTime`/`play` both start real `setInterval`s; clear whatever is outstanding so a test
  // doesn't leak a timer that fires after the test (and the file's assertions) are done.
  (getGlobalState("intervals") as ReturnType<typeof setInterval>[]).forEach((id) =>
    clearInterval(id)
  );
  setGlobalState("intervals", []);
  setGlobalState("isPlaying", false);
});

describe("starting playback stops following", () => {
  test("clicking play clears the following interval", () => {
    setGlobalState("intervals", [1 as unknown as ReturnType<typeof setInterval>]);
    render(<PlayButton startTime={START} endTime={END} />);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
    });

    expect(getGlobalState("isPlaying")).toBe(true);
    expect(getGlobalState("intervals")).toEqual([]);

    // Stop the real interval this test started, rather than letting `afterEach` race it.
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    });
  });
});

describe("returning to now stops playback", () => {
  test("resuming following pauses an in-progress play", () => {
    render(
      <>
        <PlayButton startTime={START} endTime={END} />
        <NowButton />
      </>
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
    });
    expect(getGlobalState("isPlaying")).toBe(true);

    // The footer's actual control for resuming following, not a direct write to `intervals`.
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "now" }));
    });

    expect(getGlobalState("isPlaying")).toBe(false);
    expect(getGlobalState("intervals").length).toBeGreaterThan(0);
  });

  test("clicking now while not playing is a no-op for the play flag", () => {
    render(
      <>
        <PlayButton startTime={START} endTime={END} />
        <NowButton />
      </>
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "now" }));
    });

    expect(getGlobalState("isPlaying")).toBe(false);
  });
});
