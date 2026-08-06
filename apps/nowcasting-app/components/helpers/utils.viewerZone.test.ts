import { afterEach, describe, expect, it } from "@jest/globals";
import { Settings } from "luxon";
import { convertToLocaleDateString } from "./utils";

// jest pins TZ=UTC (jest.globalSetup.ts), which is the one zone in which viewer-zone bugs are
// invisible: `convertToLocaleDateString` shifts a value into the viewer's zone, and at UTC
// that shift is zero. Node caches its zone at startup, so it cannot be moved mid-process —
// but Luxon's can, which is why `parseISOInViewerZone` resolves the zone through
// `Settings.defaultZone` rather than naming "system".
//
// This is what let a real bug through: `solar-site-chart.tsx` used the result as a lookup key
// against a plain UTC epoch, missed by the viewer's offset, and fell through to
// `setSelectedISOTime(get30MinNow())` — silently discarding the user's selected time on every
// mount, for every non-UTC viewer. Correct in GMT, wrong in BST, so it failed seasonally.

const withViewerZone = <T>(zone: string, fn: () => T): T => {
  const previous = Settings.defaultZone;
  Settings.defaultZone = zone;
  try {
    return fn();
  } finally {
    Settings.defaultZone = previous;
  }
};

afterEach(() => {
  Settings.defaultZone = "system";
});

const TIME_OF_INTEREST = "2026-08-05T14:00";
const EXPECTED_EPOCH = Date.parse(`${TIME_OF_INTEREST}:00.000Z`);

// Europe/London is the BST case that motivated this; Amsterdam is the real second country;
// Los_Angeles is a large negative offset, which catches sign errors that +1h cannot.
const VIEWER_ZONES = ["Europe/London", "Europe/Amsterdam", "America/Los_Angeles"];

describe("solar-site-chart's lookup key survives any viewer zone", () => {
  // The full round trip, and the only one of the three call sites that can be reproduced
  // here: its result keeps the "Z", so `new Date()` reads it as an absolute instant and is
  // itself zone-independent. See the bottom of this file for why the other two cannot be.
  const lookupKey = () =>
    new Date(convertToLocaleDateString(`${TIME_OF_INTEREST}:00.000Z`, "UTC")).getTime();

  it.each(VIEWER_ZONES)("matches the UTC epoch it is compared against (viewer in %s)", (zone) => {
    expect(withViewerZone(zone, lookupKey)).toBe(EXPECTED_EPOCH);
  });

  it.each(VIEWER_ZONES)("and is broken without the explicit UTC (viewer in %s)", (zone) => {
    // Asserting the *bug*, so that dropping the "UTC" argument fails loudly rather than
    // quietly resetting people's selected time again.
    const withoutUtc = withViewerZone(zone, () =>
      new Date(convertToLocaleDateString(`${TIME_OF_INTEREST}:00.000Z`)).getTime()
    );

    expect(withoutUtc).not.toBe(EXPECTED_EPOCH);
  });
});

describe("the harness moves the viewer's zone at all", () => {
  // Without this, everything above passes vacuously the moment Settings.defaultZone stops
  // being honoured — a dependency bump away. This is the difference between a regression net
  // and a suite that only looks like one.
  it("changes what the helper produces", () => {
    const london = withViewerZone("Europe/London", () =>
      convertToLocaleDateString(`${TIME_OF_INTEREST}Z`)
    );
    const losAngeles = withViewerZone("America/Los_Angeles", () =>
      convertToLocaleDateString(`${TIME_OF_INTEREST}Z`)
    );

    expect(london).toBe("2026-08-05T15:00:00.000Z");
    expect(losAngeles).toBe("2026-08-05T07:00:00.000Z");
  });

  it("restores the system zone, so it cannot leak into the rest of the suite", () => {
    withViewerZone("America/Los_Angeles", () => undefined);

    expect(Settings.defaultZone.type).toBe("system");
  });
});

// NOT COVERED, deliberately, and worth knowing before "fixing" either call site:
//
// `remix-line.tsx` and `delta-view-chart.tsx` are correct in every viewer zone, but only by
// cancellation — the helper shifts into the viewer's zone and stamps a false "Z", then either
// `.slice(0, 16)` strips that "Z" (remix-line) or it was never absolute to begin with
// (delta-view), so `new Date()` re-reads the value as *local* and the two shifts cancel.
//
// That cancellation needs Node's zone and Luxon's to agree, which they do in a browser and do
// not here, because this harness moves only Luxon's. Reproducing them would need a second jest
// process under a non-UTC TZ, which is not worth the config surgery for two call sites that
// are already correct. They carry comments instead. What matters is that neither should be
// passed a zone: doing so removes the shift that the re-parse is there to cancel.
