type TipPosition = "left" | "right" | "middle" | "top";

type LegendTooltipProps = {
  children: React.ReactNode;
  tip: string | React.ReactNode;
  position?: TipPosition;
  className?: string;
};

const getPositionClass = (position: TipPosition) => {
  if (position === "left") return "left-0";
  if (position === "right") return "-right-3";
  if (position === "middle") return "bottom-1 left-1/2 transform -translate-x-1/2 translate-y-full";
  if (position === "top")
    return "-top-[calc(100%+0.75rem)] left-1/2 transform -translate-x-1/2 -translate-y-full";

  return "top-0 left-0"; // Default case for top-left
};

const LegendTooltip: React.FC<LegendTooltipProps> = ({
  children,
  tip,
  position = "left",
  className
}) => {
  return (
    <div className={`relative z-[100] overflow-visible cursor-default group ${className || ""}`}>
      {children}
      {tip && (
        <div
          className={`absolute ${getPositionClass(
            position
          )} hidden w-max max-w-64 mt-6 group-hover:flex flex-wrap`}
        >
          <span
            className={`flex top-0 text-center mb-0 mt-2 text-xs px-3 py-1 leading-snug bg-mapbox-black bg-opacity-95 rounded-lg text-white drop-shadow-lg`}
          >
            {tip}
          </span>
        </div>
      )}
    </div>
  );
};

export default LegendTooltip;
