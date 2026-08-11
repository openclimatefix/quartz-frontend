import { describe, expect, it } from "@jest/globals";
import { DateTime, Settings } from "luxon";

import {
  clampToScale,
  fractionForClientX,
  fractionForInstant,
  instantForFraction,
  instantForSlotIndex,
  scrubScale,
  slotIndexOf,
  slotsPerMinutes
} from "./scrub-scale";
import { snapDownToCadence } from "../../lib/time/cursor";

// A scrub track that is one slot out looks completely correct, so these are the cases where a
// plausible implementation diverges from the right one: the ceiling-versus-nearest choice at a
// 15/30-minute boundary, the two ends of the range, a grid that coarsens under a cursor already
// on it, and a window spanning a DST transition.
//
// `jest.globalSetup.ts` pins the process to UTC, which would hide any accidental local-zone
// arithmetic, so the DST cases set `Settings.defaultZone` explicitly.

const GB = 30;
const NL = 15;

// A plain 48-hour window, both ends on the 30-minute grid — the shape a real forecast axis has.
const RANGE = { start: "2026-08-10T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" };

const scale = (cadence: number, range = RANGE) => {
  const built = scrubScale(range, cadence);
  if (!built) throw new Error("expected a scale");
  return built;
};

describe("laying the grid over a window", () => {
  it("counts the slots the window actually contains", () => {
    expect(scale(GB).slotCount).toBe(96);
    expect(scale(NL).slotCount).toBe(192);
  });

  it("keeps the reachable ends inside the window", () => {
    // Ceiling at the bottom, FLOOR at the top. Ceiling at the top would put the last reachable
    // slot one step past the last published value — a handle you can drag onto nothing.
    const odd = scale(GB, { start: "2026-08-10T00:05:00.000Z", end: "2026-08-11T23:50:00.000Z" });
    expect(new Date(odd.firstMs).toISOString()).toBe("2026-08-10T00:30:00.000Z");
    expect(new Date(odd.lastMs).toISOString()).toBe("2026-08-11T23:30:00.000Z");
    expect(snapDownToCadence("2026-08-11T23:50:00.000Z", GB)).toBe("2026-08-11T23:30:00.000Z");
  });

  it("refuses a window it cannot scrub rather than inventing one", () => {
    expect(scrubScale(null, GB)).toBeNull();
    expect(scrubScale({ start: "", end: "" }, GB)).toBeNull();
    // Inverted.
    expect(scrubScale({ start: RANGE.end, end: RANGE.start }, GB)).toBeNull();
    // Zero-length.
    expect(scrubScale({ start: RANGE.start, end: RANGE.start }, GB)).toBeNull();
    // Non-empty but with no slot inside it: 00:05 ceilings to 00:30, 00:25 floors to 00:00.
    expect(
      scrubScale({ start: "2026-08-10T00:05:00.000Z", end: "2026-08-10T00:25:00.000Z" }, GB)
    ).toBeNull();
    expect(scrubScale(RANGE, 0)).toBeNull();
  });
});

describe("snapping, which is a ceiling and never nearest", () => {
  it("ceilings a coarse grid up to the next slot, not to the nearest one", () => {
    // 16:20 is nearer 16:30 and 16:10 is nearer 16:00 — "nearest" would answer differently for
    // the second, and it would look entirely plausible. Timestamps label period END.
    expect(clampToScale("2026-08-10T16:20:00.000Z", scale(GB))).toBe("2026-08-10T16:30:00.000Z");
    expect(clampToScale("2026-08-10T16:10:00.000Z", scale(GB))).toBe("2026-08-10T16:30:00.000Z");
    expect(clampToScale("2026-08-10T16:00:00.001Z", scale(GB))).toBe("2026-08-10T16:30:00.000Z");
  });

  it("leaves an instant that is already on the grid alone", () => {
    expect(clampToScale("2026-08-10T16:30:00.000Z", scale(GB))).toBe("2026-08-10T16:30:00.000Z");
    expect(clampToScale("2026-08-10T16:15:00.000Z", scale(NL))).toBe("2026-08-10T16:15:00.000Z");
  });

  it("moves a 15-minute cursor forward when the grid coarsens under it", () => {
    // Exactly what disabling NL does with the cursor parked on a :15 value.
    expect(clampToScale("2026-08-10T16:15:00.000Z", scale(GB))).toBe("2026-08-10T16:30:00.000Z");
    expect(clampToScale("2026-08-10T16:45:00.000Z", scale(GB))).toBe("2026-08-10T17:00:00.000Z");
  });
});

