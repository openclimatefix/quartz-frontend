import { useMemo } from "react";

import type { CursorRange } from "../shell/scrub-scale";

/** `formattedDate` is an ISO instant with the seconds and zone sliced off — 16 characters. */
const asInstant = (formattedDate: string) => `${formattedDate}:00.000Z`;

/**
 * The window a chart actually plots: the earliest and latest key in its formatted chart data.
 *
 * **Earliest and latest, not first and last.** The first version of this read
 * `chartData[0]` and `chartData[length - 1]`, which was wrong by about eight hours in GB and
 * always short at the *start*. `useFormatChartData` builds a `Record` and returns
 * `Object.values(chartMap)` — insertion order, never sorted — and it inserts the **generation**
 * series before the forecast. Generation covers less history than the forecast does, so the
 * array opens at generation's first point; the forecast's earlier points are new keys, so they
 * are appended after everything generation contributed rather than sorted in front of it.
 * `chartData[0]` is therefore the start of the *observed* data, and the chart's true left edge
 * sits earlier than that.
 *
 * Because the keys are ISO-8601 with a fixed shape and a fixed zone, they sort correctly as
 * plain strings — no parsing, one pass, no `Date` objects per point.
 *
 * `plottedKeyRange` is the same pass without the instant conversion, for callers that compare
 * against `formattedDate` keys directly — `pv-remix-chart.tsx`'s out-of-range guard does, and
 * had exactly this bug: it read positions 0 and n-1, so scrubbing into the first eight hours of
 * the chart looked out of range and reset the cursor to now, mid-drag.
 *
 * **This has a consequence for the chart, not just for the track.** If the array is not in
 * chronological order, the national chart's category axis — which plots strictly in array order
 * — is drawing those early forecast points at the far right, out of sequence. See
 * `docs/scrub-placement-spike.md`; deliberately not fixed here, since sorting `chartData` would
 * change what the chart draws and that is a change to triage rather than to slip into a spike.
 *
 * **Why this rather than a second query.** The track used to derive its own window from
 * `useCursorRange`, which reads the raw national forecast. The chart plots a merge of that
 * forecast with generation, minus every point whose value is null, so the two were near-equal
 * and not equal. One derivation, read off what is on screen, cannot drift from what is on
 * screen. See `components/shell/chart-scrubber.tsx`.
 *
 * Returns `null` for an empty chart or a zero-width window: `scrubScale` rejects one anyway
 * (`endMs > startMs`), so the track falls back to the hook's range.
 */
export const plottedKeyRange = (
  chartData: readonly { formattedDate?: string }[] | undefined
): { earliest: string; latest: string } | null => {
  if (!chartData?.length) return null;

  let earliest: string | undefined;
  let latest: string | undefined;
  for (const { formattedDate } of chartData) {
    if (!formattedDate) continue;
    if (earliest === undefined || formattedDate < earliest) earliest = formattedDate;
    if (latest === undefined || formattedDate > latest) latest = formattedDate;
  }

  if (earliest === undefined || latest === undefined) return null;
  return { earliest, latest };
};

export const plottedDomain = (
  chartData: readonly { formattedDate?: string }[] | undefined
): CursorRange | null => {
  const keys = plottedKeyRange(chartData);
  if (!keys || keys.earliest === keys.latest) return null;
  return { start: asInstant(keys.earliest), end: asInstant(keys.latest) };
};

/**
 * Whether the chart's points are in chronological order — which they must be for a recharts
 * *category* axis to draw time left to right, and which `useFormatChartData` does not guarantee.
 *
 * Exported for the tests and for anyone chasing the ordering note above; nothing renders
 * differently on it. One pass, string comparison, same as `plottedDomain`.
 */
export const isChronological = (
  chartData: readonly { formattedDate?: string }[] | undefined
): boolean => {
  let previous: string | undefined;
  for (const { formattedDate } of chartData ?? []) {
    if (!formattedDate) continue;
    if (previous !== undefined && formattedDate < previous) return false;
    previous = formattedDate;
  }
  return true;
};

/** `plottedDomain`, memoised on the array identity `useFormatChartData` already stabilises. */
export const usePlottedDomain = (
  chartData: readonly { formattedDate?: string }[] | undefined
): CursorRange | null => useMemo(() => plottedDomain(chartData), [chartData]);
