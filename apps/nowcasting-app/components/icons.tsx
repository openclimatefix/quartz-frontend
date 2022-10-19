import React from "react";

type LegendLineGraphIconProps = {
  className?: string;
  dashed?: boolean;
};

type CloseButtonIconProps = {
  className?: string;
};

type ClockIconProps = {
  className?: string;
};

type InfoIconProps = {
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
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    width="2rem"
    height="2rem"
    viewBox="0 0 24 24"
  >
    <path
      strokeWidth={0.5}
      d="M20.030 5.030l-1.061-1.061-6.97 6.97-6.97-6.97-1.061 1.061 6.97 6.97-6.97 6.97 1.061 1.061 6.97-6.97 6.97 6.97 1.061-1.061-6.97-6.97 6.97-6.97z"
      fill="white"
    />
  </svg>
);

export const ClockIcon: React.FC<ClockIconProps> = ({ className }) => (
  <svg
    viewBox="0 0 32 32"
    width="16"
    height="16"
    xmlns="http://www.w3.org/2000/svg"
    fill-rule="evenodd"
    fill="white"
    clip-rule="evenodd"
  >
    <path
      d="M12 0c6.623 0 12 5.377 12 12s-5.377 12-12 12-12-5.377-12-12 5.377-12 12-12zm0 1c6.071
      0 11 4.929 11 11s-4.929 11-11 11-11-4.929-11-11 4.929-11 11-11zm0 11h6v1h-7v-9h1v8z"
    />
  </svg>
);

export const InfoIcon: React.FC<InfoIconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="25" width="25" viewBox="0 0 250 250" fill="white">
    <path
      d="M128,27.99963a100,100,0,1,0,100,100A100.11269,100.11269,0,0,0,128,27.99963Zm0,192a92,92,0,1,1,92-92A92.10478,92.10478,0,0,1,128,219 
    99963Zm12-44a4.0002,4.0002,0,0,1-4,4h-8a4.0002,4.0002,0,0,1-4-4v-52h-4a4,4,0,0,1,0-8h8a4.0002,4.0002,0,0,1,4,4v52h4A4.0002,4.0002,0,0,1,140,
    175.99963ZM122.34375,89.65686A8.00022,8.00022,0,1,1,136.001,83.99963v.002a8.00053,8.00053,0,0,1-13.65723,5.65527Z"
    />
  </svg>
);
