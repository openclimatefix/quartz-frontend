type DeltaForecastLabelProps = {
  tip: string | React.ReactNode;
  position?: "left" | "right" | "middle";
  className?: string;
};

const DeltaForecastLabel: React.FC<DeltaForecastLabelProps> = ({
  children,
  tip,
  position = "left",
  className
}) => {
  const getPositionClass = (position: "left" | "right" | "middle") => {
    if (position === "left") return "-left-10";
    if (position === "right") return "-right-10";
    if (position === "middle") return "";
  };
  return (
    <div
      className={`relative cursor-default flex flex-1 whitespace-nowrap group ${className || ""}`}
    >
      {children}
      <div className="absolute flex hidden mt-6 group-hover:flex flex-wrap">
        <span
          className={`relative ${getPositionClass(
            position
          )} flex top-1 text-center mb-0 mt-2 z-10 text-xs px-1 py-1 leading-snug bg-ocf-gray-300 rounded-lg text-black`}
        >
          {tip}
        </span>
      </div>
    </div>
  );
};

export default DeltaForecastLabel;
