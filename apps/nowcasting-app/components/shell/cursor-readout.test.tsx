/**
 * The footer's readout — Phase 6 followup, Track N.
 *
 * The pure resolution arithmetic (ceiling vs floor, DST, lag) is pinned in `lib/time/cursor.ts`'s
 * own tests; what this file pins is the plumbing this track changed: the axis reads in the
 * *focused* country's local time rather than a fixed UTC constant, that zone and the cursor's
 * cadence move together on a focus change (so the track's grain and its labels never disagree
 * about which country they are describing), and the focused country stops appearing twice —
 * once as the primary reading, once more in the per-country list it used to share with everyone.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

const MOCK_RANGE_DATA = {
  range: { start: "2026-08-10T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" },
  daylight: []
};

// A mutable box, not a constant: one test (the play button's "no data yet" case) needs the hook
// to report `null`, same trick `scrub-track.test.tsx` uses for its own "idle track" test.
let mockRangeData: typeof MOCK_RANGE_DATA | null = MOCK_RANGE_DATA;

jest.mock("./use-cursor-range", () => ({
  __esModule: true,
  default: () => mockRangeData,
  useCursorRange: () => mockRangeData
}));

import {
  getGlobalState,
  setEnabledCountries,
  setFocusedCountry,
  setGlobalState
} from "../helpers/globalState";
import CursorReadout from "./cursor-readout";

const slider = () => screen.getByRole("slider");

beforeEach(() => {
  mockRangeData = MOCK_RANGE_DATA;
  setEnabledCountries(["GB"]);
  setFocusedCountry("GB");
  setGlobalState("selectedISOTime", "2026-08-11T12:00:00.000Z");
  setGlobalState("timeNow", "2026-08-10T12:00:00.000Z");
  setGlobalState("isPlaying", false);
});

afterEach(() => {
  setEnabledCountries(["GB"]);
  setFocusedCountry("GB");
});

describe("the zone follows focus", () => {
  test("the track's axis reads in the focused country's zone, GB by default", () => {
    render(<CursorReadout />);
    // GB is UTC+1 (BST) on 11 Aug 2026, so 12:00 UTC reads as 13:00 locally.
    expect(slider()).toHaveAttribute("aria-valuetext", expect.stringContaining("13:00"));
  });

  test("switching focus to NL moves the axis's zone and the cadence together", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("NL");
    render(<CursorReadout />);
    // NL is UTC+2 (CEST) on 11 Aug 2026, so 12:00 UTC reads as 14:00 locally, and NL's
    // 15-minute cadence — not GB's 30 — is what the slider now reports stepping on.
    expect(slider()).toHaveAttribute("aria-valuetext", expect.stringContaining("14:00"));
    expect(slider()).toHaveAccessibleName("Time cursor, 15-minute steps");
  });

  test("UTC stays on screen, demoted rather than dropped", () => {
    render(<CursorReadout />);
    // "utc" is a row label in the stack now, not a suffix in a sentence — and the word
    // "Cursor" is gone: the footer *is* the cursor, so naming it explained nothing.
    expect(screen.getByText("utc")).toBeInTheDocument();
    expect(screen.getByText("utc").parentElement).toHaveTextContent("utc12:00");
    expect(screen.queryByText(/Cursor/)).not.toBeInTheDocument();
  });
});

/**
 * The stack holds every zone in a fixed slot, focused or not.
 *
 * This replaces "the focused country is not shown twice", which pinned the opposite rule:
 * the focused country used to be filtered out of the list because its time was shown
 * separately. That made a focus change *reorder* the readout — the one moment you most want a
 * stable reference is the moment it moved. Brad's call: keep every enabled country in the same
 * slot always, and let focus be a weight change instead of a membership change.
 */
describe("the zone stack", () => {
  test("lists every enabled country, including the focused one", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("GB");
    render(<CursorReadout />);
    // Counted by row, not by text: the focused country's code appears again in the track's
    // tethered tag, which is a different thing in a different place.
    const codes = screen
      .getAllByTitle(/published slot/)
      .map((node) => node.firstElementChild?.textContent);
    expect(codes).toEqual(["GB", "NL"]);
  });

  test("keeps both slots, in the same order, when focus moves", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("GB");
    const view = render(<CursorReadout />);
    const order = () =>
      screen.getAllByTitle(/published slot/).map((node) => node.firstElementChild?.textContent);
    expect(order()).toEqual(["GB", "NL"]);

    act(() => setFocusedCountry("NL"));
    view.rerender(<CursorReadout />);
    expect(order()).toEqual(["GB", "NL"]);
  });

  test("marks the focused country rather than moving it", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("NL");
    render(<CursorReadout />);
    // Scoped to the stack: the focused country's code also appears in the track's tethered
    // tag, so a bare `getByText` matches twice.
    const codeIn = (code: string) =>
      screen.getByTitle(new RegExp(`^${code} published slot`)).firstElementChild;
    expect(codeIn("NL")).toHaveClass("text-ocf-yellow");
    expect(codeIn("GB")).not.toHaveClass("text-ocf-yellow");
  });

  test("runs in registry order, not in the order countries were enabled", () => {
    // Enabled NL-first on purpose: the stack must not inherit that order, or it would reorder
    // itself as the user toggles countries. The registry reads GB then NL — which is also west
    // to east, though it is the file's order and not the offsets that decides.
    setEnabledCountries(["NL", "GB"]);
    setFocusedCountry("NL");
    render(<CursorReadout />);
    const order = screen
      .getAllByTitle(/published slot/)
      .map((node) => node.firstElementChild?.textContent);
    expect(order).toEqual(["GB", "NL"]);
  });
});

/**
 * Track P: the play button, fed from this component's own `useCursorRange()` call — the same
 * hook `ScrubTrack` reads to draw the strip.
 */
describe("the play button plays across the footer's own range", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    (getGlobalState("intervals") as ReturnType<typeof setInterval>[]).forEach((id) =>
      clearInterval(id)
    );
    setGlobalState("intervals", []);
    setGlobalState("isPlaying", false);
    jest.useRealTimers();
  });

  test("wraps at the range end useCursorRange returned, not a separately computed one", () => {
    // Parked one step before the mocked range's own end — playing one tick from here can only
    // land exactly on `MOCK_RANGE_DATA.range.end` if the button's `endTime` really is that value
    // rather than something derived independently (the old chart-header derivation, or a guess).
    setGlobalState("selectedISOTime", MOCK_RANGE_DATA.range.end);
    render(<CursorReadout />);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Wrapping to `range.start` — not stalling past `range.end`, not continuing past it — is
    // only possible if both ends the button plays across are exactly `useCursorRange`'s.
    expect(getGlobalState("selectedISOTime")).toBe(MOCK_RANGE_DATA.range.start);
  });

  test("is not rendered until useCursorRange has data, same as the track it plays across", () => {
    mockRangeData = null;
    render(<CursorReadout />);
    // The track itself draws its own idle placeholder in this state (`scrub-track.test.tsx`
    // pins that separately); this only asserts the button's half — no range, no button, rather
    // than a button wired to a guessed or stale window.
    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
  });
});
