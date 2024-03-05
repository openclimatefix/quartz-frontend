import { ACTUAL_COLOR, SOLAR_COLOR, WIND_COLOR } from "@/src/constants";
import { LegendItem } from "@/src/components/charts/legend/LegendItem";

export const LegendContainer = () => (
  <div className="flex w-full justify-center gap-6 items-center text-white px-6 pt-1 pb-3 text-sm">
    <div className="flex flex-col gap-1">
      <LegendItem color={WIND_COLOR} label="OCF Past Wind Forecast" />
      <LegendItem color={SOLAR_COLOR} label="OCF Past Solar Forecast" />
    </div>
    <div className="flex flex-col gap-1">
      <LegendItem color={WIND_COLOR} label="OCF Wind Forecast" style="dashed" />
      <LegendItem
        color={SOLAR_COLOR}
        label="OCF Solar Forecast"
        style="dashed"
      />
    </div>
    <div className="flex flex-col gap-1">
      <LegendItem color={ACTUAL_COLOR} label="Actual Wind Generation" />
      <LegendItem
        color={ACTUAL_COLOR}
        label="Actual Solar Generation"
        style="dashDot"
      />
    </div>
  </div>
);
