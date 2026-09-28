import React from "react";
import { UpArrow, DownArrow } from "../../icons/icons";
import { DELTA_COOL, DELTA_WARM } from "../../../lib/domain/delta-ramp";

/**
 * The header's delta, dressed as one of the headline figures beside it: a monospace figure at
 * their size, with its labels stacked in a white column to its right the way their clock and
 * unit are. It used to be a chip filled with the ramp colour, which made it the loudest thing
 * in the row.
 *
 * The figure and caret take the ramp's pole for their sign, the same blue and orange as the
 * chart's delta bars. The ramp sampled at the value would be the honest scale colour, but it
 * fades to its dark neutral middle near zero, and a small delta would vanish into the card.
 * Zero has no side, so it is plain `content`.
 */
export const DeltaHeaderBlock: React.FC<{
  deltaValue: string;
  unit?: "MW" | "GW";
  /** The regional header's slightly smaller figure size — see `ForecastHeadlineFigure`. */
  gsp?: boolean;
}> = ({ deltaValue, unit = "GW", gsp = false }) => {
  const delta = Number(deltaValue);
  const color = delta > 0 ? DELTA_WARM : delta < 0 ? DELTA_COOL : undefined;
  const Caret = delta > 0 ? UpArrow : delta < 0 ? DownArrow : null;

  // Kept in step with `ForecastHeadlineFigure`'s own ramp, so the three figures in the row are
  // one size.
  const figureSize = gsp
    ? "text-base md:text-lg lg:text-xl xl:text-2xl dash:xl:text-3xl dash:2xl:text-4xl"
    : "text-base md:text-lg lg:text-2xl dash:xl:text-3xl dash:3xl:text-4xl";

  return (
    <div data-test="delta-header-figure" className="flex items-center gap-2 dash:py-0.5">
      <div
        className={`flex items-center gap-1 font-mono tracking-normal leading-none ${figureSize} ${
          color ? "" : "text-content"
        }`}
        // Inline: the poles are ramp constants, not Tailwind swatches. `fill` inherits into
        // the caret's path, which carries no fill of its own.
        style={color ? { color, fill: color } : undefined}
      >
        {Caret && (
          <span className="flex h-[0.8em] w-[0.8em] items-center">
            <Caret size="100%" />
          </span>
        )}
        {deltaValue}
      </div>
      <div className="flex flex-col gap-0.5 text-2xs dash:text-sm dash:xl:text-base leading-none dash:leading-none text-content">
        <span>Delta</span>
        <span className="font-normal">{unit}</span>
      </div>
    </div>
  );
};
