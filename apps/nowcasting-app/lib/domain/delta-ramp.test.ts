import { describe, expect, test } from "@jest/globals";

import { DELTA_BUCKET, deltaBucketEdge } from "../../constant";
import { getDeltaBucket } from "../../components/helpers/utils";
import { deltaTopFor } from "./delta-ramp";

describe("deltaTopFor", () => {
  // Each tier's top output threshold × 100/450, so GB's GSPs keep the ±100 MW they were tuned
  // on and everything else scales with how big its regions are.
  test.each([
    ["GB", false, 100],
    ["GB", true, 1000],
    ["NL", false, 800],
    ["DE", false, 3000]
  ])("%s grouped=%s saturates at %d MW", (country, grouped, expected) => {
    expect(deltaTopFor(country, grouped)).toBe(expected);
  });

  test("an unknown country falls back to the global ±100", () => {
    expect(deltaTopFor("XX", false)).toBe(DELTA_BUCKET.POS4);
    expect(deltaTopFor(undefined, true)).toBe(DELTA_BUCKET.POS4);
  });

  test("bucket edges stretch with the top; the bucket identities do not move", () => {
    const top = deltaTopFor("DE", false);
    expect(
      [DELTA_BUCKET.POS1, DELTA_BUCKET.POS2, DELTA_BUCKET.POS3, DELTA_BUCKET.POS4].map((bucket) =>
        deltaBucketEdge(bucket, false, top)
      )
    ).toEqual([750, 1500, 2250, 3000]);
    expect(getDeltaBucket(749, top)).toBe(DELTA_BUCKET.ZERO);
    expect(getDeltaBucket(750, top)).toBe(DELTA_BUCKET.POS1);
    expect(getDeltaBucket(-2250, top)).toBe(DELTA_BUCKET.NEG3);
    expect(getDeltaBucket(3000, top)).toBe(DELTA_BUCKET.POS4);
  });
});
