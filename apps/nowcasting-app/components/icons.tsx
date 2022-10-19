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
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
    <path d="M12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0-2c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2.033 16.01c.564-1.789 1.632-3.932 1.821-4.474.273-.787-.211-1.136-1.74.209l-.34-.64c1.744-1.897 5.335-2.326 4.113.613-.763 1.835-1.309 3.074-1.621 4.03-.455 1.393.694.828 1.819-.211.153.25.203.331.356.619-2.498 2.378-5.271 2.588-4.408-.146zm4.742-8.169c-.532.453-1.32.443-1.761-.022-.441-.465-.367-1.208.164-1.661.532-.453 1.32-.442 1.761.022.439.466.367 1.209-.164 1.661z" />
  </svg>
);
