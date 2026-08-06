import { FC } from "react";

export const LegendItem: FC<{
  color: string;
  label: string;
  style?: "solid" | "dashed" | "dashDot";
  dotDash?: boolean;
}> = ({ color, label, style = "solid" }) => {
  let strokeDasharray = "none";
  switch (style) {
    case "solid":
      break;
    case "dashed":
      strokeDasharray = "6 3";
      break;
    case "dashDot":
      strokeDasharray = "8 3 2 3";
      break;
  }
  return (
    <div className="flex items-center">
      <svg viewBox={"0 0 24 24"} className="w-6 h-6 mr-2" xmlns="http://www.w3.org/2000/svg">
        <line
          x1="0"
          y1="12"
          x2="24"
          y2="12"
          strokeWidth={2}
          stroke={color}
          strokeDasharray={strokeDasharray}
        />
      </svg>
      <span className="text-xs tracking-wide">{label}</span>
    </div>
  );
};
