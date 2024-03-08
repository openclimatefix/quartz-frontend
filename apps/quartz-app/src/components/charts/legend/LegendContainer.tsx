import {
  ACTUAL_SOLAR_COLOR,
  ACTUAL_WIND_COLOR,
  SOLAR_COLOR,
  WIND_COLOR,
} from "@/src/constants";
import { LegendItem } from "@/src/components/charts/legend/LegendItem";

export const LegendContainer = () => (
  <div className="flex w-full justify-start gap-6 items-center text-white px-6 pt-1 pb-3 text-sm">
    <div className="flex flex-col gap-1">
      <LegendItem color={SOLAR_COLOR} label="OCF Past Solar Forecast" />
      <LegendItem color={WIND_COLOR} label="OCF Past Wind Forecast" />
    </div>
    <div className="flex flex-col gap-1">
      <LegendItem
        color={SOLAR_COLOR}
        label="OCF Solar Forecast"
        style="dashed"
      />
      <LegendItem color={WIND_COLOR} label="OCF Wind Forecast" style="dashed" />
    </div>
    <div className="flex flex-col gap-1">
      <LegendItem
        color={ACTUAL_SOLAR_COLOR}
        label="Actual Solar Generation"
        // style="dashDot"
      />
      <LegendItem color={ACTUAL_WIND_COLOR} label="Actual Wind Generation" />
    </div>
  </div>
);
