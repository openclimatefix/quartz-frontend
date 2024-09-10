export type TooltipPosition = "left" | "right" | "middle" | "top" | "top-middle" | "top-left";
type TooltipProps = {
  children: React.ReactNode;
  tip: string | React.ReactNode;
  position?: TooltipPosition;
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
      containerPositionClass = "right-9";
      tipPositionClass = "-right-1 top-1";
      break;
    case "right":
      containerPositionClass = "left-2";
      tipPositionClass = "-left-2 top-0";
      break;
    case "middle":
      containerPositionClass = "right-5";
      // containerPositionClass = "left-1/2 transform -translate-x-1/2";
      tipPositionClass = "-right-1 top-0";
      break;
    case "top":
      containerPositionClass = "bottom-5 right-2";
      tipPositionClass = "-right-2 bottom-0";
      break;
    case "top-middle":
      containerPositionClass = "bottom-6 -left-32 transform translate-x-2";
      tipPositionClass = "-left-1 bottom-0";
      break;
    case "top-left":
      containerPositionClass = "bottom-8 right-64 transform -translate-x-2";
      tipPositionClass = "-left-1 bottom-0";
      break;
  }
  return (
    <div
      className={`relative flex flex-col group ${fullWidth ? "w-full" : "w-fit items-center"} 
      ${className || ""}`}
    >
      {position !== "top" && children}
      <div
        className={`absolute flex flex-col items-center hidden mt-6 group-hover:flex w-fit w-64 ${containerPositionClass}`}
      >
        <span
          className={`absolute ${tipPositionClass} mb-1 z-30 p-2 text-xs leading-none text-white whitespace-no-wrap bg-ocf-black shadow-lg rounded-md`}
        >
          {tip}
        </span>
        <div className="w-3 h-5 -mt-[6px] rotate-45 bg-ocf-black hidden"></div>
      </div>
      {position === "top" && children}
    </div>
  );
};

export default Tooltip;
