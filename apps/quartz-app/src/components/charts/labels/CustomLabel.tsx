import { FC } from "react";

export const CustomLabel: FC<any> = ({
  value,
  offset,
  viewBox: { x },
  className,
  solidLine,
  onClick,
}) => {
  const yy = 25;
  return (
    <g>
      {/*<line*/}
      {/*  stroke="white"*/}
      {/*  strokeWidth={solidLine ? "2" : "1"}*/}
      {/*  strokeDasharray={solidLine ? "" : "3 3"}*/}
      {/*  fill="none"*/}
      {/*  fillOpacity="1"*/}
      {/*  x1={x}*/}
      {/*  y1={yy + 30}*/}
      {/*  x2={x}*/}
      {/*  y2={yy}*/}
      {/*></line>*/}
      <g className={`fill-white ${className || ""}`} onClick={onClick}>
        <rect
          x={x - 24}
          y={yy}
          width="48"
          height="21"
          offset={offset}
          fill={"inherit"}
        ></rect>
        <text
          x={x}
          y={yy + 15}
          fill="black"
          className="text-xs"
          id="time-now"
          textAnchor="middle"
        >
          {value}
        </text>
      </g>
    </g>
  );
};
