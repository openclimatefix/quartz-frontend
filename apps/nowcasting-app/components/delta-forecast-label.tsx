type DeltaForecastLabelProps = {
  children: React.ReactNode;
  tip: string | React.ReactNode;
  position?: "left" | "right" | "middle";
  className?: string;
};

const DeltaForecastLabel: React.FC<DeltaForecastLabelProps> = ({
  children,
  tip,
  position = "middle",
  className
}) => {
  const getPositionClass = (position: "left" | "right" | "middle") => {
    if (position === "left") return "-left-10";
    if (position === "right") return "-right-10";
    if (position === "middle") return "left-[50%] transform -translate-x-1/2";
  };
  return (
    <div
      className={`relative cursor-default flex flex-initial whitespace-nowrap group ${
        className || ""
      }`}
    >
      {children}
      <div
        className={`absolute ${getPositionClass(
          position
        )} flex hidden pointer-events-none z-40 mt-3 group-hover:flex flex-wrap`}
      >
        <span
          className={`relative flex top-1 text-center mb-0 mt-2 z-10 text-xs px-1 py-1 leading-snug rounded-lg text-white bg-ocf-black`}
        >
          {tip}
        </span>
      </div>
    </div>
  );
};

export default DeltaForecastLabel;
