// @ts-ignore
import { theme } from "@/tailwind.config";

export const WIND_COLOR = theme.extend.colors["quartz-blue"].DEFAULT || "#48B0DF";
export const SOLAR_COLOR = theme.extend.colors["quartz-yellow"].DEFAULT || "#FFD166";
export const COMBINED_COLOR = theme.extend.colors["quartz-mint-green"].DEFAULT || "#06D6A0";
export const ACTUAL_COLOR = "#FFFFFF";
export const ACTUAL_SOLAR_COLOR = "#ffddb1";
export const ACTUAL_WIND_COLOR = "#c7dcf2";

export const TOOLTIP_DISPLAY_NAMES = {
  combined_generation: "Actual",
  combined_forecast_past: "OCF Forecast",
  combined_forecast_future: "OCF Forecast",
  solar_forecast_past: "OCF Forecast",
  solar_forecast_future: "OCF Forecast",
  wind_forecast_past: "OCF Forecast",
  wind_forecast_future: "OCF Forecast",
  solar_generation: "Actual",
  wind_generation: "Actual"
};
