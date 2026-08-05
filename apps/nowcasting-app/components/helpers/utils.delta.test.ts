import { describe, expect, test } from "@jest/globals";
import { createBucketObject, getDeltaBucket } from "./utils";
import { DELTA_BUCKET, getDeltaBucketKeys } from "../../constant";
import { GspDeltaValue } from "../types";

//////////////////////////////////////////////////////////////////////////////
// Characterisation tests for the delta bucketing used by the map delta view.
//
// These pin CURRENT behaviour ahead of the v1/multi-country migration. The
// bucket enum is a set of MW thresholds (-100 … +100) with an implicit
// "everything beyond" bucket at each end.
//////////////////////////////////////////////////////////////////////////////

const group = (n: number) => new Array(n).fill({}) as GspDeltaValue[];

describe("getDeltaBucketKeys", () => {
  test("returns the nine named enum keys, ordered most-negative to most-positive", () => {
    // The numeric enum also produces reverse-mapped numeric keys ("-100", "0", …);
    // the filter drops those. Order matters — getDeltaBucket walks this array.
    expect(getDeltaBucketKeys()).toEqual([
      "NEG4",
      "NEG3",
      "NEG2",
      "NEG1",
      "ZERO",
      "POS1",
      "POS2",
      "POS3",
      "POS4"
    ]);
  });

  test("the enum values are the thresholds the buckets are named for", () => {
    expect([
      DELTA_BUCKET.NEG4,
      DELTA_BUCKET.NEG3,
      DELTA_BUCKET.NEG2,
      DELTA_BUCKET.NEG1,
      DELTA_BUCKET.ZERO,
      DELTA_BUCKET.POS1,
      DELTA_BUCKET.POS2,
      DELTA_BUCKET.POS3,
      DELTA_BUCKET.POS4
    ]).toEqual([-100, -75, -50, -25, 0, 25, 50, 75, 100]);
  });
});

describe("getDeltaBucket — zero and non-numeric input", () => {
  test("exactly zero is ZERO", () => {
    expect(getDeltaBucket(0)).toBe(DELTA_BUCKET.ZERO);
  });

  test("negative zero is ZERO (neither < 0 nor > 0)", () => {
    expect(getDeltaBucket(-0)).toBe(DELTA_BUCKET.ZERO);
  });

  test("null falls through to ZERO", () => {
    // CHARACTERISATION: current behaviour is wrong — a missing delta is
    // indistinguishable from a delta of exactly zero, so a GSP with no data
    // renders as "on forecast" rather than as unknown.
    expect(getDeltaBucket(null as unknown as number)).toBe(DELTA_BUCKET.ZERO);
  });

  test("undefined falls through to ZERO", () => {
    // CHARACTERISATION: current behaviour is wrong — see null case above.
    expect(getDeltaBucket(undefined as unknown as number)).toBe(DELTA_BUCKET.ZERO);
  });

  test("NaN falls through to ZERO", () => {
    // CHARACTERISATION: current behaviour is wrong — NaN reaches here from
    // Number(undefined)/1000 in the geo pipeline and is silently bucketed as
    // "no difference".
    expect(getDeltaBucket(NaN)).toBe(DELTA_BUCKET.ZERO);
  });
});

describe("getDeltaBucket — negative thresholds", () => {
  // Negative buckets are upper-bound inclusive: a bucket holds
  // (nextMoreNegativeThreshold, ownThreshold].
  test.each([
    // [delta, expected bucket, why]
    [-100, DELTA_BUCKET.NEG4, "exactly on the NEG4 threshold"],
    [-100.0001, DELTA_BUCKET.NEG4, "just beyond NEG4"],
    [-99.9999, DELTA_BUCKET.NEG3, "just inside NEG4, so NEG3"],
    [-99, DELTA_BUCKET.NEG3, "inside NEG4"],
    [-76, DELTA_BUCKET.NEG3, "just below the NEG3 threshold"],
    [-75, DELTA_BUCKET.NEG3, "exactly on the NEG3 threshold"],
    [-74.9999, DELTA_BUCKET.NEG2, "just above the NEG3 threshold"],
    [-51, DELTA_BUCKET.NEG2, "just below the NEG2 threshold"],
    [-50, DELTA_BUCKET.NEG2, "exactly on the NEG2 threshold"],
    [-49.9999, DELTA_BUCKET.NEG1, "just above the NEG2 threshold"],
    [-26, DELTA_BUCKET.NEG1, "just below the NEG1 threshold"],
    [-25, DELTA_BUCKET.NEG1, "exactly on the NEG1 threshold"],
    [-24.9999, DELTA_BUCKET.ZERO, "just above the NEG1 threshold"],
    [-1, DELTA_BUCKET.ZERO, "small negative"],
    [-0.0001, DELTA_BUCKET.ZERO, "vanishingly small negative"]
  ])("delta %p -> %p (%s)", (delta, expected) => {
    expect(getDeltaBucket(delta)).toBe(expected);
  });

  test("everything beyond NEG4 is clamped into NEG4", () => {
    expect(getDeltaBucket(-3000)).toBe(DELTA_BUCKET.NEG4);
    expect(getDeltaBucket(-1_000_000)).toBe(DELTA_BUCKET.NEG4);
    expect(getDeltaBucket(-Infinity)).toBe(DELTA_BUCKET.NEG4);
  });
});

