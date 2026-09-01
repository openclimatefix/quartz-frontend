import { afterEach, describe, expect, it } from "@jest/globals";
import { DateTime, Settings } from "luxon";

import { COUNTRY_CONFIG } from "../../config/countries";
import {
  cadenceMinutesFor,
  cursorNow,
  FALLBACK_CADENCE_MINUTES,
  cursorCadenceMinutes,
  isOnCadence,
  nextSlot,
  periodForInstant,
  playbackStrideMinutes,
  slotForInstant,
  slotLabellingFor,
  snapDownToCadence,
  snapToCadence
} from "./cursor";

// The whole point of this module is arithmetic that looks right and is quietly wrong, so the
// cases below are the ones where a plausible implementation diverges: the exact-on-the-grid
// boundary, a coarse country reading a fine country's instant, and the two DST transitions.
//
// The process zone is pinned to UTC by `jest.globalSetup.ts`, which would hide any local-zone
// arithmetic — so the zone-sensitive cases set `Settings.defaultZone` explicitly.

describe("cadence from the registry", () => {
  it("reads each country's own step", () => {
    expect(cadenceMinutesFor("GB")).toBe(30);
    expect(cadenceMinutesFor("NL")).toBe(15);
  });

  it("falls back for a country the build has no entry for", () => {
    expect(cadenceMinutesFor("DE")).toBe(FALLBACK_CADENCE_MINUTES);
    expect(cadenceMinutesFor(undefined)).toBe(FALLBACK_CADENCE_MINUTES);
    expect(slotLabellingFor("DE")).toBe("period-end");
  });

  it("keeps every configured cadence a divisor of an hour", () => {
    // The grid is anchored to the UTC hour (epoch arithmetic). A cadence that does not divide
    // 60 would drift across the day instead of repeating, and every lookup after the first
    // hour would miss — see the module doc.
    for (const [code, config] of Object.entries(COUNTRY_CONFIG)) {
      expect(`${code}:${60 % config.cadenceMinutes}`).toBe(`${code}:0`);
    }
  });
});

describe("cursorCadenceMinutes", () => {
  it("takes the focused country's grid, not the finest one on the map", () => {
    // The rule this replaced took the finest cadence across the *enabled* set, so GB+NL
    // stepped every 15 minutes while GB publishes every 30 — the cursor moved twice for every
    // time GB's map changed, and read as a skip. Focus decides the grid now; whichever country
    // is being read moves on every step, and the other still resolves its own slot by ceiling.
    expect(cursorCadenceMinutes("GB")).toBe(30);
    expect(cursorCadenceMinutes("NL")).toBe(15);
  });

  it("falls back rather than throwing on an unconfigured or absent country", () => {
    // `focusedCountry` is invariant-checked upstream; a blank grid has no useful meaning.
    expect(cursorCadenceMinutes("XX")).toBe(FALLBACK_CADENCE_MINUTES);
    expect(cursorCadenceMinutes(null)).toBe(FALLBACK_CADENCE_MINUTES);
    expect(cursorCadenceMinutes(undefined)).toBe(FALLBACK_CADENCE_MINUTES);
  });
});

describe("playbackStrideMinutes — the one place focus does not decide the grid", () => {
  it("takes the finest cadence across the drawn set, not the focused country's", () => {
    // The opposite rule to `cursorCadenceMinutes`, and deliberately so: nobody is aiming at a
    // step during playback, so the reason focus wins there does not apply, while playing NL's
    // 15-minute data at 30 minutes because GB happens to be focused loses real resolution.
    expect(playbackStrideMinutes(["GB", "NL"])).toBe(15);
    expect(playbackStrideMinutes(["NL", "GB"])).toBe(15);
    expect(playbackStrideMinutes(["GB"])).toBe(30);
  });

  it("falls back on an empty set or an unconfigured country", () => {
    expect(playbackStrideMinutes([])).toBe(FALLBACK_CADENCE_MINUTES);
    expect(playbackStrideMinutes(["XX"])).toBe(FALLBACK_CADENCE_MINUTES);
  });
});

