import { TOOLTIP_DISPLAY_NAMES } from "@/src/constants";

export type ITooltipRow = {
  dataType: "generation" | "forecast";
  name: keyof typeof TOOLTIP_DISPLAY_NAMES;
  value: number | undefined;
};