describe("getDeltaBucket — positive thresholds", () => {
  // Positive buckets are lower-bound inclusive: a bucket holds
  // [ownThreshold, nextMorePositiveThreshold). This mirrors the negative side.
  test.each([
    [0.0001, DELTA_BUCKET.ZERO, "vanishingly small positive"],
    [1, DELTA_BUCKET.ZERO, "small positive"],
    [24.9999, DELTA_BUCKET.ZERO, "just below the POS1 threshold"],
    [25, DELTA_BUCKET.POS1, "exactly on the POS1 threshold"],
    [25.0001, DELTA_BUCKET.POS1, "just above the POS1 threshold"],
    [49.9999, DELTA_BUCKET.POS1, "just below the POS2 threshold"],
    [50, DELTA_BUCKET.POS2, "exactly on the POS2 threshold"],
    [74.9999, DELTA_BUCKET.POS2, "just below the POS3 threshold"],
    [75, DELTA_BUCKET.POS3, "exactly on the POS3 threshold"],
    [99.9999, DELTA_BUCKET.POS3, "just below the POS4 threshold"],
    [100, DELTA_BUCKET.POS4, "exactly on the POS4 threshold"],
    [100.0001, DELTA_BUCKET.POS4, "just above the POS4 threshold"]
  ])("delta %p -> %p (%s)", (delta, expected) => {
    expect(getDeltaBucket(delta)).toBe(expected);
  });

  test("everything beyond POS4 is clamped into POS4", () => {
    expect(getDeltaBucket(3000)).toBe(DELTA_BUCKET.POS4);
    expect(getDeltaBucket(1_000_000)).toBe(DELTA_BUCKET.POS4);
    expect(getDeltaBucket(Infinity)).toBe(DELTA_BUCKET.POS4);
  });
});

describe("getDeltaBucket — symmetry", () => {
  test("the positive and negative sides mirror each other in width", () => {
    // ±25 both land in the first non-zero bucket; ±24 both land in ZERO.
    expect(getDeltaBucket(25)).toBe(DELTA_BUCKET.POS1);
    expect(getDeltaBucket(-25)).toBe(DELTA_BUCKET.NEG1);
    expect(getDeltaBucket(24)).toBe(DELTA_BUCKET.ZERO);
    expect(getDeltaBucket(-24)).toBe(DELTA_BUCKET.ZERO);
  });
});

describe("createBucketObject — bounds", () => {
  test.each([
    [DELTA_BUCKET.NEG4, -3000, -100],
    [DELTA_BUCKET.NEG3, -100, -75],
    [DELTA_BUCKET.NEG2, -75, -50],
    [DELTA_BUCKET.NEG1, -50, -25],
    [DELTA_BUCKET.ZERO, -25, 25],
    [DELTA_BUCKET.POS1, 25, 50],
    [DELTA_BUCKET.POS2, 50, 75],
    [DELTA_BUCKET.POS3, 75, 100],
    [DELTA_BUCKET.POS4, 100, 3000]
  ])("bucket %p spans [%p, %p]", (bucket, lower, upper) => {
    const result = createBucketObject(bucket, []);
    expect(result.lowerBound).toBe(lower);
    expect(result.upperBound).toBe(upper);
  });

  test("the outermost bounds are hardcoded at ±3000 MW, not derived from capacity", () => {
    // CHARACTERISATION: current behaviour is wrong for a multi-country app —
    // ±3000 is a GB-shaped magic number and will be meaningless for NL/DE.
    expect(createBucketObject(DELTA_BUCKET.NEG4, []).lowerBound).toBe(-3000);
    expect(createBucketObject(DELTA_BUCKET.POS4, []).upperBound).toBe(3000);
  });

  test("bounds are contiguous — each bucket's upper bound is the next one's lower bound", () => {
    const ordered = [
      DELTA_BUCKET.NEG4,
      DELTA_BUCKET.NEG3,
      DELTA_BUCKET.NEG2,
      DELTA_BUCKET.NEG1,
      DELTA_BUCKET.ZERO,
      DELTA_BUCKET.POS1,
      DELTA_BUCKET.POS2,
      DELTA_BUCKET.POS3,
      DELTA_BUCKET.POS4
    ].map((b) => createBucketObject(b, []));

    for (let i = 0; i < ordered.length - 1; i++) {
      expect(ordered[i].upperBound).toBe(ordered[i + 1].lowerBound);
    }
  });
});

