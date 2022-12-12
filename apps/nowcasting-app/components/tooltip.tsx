import React from "react";

type TooltipProps = {
  tip: string | React.ReactNode;
  position?: "left" | "right" | "middle" | "top";
  className?: string;
  fullWidth?: boolean;
};

const Tooltip: React.FC<TooltipProps> = ({
  children,
  tip,
  position = "left",
  className,
  fullWidth = false
}) => {
  let containerPositionClass = "";
  let tipPositionClass = "";
  switch (position) {
    case "left":
      containerPositionClass = "right-2";
      tipPositionClass = "-right-2 top-0";
      break;
    case "right":
      containerPositionClass = "left-2";
      tipPositionClass = "-left-2 top-0";
      break;
    case "middle":
      containerPositionClass = "left-1/2 transform -translate-x-1/2";
      tipPositionClass = "top-0";
      break;
    case "top":
      containerPositionClass = "bottom-7 right-2";
      tipPositionClass = "-right-2 bottom-0";
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
          className={`absolute ${tipPositionClass} w-auto mb-1 z-30 p-2 text-xs leading-none text-white whitespace-no-wrap bg-ocf-black shadow-lg`}
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
