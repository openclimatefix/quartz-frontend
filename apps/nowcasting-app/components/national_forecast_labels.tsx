type ForecastLabelProps = {
  tip: string | React.ReactNode;
  position?: "left" | "right" | "middle";
  className?: string;
};

const ForecastLabel: React.FC<ForecastLabelProps> = ({
  children,
  tip,
  position = "left",
  className
}) => {
  const getPositionClass = (position: "left" | "right" | "middle") => {
    if (position === "left") return "-left-5";
    if (position === "right") return "-right-3";
    if (position === "middle")
      return "-bottom-full left-1/2 transform -translate-x-1/2 translate-y-3";
  };
  return (
    <div className={`relative z-50 overflow-visible cursor-default flex group ${className || ""}`}>
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
