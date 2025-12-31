type TooltipProps = {
  children: React.ReactNode;
  tip: string | React.ReactNode;
  position?: "left" | "right" | "middle" | "top";
  className?: string;
  fullWidth?: boolean;
};

const Tooltip: React.FC<TooltipProps> = ({
  children,
  tip,
  position,
  className,
  fullWidth = false
}) => {
  let containerPositionClass = "";
  let tipPositionClass = "";
  switch (position) {
    case "left":
      containerPositionClass = "right-1";
      tipPositionClass = "-right-1 top-2";
      break;
    case "right":
      containerPositionClass = "left-1";
      tipPositionClass = "-left-1 top-2";
      break;
    // case "middle":
    //   containerPositionClass = "right-5";
    //   // containerPositionClass = "left-1/2 transform -translate-x-1/2";
    //   tipPositionClass = "-right-1 top-0";
    //   break;
    // case "top":
    //   containerPositionClass = "bottom-5 right-2";
    //   tipPositionClass = "-right-2 bottom-0";
  }
  return (
    <div
      className={`relative flex flex-col group z-20 ${fullWidth ? "w-full" : "w-max items-center"} 
      ${className || ""}`}
    >
      {position !== "top" && children}
      <div
        className={`absolute flex-col items-center hidden mt-6 group-hover:flex w-fit ${containerPositionClass}`}
      >
        <span
          className={`absolute ${tipPositionClass} mb-1 z-30 p-2 text-xs leading-none text-white whitespace-no-wrap bg-ocf-black shadow-lg rounded-md`}
        >
          {tip}
        </span>
        {/*<div className="w-3 h-5 -mt-[6px] rotate-45 bg-ocf-black "></div>*/}
      </div>
      {position === "top" && children}
    </div>
  );
};

export default Tooltip;
