type TipPosition = "left" | "right" | "middle" | "top";

type ForecastLabelProps = {
  children: React.ReactNode;
  tip: string | React.ReactNode;
  position?: TipPosition;
  className?: string;
  id: string;
};

const getPositionClass = (position: TipPosition) => {
  if (position === "left") return "left-0";
  if (position === "right") return "-right-3";
  if (position === "middle") return "bottom-1 left-1/2 transform -translate-x-1/2 translate-y-full";
  if (position === "top")
    return "-top-[calc(100%+0.5rem)] left-1/2 transform -translate-x-1/2 -translate-y-full";

  return "top-0 left-0"; // Default case for top-left
};

const ForecastLabel: React.FC<ForecastLabelProps> = ({
  children,
  tip,
  position = "left",
  className,
  id
}) => {
  return (
    <div
      id={id}
      className={`relative z-50 overflow-visible cursor-default flex group ${className || ""}`}
    >
      {children}
      <div
        className={`absolute flex ${getPositionClass(
          position
        )} hidden w-auto mt-6 group-hover:flex flex-wrap`}
      >
        <span
          className={`relative flex top-0 text-center mb-0 mt-2 text-xs px-3 py-1 leading-snug bg-mapbox-black bg-opacity-90 rounded-lg text-white drop-shadow-lg`}
        >
          {tip}
        </span>
      </div>
    </div>
  );
};

export default ForecastLabel;
