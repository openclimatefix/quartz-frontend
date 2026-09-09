import { FC } from "react";

import { useFocusedCountry } from "../../hooks/data";
import { getCountryConfig } from "../../config/countries";
import { DEFAULT_TIMEZONE } from "../helpers/utils";
import { PLOT_INSET_LEFT_PX, PLOT_INSET_RIGHT_PX } from "../charts/remix-line";
import PlayButton from "../play-button";
import ScrubTrack from "./scrub-track";
import type { CursorRange } from "./scrub-scale";
import useCursorRange from "./use-cursor-range";

/**
 * SPIKE — the scrub track inside the chart card, lined up with the chart's own x-axis.
 *
 * Mounted between the plot well and the legend (`pv-remix-chart.tsx`, `delta-view-chart.tsx`),
 * behind `?scrub=chart`. See `use-scrub-placement.ts` for the flag and
 * `docs/scrub-placement-spike.md` for what this is testing.
 *
 * **The chart hands over its own domain**, which is what makes lining the two up meaningful
 * rather than decorative. The first version let the track derive its window independently, from
 * `useCursorRange` — the same query the chart runs, so the two ends looked like they had to
 * agree. They do not: the chart plots a *merge* of that forecast with generation and drops
 * every point whose value is null (`use-format-chart-data.tsx`'s `fromTimeSeries`), so the
 * track reached further back than the axis above it. Two derivations of one window will always
 * find a way to differ; `domain` is the chart's first and last plotted key, so there is now one
 * derivation and the ends are the same fact rather than the same intention.
 *
 * The scale between those ends is still linear in time on the track and *by index* on the chart
 * — recharts plots the national chart on a category axis. Those agree exactly while the plotted
 * points are evenly spaced, which they are at a single cadence, and would drift in the middle
 * if a gap ever opened in the merged series. Worth knowing before this is trusted to the pixel.
 *
 * **Agreeing on the box is the whole job.** Recharts will not say where its plot area begins,
 * so the track reconstructs it: `PLOT_INSET_LEFT_PX` is the Y axis's width plus the chart's
 * left margin, both now named constants in `remix-line.tsx` rather than a literal and a library
 * default. The play button sits in the gutter that inset creates — which is the one piece of
 * luck in this layout, since the space reserved for the Y axis labels is exactly the space a
 * transport control wants and was otherwise empty.
 *
 * **Two ways the alignment is approximate, both worth knowing before this ships anywhere:**
 *
 * 1. **Delta view's right edge is wrong by ~45px.** It mounts a second `YAxis` on the right and
 *    shrinks its own right margin to fit it, so its plot ends further in than
 *    `PLOT_INSET_RIGHT_PX` describes. Correcting for it here would mean this component knowing
 *    which chart it is under, which is the shape of thing the shell has spent Phase 6 removing.
 *    Left uncorrected so the cost is visible rather than papered over.
 * 2. **Zoom breaks it outright.** `RemixLine` supports a zoom that narrows the plotted domain
 *    (`globalIsZoomed`) while the track keeps drawing the full window, so a zoomed chart is
 *    lined up with a track that no longer shares its scale — the ticks agree by position and
 *    disagree by value, which is worse than not lining up at all. The honest fix is for the
 *    track to draw the zoom window as a band on itself; that is a design question, not a
 *    measurement, and it is not in this spike.
 */
const ChartScrubber: FC<{ domain?: CursorRange | null }> = ({ domain }) => {
  const focusedCountry = useFocusedCountry();
  const focusedZone = getCountryConfig(focusedCountry)?.timezone ?? DEFAULT_TIMEZONE;
  const rangeData = useCursorRange();

  return (
    <div
      className="flex items-start px-2 pb-1 pt-1.5 text-xs text-content"
      style={{ paddingRight: PLOT_INSET_RIGHT_PX + 8 }}
    >
      {/* The Y-axis gutter, used. Fixed at the inset's width so the track's left edge is the
          plot's left edge; the button is centred in it rather than pushed against either side,
          because it is a control sitting in reserved space and not a label belonging to the
          axis. `self-start` lines it up with the strip, not with the strip plus its tick
          labels — the same reasoning the shell footer used. */}
      <div
        className="flex shrink-0 items-center justify-center self-start"
        style={{ width: PLOT_INSET_LEFT_PX }}
      >
        {rangeData && (
          <PlayButton startTime={rangeData.range.start} endTime={rangeData.range.end} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <ScrubTrack zone={focusedZone} range={domain} />
      </div>
    </div>
  );
};

export default ChartScrubber;