describe("snapToCadence — cursor inputs", () => {
  it("leaves an instant already on the grid alone", () => {
    expect(snapToCadence("2026-08-10T16:30:00.000Z", 30)).toBe("2026-08-10T16:30:00.000Z");
    expect(snapToCadence("2026-08-10T16:15:00.000Z", 15)).toBe("2026-08-10T16:15:00.000Z");
  });

  it("rounds up when the grid coarsens under a value", () => {
    // NL switched off with the cursor at 16:15: GB never publishes that instant.
    expect(snapToCadence("2026-08-10T16:15:00.000Z", 30)).toBe("2026-08-10T16:30:00.000Z");
  });

  it("clears seconds and milliseconds", () => {
    expect(snapToCadence("2026-08-10T16:00:01.500Z", 30)).toBe("2026-08-10T16:30:00.000Z");
  });

  it("reads an offset spelling as the instant it names, not as wall clock", () => {
    expect(snapToCadence("2026-08-10T18:15:00+02:00", 30)).toBe("2026-08-10T16:30:00.000Z");
  });

  it("rejects a cadence that cannot describe a grid", () => {
    expect(() => snapToCadence("2026-08-10T16:00:00.000Z", 0)).toThrow(/positive/);
  });

  it("rejects an unparseable instant rather than inventing one", () => {
    expect(() => snapToCadence("not a time", 30)).toThrow(/Invalid instant/);
  });
});

describe("snapDownToCadence — the far end of a bounded span", () => {
  // Added with the scrub track (Track H). It is deliberately NOT a second rounding rule for
  // cursor values: the ceiling stays the rule everywhere an input is resolved. This exists so
  // a range's END can be the last slot INSIDE it. Ceiling there would give the track a final
  // position one step past the last published value, which draws perfectly and has no data.
  it("leaves an instant already on the grid alone", () => {
    expect(snapDownToCadence("2026-08-10T16:30:00.000Z", 30)).toBe("2026-08-10T16:30:00.000Z");
  });

  it("rounds back to the previous slot, which is the opposite of snapToCadence", () => {
    expect(snapDownToCadence("2026-08-10T16:15:00.000Z", 30)).toBe("2026-08-10T16:00:00.000Z");
    expect(snapToCadence("2026-08-10T16:15:00.000Z", 30)).toBe("2026-08-10T16:30:00.000Z");
    expect(snapDownToCadence("2026-08-10T16:29:59.999Z", 30)).toBe("2026-08-10T16:00:00.000Z");
  });

  it("floors instants before the epoch-hour boundary rather than towards zero", () => {
    // JS `%` is signed, so a naive implementation rounds the wrong way before 1970. The app
    // never sees such an instant, but the sign handling is the part that looks fine and is not.
    expect(snapDownToCadence("1969-12-31T23:45:00.000Z", 30)).toBe("1969-12-31T23:30:00.000Z");
  });

  it("rejects a cadence that cannot describe a grid", () => {
    expect(() => snapDownToCadence("2026-08-10T16:00:00.000Z", -30)).toThrow(/positive/);
  });
});

