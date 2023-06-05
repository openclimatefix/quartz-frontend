import React from "react";
import { theme } from "../../../tailwind.config";
import { UpArrow, DownArrow } from "../../icons/icons";
import { ForecastHeadlineFigure } from "../forecast-header/ui";
import useGlobalState from "../../helpers/globalState";
import { DELTA_BUCKET } from "../../../constant";

export const DeltaHeaderBlock: React.FC<{
  deltaValue: string;
  unit?: "MW" | "GW";
}> = ({ deltaValue, unit = "GW" }) => {
  let deltaColor = `ocf-gray-900`;
  let deltaNumberInMW = Number(deltaValue);
  if (unit === "GW") {
    deltaNumberInMW = Number(deltaValue) * 1000;
  }
  const [largeScreenMode] = useGlobalState("largeScreenMode");
  const svgSize = largeScreenMode ? 28 : 22;
  let svg: JSX.Element | null =
    Number(deltaNumberInMW) > 0 ? <UpArrow size={svgSize} /> : <DownArrow size={svgSize} />;
  if (Number(deltaNumberInMW) < DELTA_BUCKET.NEG4) {
    deltaColor = `ocf-delta-100`;
  } else if (DELTA_BUCKET.NEG4 <= deltaNumberInMW && deltaNumberInMW < DELTA_BUCKET.NEG3) {
    deltaColor = `ocf-delta-200`;
  } else if (DELTA_BUCKET.NEG3 <= deltaNumberInMW && deltaNumberInMW < DELTA_BUCKET.NEG2) {
    deltaColor = `ocf-delta-300`;
  } else if (DELTA_BUCKET.NEG2 <= deltaNumberInMW && deltaNumberInMW < DELTA_BUCKET.NEG1) {
    deltaColor = `ocf-delta-400`;
  } else if (DELTA_BUCKET.NEG1 <= deltaNumberInMW && deltaNumberInMW < DELTA_BUCKET.POS1) {
    deltaColor = `ocf-gray-900`;
  } else if (DELTA_BUCKET.POS1 <= deltaNumberInMW && deltaNumberInMW < DELTA_BUCKET.POS2) {
    deltaColor = `ocf-delta-600`;
  } else if (DELTA_BUCKET.POS2 <= deltaNumberInMW && deltaNumberInMW < DELTA_BUCKET.POS3) {
    deltaColor = `ocf-delta-700`;
  } else if (DELTA_BUCKET.POS3 <= deltaNumberInMW && deltaNumberInMW < DELTA_BUCKET.POS4) {
    deltaColor = `ocf-delta-800`;
  } else if (DELTA_BUCKET.POS4 <= deltaNumberInMW) {
    deltaColor = `ocf-delta-900`;
  }
  if (deltaNumberInMW === 0) {
    svg = null;
  }

  return (
    <div
      className={`bg-${deltaColor} flex flex-col justify-around pl-3 pr-3 py-2 text-left text-ocf-black uppercase`}
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
            <p className="leading-none text-ocf-black font-normal mt-px">{unit}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
