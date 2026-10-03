import type { PowerMw, RegionSnapshot, RegionSnapshotValue } from "../../lib/domain/types";

/**
 * Three states a region can be in within a snapshot, kept distinct end to end.
 *
 * This is not a theoretical distinction. The newest slot of `/generation/snapshot` publishes
 * region by region and can be read mid-fill — a recorded fixture caught 15:00 with 127 of 336
 * regions, complete 11 minutes later. The cache writes per region as values arrive and never
 * blanks or zero-fills, so the regions still to publish are **absent from the payload**.
 *
 *  - `unpublished` — the region is not in the payload. It has not reported for this slot yet.
 *    Not an error, not a coverage gap, and not "no data": ask again shortly.
 *  - `no-data`     — the region is present with `powerMw: null`. It reported nothing.
 *  - `value`       — the region is present with a number, **including 0**. Overnight solar is
 *    a genuine zero and must not be rendered as missing (this is audit B8's bug class).
 *
 * The map must render `unpublished` differently from `no-data`, and neither as a zero.
 */
export type RegionSnapshotState = "unpublished" | "no-data" | "value";

export const regionSnapshotState = (
  snapshot: RegionSnapshot | undefined,
  regionName: string
): RegionSnapshotState => {
  const value = snapshot?.regions[regionName];
  if (value === undefined) return "unpublished";
  return value.powerMw === null ? "no-data" : "value";
};

/**
 * The region's power in MW, or `null` for both "not published yet" and "no reading".
 *
 * Provided so a caller that genuinely does not care which of the two it has does not have to
 * flatten them itself with a `??` that would also swallow a real 0. A caller that *does* care
 * uses `regionSnapshotState`.
 */
export const regionSnapshotPowerMw = (
  snapshot: RegionSnapshot | undefined,
  regionName: string
): PowerMw => snapshot?.regions[regionName]?.powerMw ?? null;

/** The regions a snapshot actually carries, in payload order. */
export const publishedRegions = (snapshot: RegionSnapshot | undefined): RegionSnapshotValue[] =>
  snapshot === undefined ? [] : Object.values(snapshot.regions);

/**
 * How complete a snapshot is, against the region list the country is expected to have.
 *
 * `expectedRegionNames` comes from `useRegions(scope)`. A partial newest slot is a permanent
 * characteristic of the endpoint, not a fault to report — this is here so a view can say
 * "127 of 336 published" rather than silently drawing 209 holes.
 */
export const snapshotCoverage = (
  snapshot: RegionSnapshot | undefined,
  expectedRegionNames: string[]
): { published: number; expected: number; isPartial: boolean } => {
  const expected = expectedRegionNames.length;
  const published = expectedRegionNames.filter(
    (name) => snapshot?.regions[name] !== undefined
  ).length;
  return { published, expected, isPartial: expected > 0 && published < expected };
};