describe("nextSlot / cursorNow — 'now' is the slot currently filling", () => {
  afterEach(() => {
    Settings.now = () => Date.now();
  });

  const at = (iso: string) => {
    // Resolved to millis *before* the override: `fromISO` itself reads `Settings.now`, so a
    // closure that parses on every call recurses.
    const millis = DateTime.fromISO(iso, { zone: "utc" }).toMillis();
    Settings.now = () => millis;
  };

  it("steps strictly forward from an instant already on the grid", () => {
    // The 16:00 slot covers 15:30-16:00 and has just closed; the one being watched is 16:30.
    expect(nextSlot("2026-08-10T16:00:00.000Z", 30)).toBe("2026-08-10T16:30:00.000Z");
  });

  it("is the next label at any other instant", () => {
    expect(nextSlot("2026-08-10T16:00:00.001Z", 30)).toBe("2026-08-10T16:30:00.000Z");
    expect(nextSlot("2026-08-10T16:29:59.999Z", 30)).toBe("2026-08-10T16:30:00.000Z");
  });

  it("names the period currently filling by its start, on any grid", () => {
    at("2026-08-10T16:07:00.000Z");
    // The same two periods the ceiling-strict version named — 16:00-16:30 and 16:00-16:15 —
    // spelled at the start, because a cursor value is a period start now. `nextSlot` above is
    // unchanged and still answers "the next *label*", which is a different question.
    expect(cursorNow(30)).toBe("2026-08-10T16:00:00.000Z");
    expect(cursorNow(15)).toBe("2026-08-10T16:00:00.000Z");
  });

  it("shifts by the offset before rounding", () => {
    at("2026-08-10T16:07:00.000Z");
    expect(cursorNow(30, -60)).toBe("2026-08-10T15:00:00.000Z");
    // The offset used to be applied by overflowing a `set({ minute })`; crossing an hour is
    // the case that spelling had to get right by luck.
    expect(cursorNow(30, 60)).toBe("2026-08-10T17:00:00.000Z");
  });

  it("is unaffected by the viewer's zone, including a half-hour offset", () => {
    at("2026-08-10T16:07:00.000Z");
    Settings.defaultZone = "Asia/Kolkata"; // UTC+05:30
    try {
      expect(cursorNow(30)).toBe("2026-08-10T16:00:00.000Z");
      expect(cursorNow(15)).toBe("2026-08-10T16:00:00.000Z");
    } finally {
      Settings.defaultZone = "system";
    }
  });
});

describe("slotForInstant — the cursor resolved to one country's grid", () => {
  it("resolves the contract's worked example", () => {
    // A cursor at 16:15 UTC: NL publishes it, GB's containing slot is 16:30 — the period
    // 16:00-16:30, named by its end. Both countries are reading a period that *contains* the
    // cursor, which is the whole point of choosing the period before naming it.
    expect(slotForInstant("2026-08-10T16:15:00.000Z", "NL")).toBe("2026-08-10T16:15:00.000Z");
    expect(slotForInstant("2026-08-10T16:15:00.000Z", "GB")).toBe("2026-08-10T16:30:00.000Z");
  });

  it("is not a nearest — the case that looks plausible either way", () => {
    // "Nearest" would give 16:00 here, which is a period the cursor has already left.
    expect(slotForInstant("2026-08-10T16:01:00.000Z", "GB")).toBe("2026-08-10T16:30:00.000Z");
  });

  it("takes the period *starting* at a boundary instant, not the one ending there", () => {
    // The cross-country fix, pinned. A cursor value always sits on a boundary, so this case is
    // every case in practice. GB used to answer 16:30 here — the period 16:00-16:30, which had
    // just closed — while NL at the same instant answered 16:30 meaning 16:30-16:45. The two
    // readings were adjacent and never overlapped. GB now reads 16:30-17:00, named 17:00, and
    // NL's quarter hour nests inside it.
    expect(slotForInstant("2026-08-10T16:30:00.000Z", "GB")).toBe("2026-08-10T17:00:00.000Z");
    expect(slotForInstant("2026-08-10T16:30:00.000Z", "NL")).toBe("2026-08-10T16:30:00.000Z");
  });

  it("floors for NL, which the provider confirmed labels period-start", () => {
    // 16:07 sits inside the period *starting* 16:00. Under GB's convention the same instant
    // would resolve to 16:15 — one whole slot later, and indistinguishable on screen, which is
    // why this is pinned rather than left to the registry to be read carefully.
    expect(slotForInstant("2026-08-10T16:07:00.000Z", "NL")).toBe("2026-08-10T16:00:00.000Z");
  });

  it("ceilings the same instant if the registry says that country labels period-end", () => {
    // The field is the whole mechanism: nothing else decides the direction.
    const original = COUNTRY_CONFIG.NL.slotLabelling;
    COUNTRY_CONFIG.NL.slotLabelling = "period-end";
    try {
      expect(slotForInstant("2026-08-10T16:07:00.000Z", "NL")).toBe("2026-08-10T16:15:00.000Z");
    } finally {
      COUNTRY_CONFIG.NL.slotLabelling = original;
    }
  });

  it("falls back to a 30-minute period-end grid for an unconfigured country", () => {
    expect(slotForInstant("2026-08-10T16:15:00.000Z", "DE")).toBe("2026-08-10T16:30:00.000Z");
  });
});

