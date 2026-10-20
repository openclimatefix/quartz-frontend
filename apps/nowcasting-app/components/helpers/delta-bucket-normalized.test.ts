import { describe, expect, test } from "@jest/globals";

import { getDeltaBucket, getDeltaBucketNormalized } from "./utils";
import { DELTA_BUCKET, DELTA_PERCENTAGE_EDGES, deltaBucketEdge } from "../../constant";

describe("getDeltaBucketNormalized", () => {
  test("steps on fractions of capacity, not megawatts", () => {
    // The whole point: a 30 MW miss is trivial on a 4,437 MW province and enormous on a 40 MW
    // GSP. The MW bucketer cannot tell those apart; this one puts them at opposite ends.
    expect(getDeltaBucketNormalized(30 / 4437)).toBe(DELTA_BUCKET.ZERO);
    expect(getDeltaBucketNormalized(30 / 40)).toBe(DELTA_BUCKET.POS4);
  });

  test("is symmetric about zero", () => {
    for (const edge of DELTA_PERCENTAGE_EDGES) {
      const positive = getDeltaBucketNormalized(edge);
      const negative = getDeltaBucketNormalized(-edge);
      expect(DELTA_BUCKET[positive]).toBe(DELTA_BUCKET[negative].replace("NEG", "POS"));
    }
  });

  test("a magnitude at an edge belongs to the outer bucket, as the MW bucketer does", () => {
    // Boundary parity with `getDeltaBucket` is the property that keeps the two units telling
    // the same story about the same region; drift here would show as a region changing bucket
    // when only the display unit changed.
    //
    // Read off `DELTA_PERCENTAGE_EDGES` rather than written out: the edges are tuned against
    // real distributions and have already moved once (±2/5/10/20 → ±5/10/20/35), and a test
    // that hardcodes them fails on tuning rather than on breakage.
    const [first] = DELTA_PERCENTAGE_EDGES;
    const justUnder = first - 0.0001;

    expect(getDeltaBucketNormalized(first)).toBe(DELTA_BUCKET.POS1);
    expect(getDeltaBucketNormalized(justUnder)).toBe(DELTA_BUCKET.ZERO);
    expect(getDeltaBucket(25)).toBe(DELTA_BUCKET.POS1);
    expect(getDeltaBucket(24.99)).toBe(DELTA_BUCKET.ZERO);

    expect(getDeltaBucketNormalized(-first)).toBe(DELTA_BUCKET.NEG1);
    expect(getDeltaBucketNormalized(-justUnder)).toBe(DELTA_BUCKET.ZERO);
    expect(getDeltaBucket(-25)).toBe(DELTA_BUCKET.NEG1);
    expect(getDeltaBucket(-24.99)).toBe(DELTA_BUCKET.ZERO);
  });

  test("clamps beyond the outermost edge rather than running off the ladder", () => {
    expect(getDeltaBucketNormalized(5)).toBe(DELTA_BUCKET.POS4);
    expect(getDeltaBucketNormalized(-5)).toBe(DELTA_BUCKET.NEG4);
  });

  test("no capacity means no percentage error, which is the neutral bucket", () => {
    // Callers pass 0 when capacity is 0. Distinct from "no delta", which `hasDelta` carries.
    expect(getDeltaBucketNormalized(0)).toBe(DELTA_BUCKET.ZERO);
  });
});

describe("deltaBucketEdge", () => {
  test("returns megawatts unchanged and percentages from the edge list", () => {
    const inner = DELTA_PERCENTAGE_EDGES[0] * 100;
    const outer = DELTA_PERCENTAGE_EDGES[DELTA_PERCENTAGE_EDGES.length - 1] * 100;

    expect(deltaBucketEdge(DELTA_BUCKET.POS4, false)).toBe(100);
    expect(deltaBucketEdge(DELTA_BUCKET.NEG4, false)).toBe(-100);
    expect(deltaBucketEdge(DELTA_BUCKET.POS4, true)).toBe(outer);
    expect(deltaBucketEdge(DELTA_BUCKET.NEG4, true)).toBe(-outer);
    expect(deltaBucketEdge(DELTA_BUCKET.POS1, true)).toBe(inner);
    expect(deltaBucketEdge(DELTA_BUCKET.NEG1, true)).toBe(-inner);
    expect(deltaBucketEdge(DELTA_BUCKET.ZERO, true)).toBe(0);
  });

  test("labels the bucket a value actually falls into", () => {
    // The legend, the popup and the panel tiles all label cells this way, so a mismatch here is
    // a scale that describes a map it is not drawing.
    for (const edge of DELTA_PERCENTAGE_EDGES) {
      expect(deltaBucketEdge(getDeltaBucketNormalized(edge), true)).toBe(edge * 100);
    }
  });
});
