// @ts-ignore
import { theme } from "@/tailwind.config";

export const WIND_COLOR = theme.extend.colors["ocf-blue"].DEFAULT || "#48B0DF";
export const SOLAR_COLOR =
  theme.extend.colors["ocf-yellow"].DEFAULT || "#FFD166";
export const COMBINED_COLOR =
  theme.extend.colors["ocf-green"].DEFAULT || "#06D6A0";
export const ACTUAL_COLOR = "#FFFFFF";

export const TOOLTIP_DISPLAY_NAMES = {
  solar_forecast_past: "OCF Forecast",
  solar_forecast_future: "OCF Forecast",
  wind_forecast_past: "OCF Forecast",
  wind_forecast_future: "OCF Forecast",
  solar_generation: "Actual",
  wind_generation: "Actual",
};
