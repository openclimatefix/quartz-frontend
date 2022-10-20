import React from "react";

type LegendLineGraphIconProps = {
  className?: string;
  dashed?: boolean;
};

type IconProps = {
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

export const CloseButtonIcon: React.FC<IconProps> = ({ className }) => (
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

export const ClockIcon: React.FC<IconProps> = ({ className }) => (
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

export const ExternalLinkIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    className={className}
    width="8"
    height="8"
    viewBox="0 0 8 8"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g clipPath="url(#clip0_166_5158)">
      <path
        d="M6 4.33333V6.33333C6 6.51014 5.92976 6.67971 5.80474 6.80474C5.67971 6.92976 5.51014 7 5.33333 7H1.66667C1.48986 7 1.32029 6.92976 1.19526 6.80474C1.07024 6.67971 1 6.51014 1 6.33333V2.66667C1 2.48986 1.07024 2.32029 1.19526 2.19526C1.32029 2.07024 1.48986 2 1.66667 2H3.66667"
        stroke="white"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 1H7V3"
        stroke="white"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.3335 4.66667L7.00016 1"
        stroke="white"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <defs>
      <clipPath id="clip0_166_5158">
        <rect width="8" height="8" fill="white" />
      </clipPath>
    </defs>
  </svg>
);
