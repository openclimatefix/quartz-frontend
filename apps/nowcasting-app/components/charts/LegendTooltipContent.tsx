import { CheckInlineSmall, CrossInlineSmall } from "../icons/icons";
import React, { ReactNode } from "react";

export type DataInput = "ECMWF" | "MET_OFFICE" | "SAT";
export const DataInputNames: Record<DataInput, string> = {
  ECMWF: "ECMWF IFS",
  MET_OFFICE: "Met Office UKV",
  SAT: "Satellite Imagery"
};
const LegendTooltipContent = ({
  inputs,
  extraText
}: {
  inputs: DataInput[];
  extraText?: ReactNode;
}) => (
  <div className="flex flex-col justify-center items-start gap-0.5 text-xs text-ocf-gray-300 py-1">
    {!!extraText && (
      <>
        <div className="flex self-stretch text-left justify-between items-center gap-2 mb-2 text-xs text-ocf-gray-300">
          {extraText}
        </div>
        <hr />
      </>
    )}
    <div className="flex self-stretch justify-between items-center gap-2 text-2xs tracking-widest mb-1 uppercase font-light text-ocf-gray-300">
      <span>Data Inputs:</span>
    </div>
    {Object.entries(DataInputNames).map(([key, name]) => {
      const included = inputs.includes(key as DataInput);
      return (
        <div
          key={`Input_${key}`}
          className="flex self-stretch justify-between items-center gap-2 text-xs text-ocf-gray-300"
        >
          <span>{name}</span>
          {included ? (
            <CheckInlineSmall title={"Included in forecast"} />
          ) : (
            <CrossInlineSmall title={"Not included in forecast"} />
          )}
        </div>
      );
    })}
  </div>
);

export default LegendTooltipContent;
