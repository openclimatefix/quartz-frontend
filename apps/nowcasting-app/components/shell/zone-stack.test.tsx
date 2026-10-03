/**
 * `ZoneStack` — ported from `cursor-readout.test.tsx` when that footer was retired and this
 * component became the sole home of the per-country time readout (the date line, the UTC row,
 * one row per enabled country). What is pinned here is unchanged from that file: every country
 * row states the **period** it is showing rather than a bare timestamp — the only form in which
 * GB's period-end and NL's period-start labelling can be read off one column — every enabled
 * country appears whether focused or not, and the stack never reorders as focus moves. The pure
 * resolution arithmetic (ceiling vs floor, span ends, DST) stays pinned in `lib/time/cursor.ts`'s
 * own tests.
 *
 * Dropped from the original: the axis/slider and cadence-step assertions (the scrub track's own
 * concern, not rendered here) and the play button describe block (also not part of this
 * component).
 */
import { describe, expect, test } from "@jest/globals";
import React from "react";
import { act, render, screen } from "@testing-library/react";

import { setEnabledCountries, setFocusedCountry, setGlobalState } from "../helpers/globalState";
import ZoneStack from "./zone-stack";

beforeEach(() => {
  setEnabledCountries(["GB"]);
  setFocusedCountry("GB");
  setGlobalState("selectedISOTime", "2026-08-11T12:00:00.000Z");
  setGlobalState("timeNow", "2026-08-10T12:00:00.000Z");
});

afterEach(() => {
  setEnabledCountries(["GB"]);
  setFocusedCountry("GB");
});

test("renders nothing without a cursor", () => {
  setGlobalState("selectedISOTime", "");
  const { container } = render(<ZoneStack />);
  expect(container).toBeEmptyDOMElement();
});

describe("UTC stays on screen, demoted rather than dropped", () => {
  test("the utc row shows the canonical instant", () => {
    render(<ZoneStack />);
    expect(screen.getByText("utc")).toBeInTheDocument();
    // One instant, not a span: UTC is the cursor's canonical value, not a publisher's period.
    expect(screen.getByText("utc").parentElement).toHaveTextContent("utc12:00");
  });
});

/**
 * Every country row states the period it is showing, in that country's own zone.
 *
 * These are the cases that would look plausible if the labelling flip were wrong: GB's span
 * *ends* at its label, NL's *starts* at it — but both describe a period that *contains the
 * cursor*, which is what makes the two rows comparable at all.
 */
describe("the period each row is showing", () => {
  // A country's code appears once as this stack's row label; rows are found by their own title.
  const row = (code: string) => screen.getByTitle(new RegExp(`^${code} published period`));

  test("GB focused: both rows describe the period the cursor is in, so they overlap", () => {
    setEnabledCountries(["GB", "NL"]);
    render(<ZoneStack />);
    // Cursor 12:00 UTC. GB reads 12:00-12:30 UTC (13:00-13:30 BST), NL 12:00-12:15 UTC
    // (14:00-14:15 CEST): NL's quarter nests inside GB's half hour.
    expect(row("GB")).toHaveTextContent("GB13:00–13:30");
    expect(row("NL")).toHaveTextContent("NL14:00–14:15");
    expect(screen.getByText("utc").parentElement).toHaveTextContent("utc12:00");
  });

  test("NL focused: the periods are unchanged, because focus is not a convention", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("NL");
    render(<ZoneStack />);
    expect(row("GB")).toHaveTextContent("GB13:00–13:30");
    expect(row("NL")).toHaveTextContent("NL14:00–14:15");
  });

  test("a cursor between GB's slots still lands inside GB's stated period", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("NL");
    // 12:15 UTC is on NL's 15-minute grid, not GB's 30-minute one.
    setGlobalState("selectedISOTime", "2026-08-11T12:15:00.000Z");
    render(<ZoneStack />);
    expect(row("GB")).toHaveTextContent("GB13:00–13:30");
    expect(row("NL")).toHaveTextContent("NL14:15–14:30");
  });

  test("the cadence and lag column is gone, not merely emptied", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("NL");
    setGlobalState("selectedISOTime", "2026-08-11T12:15:00.000Z");
    render(<ZoneStack />);
    expect(row("GB")).not.toHaveTextContent("+15m");
    expect(row("GB")).not.toHaveTextContent("30m");
    expect(row("NL")).not.toHaveTextContent("15m");
  });

  test("the title says which end the country's own timestamp names", () => {
    setEnabledCountries(["GB", "NL"]);
    render(<ZoneStack />);
    expect(row("GB")).toHaveAttribute("title", expect.stringContaining("label the end"));
    expect(row("NL")).toHaveAttribute("title", expect.stringContaining("label the start"));
  });
});

/**
 * The stack holds every zone in a fixed slot, focused or not — a focus change is a weight
 * change rather than a membership change, so the list never reorders under a reader.
 */
describe("the zone stack", () => {
  test("lists every enabled country, including the focused one", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("GB");
    render(<ZoneStack />);
    const codes = screen
      .getAllByTitle(/published period/)
      .map((node) => node.firstElementChild?.textContent);
    expect(codes).toEqual(["GB", "NL"]);
  });

  test("keeps both slots, in the same order, when focus moves", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("GB");
    const view = render(<ZoneStack />);
    const order = () =>
      screen.getAllByTitle(/published period/).map((node) => node.firstElementChild?.textContent);
    expect(order()).toEqual(["GB", "NL"]);

    act(() => setFocusedCountry("NL"));
    view.rerender(<ZoneStack />);
    expect(order()).toEqual(["GB", "NL"]);
  });

  test("marks the focused country rather than moving it", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("NL");
    render(<ZoneStack />);
    const codeIn = (code: string) =>
      screen.getByTitle(new RegExp(`^${code} published period`)).firstElementChild;
    expect(codeIn("NL")).toHaveClass("text-selected");
    expect(codeIn("GB")).not.toHaveClass("text-selected");
  });

  test("runs in registry order, not in the order countries were enabled", () => {
    // Enabled NL-first on purpose: the stack must not inherit that order, or it would reorder
    // itself as the user toggles countries.
    setEnabledCountries(["NL", "GB"]);
    setFocusedCountry("NL");
    render(<ZoneStack />);
    const order = screen
      .getAllByTitle(/published period/)
      .map((node) => node.firstElementChild?.textContent);
    expect(order).toEqual(["GB", "NL"]);
  });
});