describe("clamping at both ends", () => {
  it("pulls an instant before the window onto the first slot", () => {
    expect(clampToScale("2026-08-01T00:00:00.000Z", scale(GB))).toBe(RANGE.start);
  });

  it("pulls an instant after the window back onto the last slot", () => {
    expect(clampToScale("2026-09-01T00:00:00.000Z", scale(GB))).toBe(RANGE.end);
  });

  it("does not let the ceiling push the last part-step off the end", () => {
    // The failure this exists for: ceiling 23:40 gives 00:00 on the 12th, which is past the
    // window. Snap-then-clamp lands on 23:30; clamp-then-snap would land back on 00:00.
    const odd = scale(GB, { start: RANGE.start, end: "2026-08-11T23:40:00.000Z" });
    expect(clampToScale("2026-08-11T23:35:00.000Z", odd)).toBe("2026-08-11T23:30:00.000Z");
    expect(clampToScale("2026-08-11T23:39:59.999Z", odd)).toBe("2026-08-11T23:30:00.000Z");
  });
});

describe("pixels to instants and back", () => {
  const rect = { left: 100, width: 400 };

  it("reads a pointer position as a fraction of the element", () => {
    expect(fractionForClientX(100, rect)).toBe(0);
    expect(fractionForClientX(300, rect)).toBe(0.5);
    expect(fractionForClientX(500, rect)).toBe(1);
  });

  it("clamps a pointer that has left the element, which pointer capture makes routine", () => {
    expect(fractionForClientX(-40, rect)).toBe(0);
    expect(fractionForClientX(9000, rect)).toBe(1);
  });

  it("answers 0 rather than NaN for an unmeasured element", () => {
    expect(fractionForClientX(120, { left: 0, width: 0 })).toBe(0);
  });

  it("turns a fraction into a snapped instant on the grid", () => {
    const gb = scale(GB);
    expect(instantForFraction(0, gb)).toBe(RANGE.start);
    expect(instantForFraction(1, gb)).toBe(RANGE.end);
    expect(instantForFraction(0.5, gb)).toBe("2026-08-11T00:00:00.000Z");
    // 0.5 of 48h is exactly 24h; nudging a pixel to either side must still land on the grid,
    // and above the boundary it ceilings to the NEXT slot rather than back to it.
    expect(instantForFraction(0.5 + 1 / 400, gb)).toBe("2026-08-11T00:30:00.000Z");
    expect(instantForFraction(0.5 - 1 / 400, gb)).toBe("2026-08-11T00:00:00.000Z");
  });

  it("puts a fraction on the finer grid when a finer country is enabled", () => {
    // The same pointer position, one country toggle apart. A track that kept GB's grid here
    // would silently refuse two of NL's four slots per hour.
    const fraction = 0.5 + 10 / (48 * 60);
    expect(instantForFraction(fraction, scale(GB))).toBe("2026-08-11T00:30:00.000Z");
    expect(instantForFraction(fraction, scale(NL))).toBe("2026-08-11T00:15:00.000Z");
  });

  it("round-trips every slot through its own fraction", () => {
    const nl = scale(NL);
    for (let index = 0; index <= nl.slotCount; index++) {
      const instant = instantForSlotIndex(index, nl);
      expect(instantForFraction(fractionForInstant(instant, nl), nl)).toBe(instant);
      expect(slotIndexOf(instant, nl)).toBe(index);
    }
  });

  it("places an instant outside the window at one end or the other", () => {
    const gb = scale(GB);
    expect(fractionForInstant("2020-01-01T00:00:00.000Z", gb)).toBe(0);
    expect(fractionForInstant("2030-01-01T00:00:00.000Z", gb)).toBe(1);
  });
});

