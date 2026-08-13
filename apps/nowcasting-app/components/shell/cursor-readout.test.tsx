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
import { render, screen } from "@testing-library/react";

jest.mock("./use-cursor-range", () => ({
  __esModule: true,
  default: () => ({ start: "2026-08-10T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" }),
  useCursorRange: () => ({ start: "2026-08-10T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" })
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
    expect(screen.getByText("UTC")).toBeInTheDocument();
    // "12:00" also appears as a tick label; scope to the readout row's own UTC span.
    expect(screen.getByText("UTC").parentElement).toHaveTextContent("Cursor12:00UTC");
  });
});

describe("the focused country is not shown twice", () => {
  test("with only the focused country enabled, no secondary slot duplicates the primary reading", () => {
    render(<CursorReadout />);
    // The primary chip and the (absent) secondary chip would otherwise both read "GB" — pin
    // that there is exactly one.
    expect(screen.getAllByText("GB")).toHaveLength(1);
  });

  test("a second enabled country still gets its own slot, focus does not", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("GB");
    render(<CursorReadout />);
    expect(screen.getAllByText("GB")).toHaveLength(1);
    expect(screen.getAllByText("NL")).toHaveLength(1);
  });
});
