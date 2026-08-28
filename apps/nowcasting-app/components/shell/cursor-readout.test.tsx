/**
 * The footer's readout — Phase 6 followup, Track N.
 *
 * The pure resolution arithmetic (ceiling vs floor, span ends, DST) is pinned in
 * `lib/time/cursor.ts`'s own tests; what this file pins is what reaches the screen: the axis
 * reads in the *focused* country's local time rather than a fixed UTC constant, that zone and
 * the cursor's cadence move together on a focus change (so the track's grain and its labels
 * never disagree about which country they are describing), and — since the NL labelling flip —
 * every country row states the **period** it is showing rather than a bare timestamp, which is
 * the only form in which GB's period-end and NL's period-start can be read off one column.
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
    // One instant, not a span: UTC is the cursor's canonical value, not a publisher's period.
    expect(screen.getByText("utc").parentElement).toHaveTextContent("utc12:00");
    expect(screen.queryByText(/Cursor/)).not.toBeInTheDocument();
  });
});

/**
 * Every country row states the period it is showing, in that country's own zone.
 *
 * This is the app's one place where the two labelling conventions appear side by side, and the
 * cases below are the ones that would look plausible if the flip were wrong: GB's span *ends*
 * at its label, NL's *starts* at it, and a cursor sitting between GB's slots does not move GB's
 * period off the cursor.
 */
describe("the period each row is showing", () => {
  // A country's code appears twice on screen — once as this stack's row label and once in the
  // track's tethered tag — so rows are found by their own title rather than by their code.
  const row = (code: string) => screen.getByTitle(new RegExp(`^${code} published period`));

  test("GB focused: GB's span ends at its label, NL's starts at its own", () => {
    setEnabledCountries(["GB", "NL"]);
    render(<CursorReadout />);
    // Cursor 12:00 UTC. GB's slot is 12:00 UTC (13:00 BST) covering 12:30–13:00 local; NL's is
    // 12:00 UTC (14:00 CEST) covering 14:00–14:15 local. Same UTC label, spans that touch at a
    // point and share nothing else — which is the fact the row exists to state.
    expect(row("GB")).toHaveTextContent("GB12:30–13:00");
    expect(row("NL")).toHaveTextContent("NL14:00–14:15");
    expect(screen.getByText("utc").parentElement).toHaveTextContent("utc12:00");
  });

  test("NL focused: the periods are unchanged, because focus is not a convention", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("NL");
    render(<CursorReadout />);
    expect(row("GB")).toHaveTextContent("GB12:30–13:00");
    expect(row("NL")).toHaveTextContent("NL14:00–14:15");
  });

  test("a cursor between GB's slots still lands inside GB's stated period", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("NL");
    // 12:15 UTC is on NL's 15-minute grid, not GB's 30-minute one. The old readout said "+15m"
    // here; the period says the same thing better — 13:00–13:30 BST contains 13:15, so the row
    // is visibly about the cursor's own instant rather than one a quarter hour away.
    setGlobalState("selectedISOTime", "2026-08-11T12:15:00.000Z");
    render(<CursorReadout />);
    expect(row("GB")).toHaveTextContent("GB13:00–13:30");
    expect(row("NL")).toHaveTextContent("NL14:15–14:30");
  });

  test("the cadence and lag column is gone, not merely emptied", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("NL");
    setGlobalState("selectedISOTime", "2026-08-11T12:15:00.000Z");
    render(<CursorReadout />);
    // The two spellings that column ever used. Both facts are now carried by the span itself:
    // its length is the cadence, and it contains the cursor by construction.
    expect(row("GB")).not.toHaveTextContent("+15m");
    expect(row("GB")).not.toHaveTextContent("30m");
    expect(row("NL")).not.toHaveTextContent("15m");
  });

  test("the title says which end the country's own timestamp names", () => {
    setEnabledCountries(["GB", "NL"]);
    render(<CursorReadout />);
    // The span cannot show which end carries the label — that is the one part of the convention
    // that has to be said in words, so it is said on hover rather than not at all.
    expect(row("GB")).toHaveAttribute("title", expect.stringContaining("label the end"));
    expect(row("NL")).toHaveAttribute("title", expect.stringContaining("label the start"));
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
      .getAllByTitle(/published period/)
      .map((node) => node.firstElementChild?.textContent);
    expect(codes).toEqual(["GB", "NL"]);
  });

  test("keeps both slots, in the same order, when focus moves", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("GB");
    const view = render(<CursorReadout />);
    const order = () =>
      screen.getAllByTitle(/published period/).map((node) => node.firstElementChild?.textContent);
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
      screen.getByTitle(new RegExp(`^${code} published period`)).firstElementChild;
    expect(codeIn("NL")).toHaveClass("text-selected");
    expect(codeIn("GB")).not.toHaveClass("text-selected");
  });

  test("runs in registry order, not in the order countries were enabled", () => {
    // Enabled NL-first on purpose: the stack must not inherit that order, or it would reorder
    // itself as the user toggles countries. The registry reads GB then NL — which is also west
    // to east, though it is the file's order and not the offsets that decides.
    setEnabledCountries(["NL", "GB"]);
    setFocusedCountry("NL");
    render(<CursorReadout />);
    const order = screen
      .getAllByTitle(/published period/)
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
