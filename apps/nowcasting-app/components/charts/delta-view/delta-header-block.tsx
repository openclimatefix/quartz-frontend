import React from "react";
import { theme } from "../../../tailwind.config";
import { UpArrow, DownArrow } from "../../icons/icons";
import { ForecastHeadlineFigure } from "../forecast-header/ui";
import useGlobalState from "../../helpers/globalState";
import { deltaExtent, deltaRampColor } from "../../../lib/domain/delta-ramp";

// The header always shows a single total, never a capacity fraction, so it only ever needs the
// fixed-MW extent — there is no percentage-mode variant of this chip.
const HEADER_DELTA_EXTENT = deltaExtent(false);

/**
 * Legible text colour for a chip painted with the delta ramp. The ramp's poles are light
 * colours and its neutral middle is a dark grey, so which text reads depends on how far the
 * value sits from zero, not on which side of zero it landed on — a rule keyed on sign would
 * flip the text colour at zero for no visual reason, when a small positive and a small
 * negative delta sit on the same dark ground and want the same light text.
 */
const deltaTextClass = (value: number, extent: number): string => {
  const ratio = extent === 0 ? 0 : Math.min(1, Math.abs(value) / extent);
  return ratio > 0.5 ? "text-content-on-accent" : "text-content";
};

export const DeltaHeaderBlock: React.FC<{
  deltaValue: string;
  unit?: "MW" | "GW";
}> = ({ deltaValue, unit = "GW" }) => {
  let deltaNumberInMW = Number(deltaValue);
  if (unit === "GW") {
    deltaNumberInMW = Number(deltaValue) * 1000;
  }
  const [largeScreenMode] = useGlobalState("dashboardMode");
  const svgSize = largeScreenMode ? 28 : 22;
  let svg: JSX.Element | null =
    Number(deltaNumberInMW) > 0 ? <UpArrow size={svgSize} /> : <DownArrow size={svgSize} />;
  // The chip used to step through nine `ocf-delta` swatches picked by which bucket the value
  // fell in. The map, the legend and the bucket rows now all read one continuous ramp instead,
  // so the chip samples the same function at the same converted-to-MW value, rather than
  // keeping a fifth hand-written copy of the old ladder.
  const deltaColor = deltaRampColor(deltaNumberInMW, HEADER_DELTA_EXTENT);
  const textClass = deltaTextClass(deltaNumberInMW, HEADER_DELTA_EXTENT);
  if (deltaNumberInMW === 0) {
    svg = null;
  }

  return (
    <div
      // The ramp is a computed rgb(), not a Tailwind swatch, so the background comes from an
      // inline style rather than a `bg-ocf-delta-*` class.
      className={`${textClass} flex flex-col justify-around pl-3 pr-3 py-2 text-left uppercase`}
      style={{ background: deltaColor }}
    >
      <div className="flex">
        <div
          className={`${svg ? "ml-7 dash:ml-8 " : ""}${
            unit === "MW" ? " dash:3xl:text-4xl " : " dash:3xl:text-5xl "
          }dash:text-3xl dash:leading-none text-2xl gap-0.5 dash:gap-0 dash:mb-0.5 items-start flex flex-col font-semibold leading-none text-center`}
        >
          <div className="relative">
            <div className="dash:mt-2.5 absolute -left-7 dash:-left-9">{svg}</div>
            {deltaValue}
          </div>
          <div className="dash:text-sm text-xs flex items-start mx-0.5 dash:pr-2 dash:mx-1 gap-1 justify-between w-full">
            <p className="leading-none tracking-wider mt-px">Delta</p>
            <p className="leading-none font-normal mt-px">{unit}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
