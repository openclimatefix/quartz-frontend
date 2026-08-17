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

import { getCursorCadenceMinutes, getGlobalState, setGlobalState } from "../helpers/globalState";
import { addMinutesToISODate } from "../helpers/utils";
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
  setGlobalState("playbackSpeed", 1);
});

afterEach(() => {
  // `resetTime`/`play` both start real `setInterval`s; clear whatever is outstanding so a test
  // doesn't leak a timer that fires after the test (and the file's assertions) are done.
  (getGlobalState("intervals") as ReturnType<typeof setInterval>[]).forEach((id) =>
    clearInterval(id)
  );
  setGlobalState("intervals", []);
  setGlobalState("isPlaying", false);
  setGlobalState("playbackSpeed", 1);
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

/**
 * Speed control (1x/2x/4x). `FAR_END` is far enough past `START` that no test in this block
 * comes near the wrap-to-`startTime` case covered above — these are purely about the interval's
 * *period*, not its stride or its range.
 */
describe("speed control", () => {
  const FAR_END = addMinutesToISODate(START, 600);

  // Mirrors the component's own stepping (`getCursorCadenceMinutes()`), so the expected value
  // is derived the same way the cursor actually moves rather than a hardcoded slot count.
  const stepped = (from: string, ticks: number): string => {
    let time = from;
    for (let i = 0; i < ticks; i++) {
      time = addMinutesToISODate(time, getCursorCadenceMinutes());
    }
    return time;
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Still-mounted from the test above (RTL's own cleanup runs after this) — wrapped in `act`
    // so resetting shared state here doesn't warn about an update outside it.
    act(() => {
      (getGlobalState("intervals") as ReturnType<typeof setInterval>[]).forEach((id) =>
        clearInterval(id)
      );
      setGlobalState("intervals", []);
      setGlobalState("isPlaying", false);
      setGlobalState("playbackSpeed", 1);
    });
    jest.useRealTimers();
  });

  test.each([
    [1, 1],
    [2, 2],
    [4, 4]
  ])("%dx ticks the cursor %d time(s) per second", (speed, expectedTicks) => {
    render(<PlayButton startTime={START} endTime={FAR_END} />);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: `${speed}x` }));
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(getGlobalState("selectedISOTime")).toBe(stepped(START, expectedTicks));

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    });
  });

  test("changing speed mid-playback restarts the interval at the new rate immediately", () => {
    render(<PlayButton startTime={START} endTime={FAR_END} />);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
    });
    act(() => {
      // One 1x tick.
      jest.advanceTimersByTime(1000);
    });
    const afterFirstTick = getGlobalState("selectedISOTime");
    expect(afterFirstTick).toBe(stepped(START, 1));

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "4x" }));
    });
    act(() => {
      // If the old 1000ms interval were still running unchanged, this would produce one more
      // tick, not four — this is what actually distinguishes "restarted" from "left alone".
      jest.advanceTimersByTime(1000);
    });

    expect(getGlobalState("selectedISOTime")).toBe(stepped(afterFirstTick, 4));

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    });
  });

  test("changing speed while paused does not move the cursor or start playback", () => {
    render(<PlayButton startTime={START} endTime={FAR_END} />);
    const before = getGlobalState("selectedISOTime");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "2x" }));
    });

    expect(getGlobalState("selectedISOTime")).toBe(before);
    expect(getGlobalState("isPlaying")).toBe(false);

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(getGlobalState("selectedISOTime")).toBe(before);
  });

  test("the active speed is the only one marked pressed", () => {
    render(<PlayButton startTime={START} endTime={FAR_END} />);

    expect(screen.getByRole("button", { name: "1x" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "2x" })).toHaveAttribute("aria-pressed", "false");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "2x" }));
    });

    expect(screen.getByRole("button", { name: "1x" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "2x" })).toHaveAttribute("aria-pressed", "true");
  });
});