describe("slot indices, which is what assistive technology is told", () => {
  it("clamps an index to the track", () => {
    const gb = scale(GB);
    expect(instantForSlotIndex(-5, gb)).toBe(RANGE.start);
    expect(instantForSlotIndex(9999, gb)).toBe(RANGE.end);
    expect(slotIndexOf("2019-01-01T00:00:00.000Z", gb)).toBe(0);
    expect(slotIndexOf("2039-01-01T00:00:00.000Z", gb)).toBe(gb.slotCount);
  });

  it("keeps a coarse page jump on the grid, and always moves at least one slot", () => {
    expect(slotsPerMinutes(180, scale(GB))).toBe(6);
    expect(slotsPerMinutes(180, scale(NL))).toBe(12);
    // A stride finer than the grain still has to move, or the key does nothing.
    expect(slotsPerMinutes(5, scale(GB))).toBe(1);
  });
});

describe("across a DST transition", () => {
  // The window is a UTC instant pair and the grid is anchored to the UTC hour, so neither
  // country's transition may change the number of slots. A local-time scale gives 47 or 49
  // slots for these days and puts every mark after the change in the wrong place — in one
  // country and not the other, since BST and CEST switch at different local hours.
  const AUTUMN = { start: "2026-10-25T00:00:00.000Z", end: "2026-10-26T00:00:00.000Z" };
  const SPRING = { start: "2026-03-29T00:00:00.000Z", end: "2026-03-30T00:00:00.000Z" };

  it("counts a transition day as exactly 24 hours of slots", () => {
    expect(scale(GB, AUTUMN).slotCount).toBe(48);
    expect(scale(NL, AUTUMN).slotCount).toBe(96);
    expect(scale(GB, SPRING).slotCount).toBe(48);
    expect(scale(NL, SPRING).slotCount).toBe(96);
  });

  it("keeps the scale the same whatever zone the viewer is in", () => {
    const original = Settings.defaultZone;
    try {
      const positions: string[] = [];
      for (const zone of ["UTC", "Europe/London", "Europe/Amsterdam", "America/Los_Angeles"]) {
        Settings.defaultZone = zone;
        const built = scale(GB, AUTUMN);
        positions.push(instantForFraction(0.5, built));
        expect(built.slotCount).toBe(48);
      }
      expect(new Set(positions).size).toBe(1);
    } finally {
      Settings.defaultZone = original;
    }
  });

  it("steps evenly across the clock change rather than repeating or skipping an hour", () => {
    const gb = scale(GB, AUTUMN);
    // Britain puts the clocks back at 01:00 UTC, so 00:00–02:00 UTC is the hour London lives
    // through twice. On the UTC grid it is four consecutive 30-minute slots and nothing else.
    const around = [0, 1, 2, 3].map((index) => instantForSlotIndex(index, gb));
    expect(around).toEqual([
      "2026-10-25T00:00:00.000Z",
      "2026-10-25T00:30:00.000Z",
      "2026-10-25T01:00:00.000Z",
      "2026-10-25T01:30:00.000Z"
    ]);
    // The same four instants read as two 01:00s and two 01:30s in London — the ambiguity the
    // per-country readout displays rather than something the scale tries to resolve. The two
    // columns repeat at the same UTC instant but at different local hours, which is the whole
    // reason the scale is anchored in UTC: one grid can serve both, a local one cannot.
    const london = around.map((iso) =>
      DateTime.fromISO(iso, { zone: "utc" }).setZone("Europe/London").toFormat("HH:mm")
    );
    const amsterdam = around.map((iso) =>
      DateTime.fromISO(iso, { zone: "utc" }).setZone("Europe/Amsterdam").toFormat("HH:mm")
    );
    expect(london).toEqual(["01:00", "01:30", "01:00", "01:30"]);
    expect(amsterdam).toEqual(["02:00", "02:30", "02:00", "02:30"]);
  });
});
