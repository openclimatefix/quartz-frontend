import React from "react";

type LegendLineGraphIconProps = {
  className?: string;
  dashed?: boolean;
};

type CloseButtonIconProps = {
  className?: string;
};

export const LegendLineGraphIcon: React.FC<LegendLineGraphIconProps> = ({
  className,
  dashed = false
}) => (
  <svg
    className={className}
    width="24"
    height="22"
    viewBox="0 0 24 22"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 19C7 19 12 16 12.5 11C13 6 17 3 21 3"
      strokeWidth={2}
      stroke="currentColor"
      strokeDasharray={dashed ? "3 3" : "0"}
    />
  </svg>
);

export const CloseButtonIcon: React.FC<CloseButtonIconProps> = ({ className }) => (
  <svg
    className={className}
    width="3rem"
    height="3rem"
    viewBox="0 0 16 16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      stroke="currentColor"
      strokeWidth={0.5}
      d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"
    />
  </svg>
);
