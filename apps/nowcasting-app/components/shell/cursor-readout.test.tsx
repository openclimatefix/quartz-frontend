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
import { describe, expect, jest, test } from "@jest/globals";
import React from "react";
import { act, render, screen } from "@testing-library/react";

const MOCK_RANGE_DATA = {
  range: { start: "2026-08-10T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" },
  daylight: []
};

jest.mock("./use-cursor-range", () => ({
  __esModule: true,
  default: () => MOCK_RANGE_DATA,
  useCursorRange: () => MOCK_RANGE_DATA
}));

import { setEnabledCountries, setFocusedCountry, setGlobalState } from "../helpers/globalState";
import CursorReadout from "./cursor-readout";

const slider = () => screen.getByRole("slider");

beforeEach(() => {
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

  test("runs in time order, west to east, not in enabled order", () => {
    // Enabled NL-first on purpose: the stack must not inherit that order. In August GB is
    // UTC+1 and NL UTC+2, so GB reads above NL whichever way they were switched on.
    setEnabledCountries(["NL", "GB"]);
    setFocusedCountry("NL");
    render(<CursorReadout />);
    const order = screen
      .getAllByTitle(/published slot/)
      .map((node) => node.firstElementChild?.textContent);
    expect(order).toEqual(["GB", "NL"]);
  });
});
