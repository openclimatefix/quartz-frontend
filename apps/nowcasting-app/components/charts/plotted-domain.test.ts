import { describe, expect, it } from "@jest/globals";

import { isChronological, plottedDomain, plottedKeyRange } from "./plotted-domain";

const domainOf = (keys: string[]) =>
  plottedDomain(keys.map((formattedDate) => ({ formattedDate })));

describe("plottedDomain", () => {
  it("puts the sliced-off tail back on both ends", () => {
    expect(domainOf(["2026-09-05T00:00", "2026-09-05T00:30", "2026-09-07T12:00"])).toEqual({
      start: "2026-09-05T00:00:00.000Z",
      end: "2026-09-07T12:00:00.000Z"
    });
  });

  it("takes the earliest and latest key, not the first and last", () => {
    // The shape `useFormatChartData` actually produces: generation is inserted first, so the
    // array opens partway in, and the forecast's earlier points are appended at the end. Reading
    // position 0 as the start left the track eight hours short of the chart in GB.
    expect(
      domainOf([
        "2026-09-05T20:00", // generation's first point — where the array begins
        "2026-09-06T00:00",
        "2026-09-05T12:00", // forecast history, appended after everything generation added
        "2026-09-07T12:00"
      ])
    ).toEqual({
      start: "2026-09-05T12:00:00.000Z",
      end: "2026-09-07T12:00:00.000Z"
    });
  });

  it("is null when every key is the same instant", () => {
    expect(domainOf(["2026-09-05T00:00", "2026-09-05T00:00"])).toBeNull();
  });

  it("is null for a window with no width, so the track falls back to the hook", () => {
    expect(domainOf([])).toBeNull();
    expect(domainOf(["2026-09-05T00:00"])).toBeNull();
  });

  it("is null when the data has not arrived", () => {
    expect(plottedDomain(undefined)).toBeNull();
  });
});

describe("isChronological", () => {
  it("is true for points in order", () => {
    expect(
      isChronological([
        { formattedDate: "2026-09-05T00:00" },
        { formattedDate: "2026-09-05T00:30" }
      ])
    ).toBe(true);
  });

  it("is false for the generation-then-forecast insertion order", () => {
    expect(
      isChronological([
        { formattedDate: "2026-09-05T20:00" },
        { formattedDate: "2026-09-05T12:00" }
      ])
    ).toBe(false);
  });
});

describe("plottedKeyRange", () => {
  const keysOf = (keys: string[]) =>
    plottedKeyRange(keys.map((formattedDate) => ({ formattedDate })));

  it("bounds the range that `pv-remix-chart` tests the cursor against", () => {
    // The bug this replaces: position 0 is generation's first point, so every instant between
    // the chart's true start and that one tested as out of range and reset the cursor to now.
    expect(keysOf(["2026-09-05T20:00", "2026-09-06T00:00", "2026-09-05T12:00"])).toEqual({
      earliest: "2026-09-05T12:00",
      latest: "2026-09-06T00:00"
    });
  });

  it("keeps a single-point chart, which is still a valid bound to test against", () => {
    // Unlike `plottedDomain`, which needs width to draw a track: one point is a range of one
    // instant, and the cursor either is it or is out of range.
    expect(keysOf(["2026-09-05T12:00"])).toEqual({
      earliest: "2026-09-05T12:00",
      latest: "2026-09-05T12:00"
    });
  });

  it("is null when there is nothing plotted", () => {
    expect(keysOf([])).toBeNull();
    expect(plottedKeyRange(undefined)).toBeNull();
  });
});
