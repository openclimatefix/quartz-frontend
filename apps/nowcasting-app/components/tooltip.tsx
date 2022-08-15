type TooltipProps = {
  tip: string | React.ReactNode;
  position?: "left" | "right" | "middle";
  className?: string;
};

const Tooltip: React.FC<TooltipProps> = ({ children, tip, position = "left", className }) => {
  const getPositionClass = (position: "left" | "right" | "middle") => {
    if (position === "left") return "-right-2";
    if (position === "right") return "-left-2";
    if (position === "middle") return "";
  };
  return (
    <div className={`relative flex flex-col items-center group ml-auto w-fit ${className || ""}`}>
      {children}
      <div className="absolute flex flex-col items-center hidden mb-8 group-hover:flex">
        <span
          className={`absolute ${getPositionClass(
            position,
          )} bottom-0 w-auto mb-1 z-10 p-2 text-xs leading-none text-white whitespace-no-wrap bg-ocf-black shadow-lg`}
        >
          {tip}
        </span>
        <div className="w-3 h-3 -mt-2 rotate-45 bg-ocf-black"></div>
      </div>
    </div>
  );
};

export default Tooltip;