describe("periodForInstant — the span a slot covers, not the label it goes by", () => {
  it("puts the label at the end for GB and at the start for NL", () => {
    // Both slots below are labelled 16:00 and they share only that instant: GB's runs up to it,
    // NL's runs on from it. That is the fact the footer exists to state, and the reason a bare
    // label cannot state it.
    expect(periodForInstant("2026-08-10T15:45:00.000Z", "GB")).toEqual({
      start: "2026-08-10T15:30:00.000Z",
      end: "2026-08-10T16:00:00.000Z"
    });
    expect(periodForInstant("2026-08-10T16:05:00.000Z", "NL")).toEqual({
      start: "2026-08-10T16:00:00.000Z",
      end: "2026-08-10T16:15:00.000Z"
    });
  });

  it("contains the instant it was asked about, on the grid and off it", () => {
    // The property the footer leans on: every row's period contains the cursor, so the span's
    // length states the cadence and no separate lag column is needed to say so.
    const contains = (instant: string, country: string) => {
      const { start, end } = periodForInstant(instant, country);
      const ms = new Date(instant).getTime();
      return new Date(start).getTime() <= ms && ms <= new Date(end).getTime();
    };
    for (const instant of [
      "2026-08-10T16:00:00.000Z",
      "2026-08-10T16:07:30.000Z",
      "2026-08-10T16:15:00.000Z",
      "2026-08-10T16:29:59.999Z"
    ]) {
      expect(`${instant} GB:${contains(instant, "GB")}`).toBe(`${instant} GB:true`);
      expect(`${instant} NL:${contains(instant, "NL")}`).toBe(`${instant} NL:true`);
    }
  });

  it("spans exactly one cadence, whichever end carries the label", () => {
    const lengthMinutes = (instant: string, country: string) => {
      const { start, end } = periodForInstant(instant, country);
      return (new Date(end).getTime() - new Date(start).getTime()) / 60_000;
    };
    expect(lengthMinutes("2026-08-10T16:05:00.000Z", "GB")).toBe(30);
    expect(lengthMinutes("2026-08-10T16:05:00.000Z", "NL")).toBe(15);
    expect(lengthMinutes("2026-08-10T16:05:00.000Z", "DE")).toBe(FALLBACK_CADENCE_MINUTES);
  });

  it("follows the registry field rather than a baked-in direction", () => {
    const original = COUNTRY_CONFIG.NL.slotLabelling;
    COUNTRY_CONFIG.NL.slotLabelling = "period-end";
    try {
      expect(periodForInstant("2026-08-10T16:05:00.000Z", "NL")).toEqual({
        start: "2026-08-10T16:00:00.000Z",
        end: "2026-08-10T16:15:00.000Z"
      });
    } finally {
      COUNTRY_CONFIG.NL.slotLabelling = original;
    }
  });

  it("keeps the span a whole cadence across spring-forward in both zones", () => {
    // 2026-03-29T01:00Z: London 01:00->02:00 BST and Amsterdam 02:00->03:00 CEST, at the same
    // instant. A local-time span would come out an hour long here; the grid is in UTC, so it
    // does not — and the *rendered* wall clock jumps the hour, which is the honest reading.
    const gb = periodForInstant("2026-03-29T00:50:00.000Z", "GB");
    expect(gb).toEqual({ start: "2026-03-29T00:30:00.000Z", end: "2026-03-29T01:00:00.000Z" });
    const asLocal = (iso: string, zone: string) =>
      DateTime.fromISO(iso, { zone: "utc" }).setZone(zone).toFormat("HH:mm");
    // 00:30 UTC is 00:30 GMT; 01:00 UTC is 02:00 BST — half an hour that reads as ninety minutes.
    expect(`${asLocal(gb.start, "Europe/London")}-${asLocal(gb.end, "Europe/London")}`).toBe(
      "00:30-02:00"
    );

    const nl = periodForInstant("2026-03-29T00:50:00.000Z", "NL");
    expect(nl).toEqual({ start: "2026-03-29T00:45:00.000Z", end: "2026-03-29T01:00:00.000Z" });
    expect(`${asLocal(nl.start, "Europe/Amsterdam")}-${asLocal(nl.end, "Europe/Amsterdam")}`).toBe(
      "01:45-03:00"
    );
  });

  it("does not repeat or skip a period across the autumn ambiguous hour", () => {
    // 2026-10-25T01:00Z: both zones fall back. Each UTC period exists exactly once either side.
    expect(periodForInstant("2026-10-25T00:50:00.000Z", "GB")).toEqual({
      start: "2026-10-25T00:30:00.000Z",
      end: "2026-10-25T01:00:00.000Z"
    });
    expect(periodForInstant("2026-10-25T01:20:00.000Z", "GB")).toEqual({
      start: "2026-10-25T01:00:00.000Z",
      end: "2026-10-25T01:30:00.000Z"
    });
    expect(periodForInstant("2026-10-25T01:20:00.000Z", "NL")).toEqual({
      start: "2026-10-25T01:15:00.000Z",
      end: "2026-10-25T01:30:00.000Z"
    });
  });

  it("is unaffected by the viewer's zone", () => {
    Settings.defaultZone = "Asia/Kolkata"; // UTC+05:30 — a half-hour offset, so a local-time
    try {
      // grid would land the boundaries on :00/:30 of a different clock entirely.
      expect(periodForInstant("2026-08-10T15:45:00.000Z", "GB")).toEqual({
        start: "2026-08-10T15:30:00.000Z",
        end: "2026-08-10T16:00:00.000Z"
      });
    } finally {
      Settings.defaultZone = "system";
    }
  });
});