describe("createBucketObject — labels, colours and quantity", () => {
  test("quantity is the length of the supplied group, and increment is always 1", () => {
    expect(createBucketObject(DELTA_BUCKET.ZERO, []).quantity).toBe(0);
    expect(createBucketObject(DELTA_BUCKET.ZERO, group(7)).quantity).toBe(7);
    expect(createBucketObject(DELTA_BUCKET.POS4, group(3)).increment).toBe(1);
  });

  test("text is the stringified numeric threshold, not the bucket name", () => {
    // CHARACTERISATION: current behaviour is wrong — `text` reads "-100"/"0",
    // which is the threshold rather than a label; `dataKey` carries the name.
    expect(createBucketObject(DELTA_BUCKET.NEG4, []).text).toBe("-100");
    expect(createBucketObject(DELTA_BUCKET.ZERO, []).text).toBe("0");
    expect(createBucketObject(DELTA_BUCKET.POS4, []).text).toBe("100");
  });

  test("dataKey is the enum name via the reverse mapping", () => {
    expect(createBucketObject(DELTA_BUCKET.NEG4, []).dataKey).toBe("NEG4");
    expect(createBucketObject(DELTA_BUCKET.NEG1, []).dataKey).toBe("NEG1");
    expect(createBucketObject(DELTA_BUCKET.ZERO, []).dataKey).toBe("ZERO");
    expect(createBucketObject(DELTA_BUCKET.POS3, []).dataKey).toBe("POS3");
  });

  test.each([
    [DELTA_BUCKET.NEG4, "bg-ocf-delta-100", "border-ocf-delta-100", "text-black"],
    [DELTA_BUCKET.NEG3, "bg-ocf-delta-200", "border-ocf-delta-200", "text-black"],
    [DELTA_BUCKET.NEG2, "bg-ocf-delta-300", "border-ocf-delta-300", "text-black"],
    [DELTA_BUCKET.NEG1, "bg-ocf-delta-400", "border-ocf-delta-400", "text-white"],
    [DELTA_BUCKET.ZERO, "bg-ocf-delta-500", "border-white", "text-white"],
    [DELTA_BUCKET.POS1, "bg-ocf-delta-600", "border-ocf-delta-600", "text-white"],
    [DELTA_BUCKET.POS2, "bg-ocf-delta-700", "border-ocf-delta-700", "text-black"],
    [DELTA_BUCKET.POS3, "bg-ocf-delta-800", "border-ocf-delta-800", "text-black"],
    [DELTA_BUCKET.POS4, "bg-ocf-delta-900", "border-ocf-delta-900", "text-black"]
  ])("bucket %p uses %s / %s / %s", (bucket, bg, border, textColor) => {
    const result = createBucketObject(bucket, []);
    expect(result.bucketColor).toBe(bg);
    expect(result.borderColor).toBe(border);
    expect(result.textColor).toBe(textColor);
  });

  test("ZERO is the only bucket whose border colour is not its background colour", () => {
    expect(createBucketObject(DELTA_BUCKET.ZERO, []).borderColor).toBe("border-white");
  });

  test("an unknown bucket value silently falls through to the ZERO styling with 0/0 bounds", () => {
    // CHARACTERISATION: current behaviour is wrong — the switch has no default,
    // so an out-of-range bucket renders as a zero-width mid-grey band with an
    // undefined dataKey rather than throwing.
    const result = createBucketObject(999 as unknown as DELTA_BUCKET, group(2));
    expect(result.bucketColor).toBe("bg-ocf-delta-500");
    expect(result.borderColor).toBe("border-ocf-delta-500");
    expect(result.lowerBound).toBe(0);
    expect(result.upperBound).toBe(0);
    expect(result.dataKey).toBe(undefined);
    expect(result.text).toBe("999");
    expect(result.quantity).toBe(2);
  });
});

describe("getDeltaBucket -> createBucketObject round trip", () => {
  test("every delta lands inside the bounds of the bucket it is assigned to", () => {
    const deltas = [
      -3000, -150, -100, -99, -75, -60, -50, -30, -25, -10, 0, 10, 25, 40, 50, 60, 75, 90, 100, 150,
      3000
    ];
    for (const delta of deltas) {
      const bucket = getDeltaBucket(delta);
      const { lowerBound, upperBound } = createBucketObject(bucket, []);
      expect(delta).toBeGreaterThanOrEqual(lowerBound);
      expect(delta).toBeLessThanOrEqual(upperBound);
    }
  });
});