describe("DST", () => {
  // The grid is anchored in UTC, so a transition in one country's zone must not move it — and
  // must not move it for the *other* country either, which is the case a local-time grid gets
  // wrong when GB and NL spring forward at different local hours on the same instant.
  it("does not shift the grid across the spring-forward instant", () => {
    // 2026-03-29T01:00Z: GB 01:00->02:00 BST, NL 02:00->03:00 CEST.
    expect(slotForInstant("2026-03-29T00:59:00.000Z", "GB")).toBe("2026-03-29T01:00:00.000Z");
    expect(slotForInstant("2026-03-29T01:01:00.000Z", "GB")).toBe("2026-03-29T01:30:00.000Z");
    // NL floors, so 01:01 is inside the period *starting* 01:00 UTC.
    expect(slotForInstant("2026-03-29T01:01:00.000Z", "NL")).toBe("2026-03-29T01:00:00.000Z");
  });

  it("does not repeat or skip a slot across the autumn ambiguous hour", () => {
    // 2026-10-25T01:00Z: GB falls back. Both 00:30 and 01:30 UTC exist exactly once.
    expect(slotForInstant("2026-10-25T00:20:00.000Z", "GB")).toBe("2026-10-25T00:30:00.000Z");
    expect(slotForInstant("2026-10-25T01:20:00.000Z", "GB")).toBe("2026-10-25T01:30:00.000Z");
  });

  it("keeps a whole day at exactly the expected number of slots either side", () => {
    const slotsIn = (day: string, cadence: number) => {
      const start = DateTime.fromISO(`${day}T00:00:00.000Z`, { zone: "utc" });
      const seen = new Set<string>();
      for (let minute = 1; minute <= 24 * 60; minute += 1) {
        seen.add(snapToCadence(start.plus({ minutes: minute }), cadence));
      }
      return seen.size;
    };
    // A local-time grid would produce 47 or 49 on the transition days.
    expect(slotsIn("2026-03-29", 30)).toBe(48);
    expect(slotsIn("2026-10-25", 30)).toBe(48);
    expect(slotsIn("2026-03-29", 15)).toBe(96);
  });
});

describe("isOnCadence", () => {
  it("distinguishes a real published instant from one between slots", () => {
    expect(isOnCadence("2026-08-10T16:15:00.000Z", 15)).toBe(true);
    expect(isOnCadence("2026-08-10T16:15:00.000Z", 30)).toBe(false);
    expect(isOnCadence("2026-08-10T16:30:00.000Z", 30)).toBe(true);
  });
});
