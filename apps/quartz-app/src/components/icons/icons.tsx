import React from "react";

type LegendLineGraphIconProps = {
  className?: string;
  dashed?: boolean;
};

type IconProps = {
  className?: string;
  size?: number;
  strokeWidth?: number;
};

type InfoIconProps = {
  className?: string;
};

export const LegendLineGraphIcon: React.FC<LegendLineGraphIconProps> = ({
  className,
  dashed = false,
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
  <span>
    <svg width={20} height={16} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 2.667a5.333 5.333 0 100 10.666A5.333 5.333 0 008 2.667zM1.333 8a6.667 6.667 0 1113.334 0A6.667 6.667 0 011.333 8zM8 4c.368 0 .667.299.667.667V8A.667.667 0 018 8.667H6a.667.667 0 010-1.333h1.333V4.667C7.333 4.299 7.632 4 8 4z"
        fill="#fff"
      />
    </svg>
  </span>
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
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 1H7V3"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.3335 4.66667L7.00016 1"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <defs>
      <clipPath id="clip0_166_5158">
        <rect width="8" height="8" fill="currentColor" />
      </clipPath>
    </defs>
  </svg>
);

export const UpArrow: React.FC<IconProps> = ({ size = 22 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height={size}
    id="triangle-up"
    viewBox="0 0 32 32"
    width={size}
  >
    <path d="M4 24 H28 L16 6 z" />
  </svg>
);

export const DownArrow: React.FC<IconProps> = ({ size = 22 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height={size}
    id="triangle-down"
    viewBox="0 0 32 32"
    width={size}
  >
    <path d="M4 8 H28 L16 26 z" />
  </svg>
);

export const SitesDownArrow: React.FC<IconProps> = ({
  className,
  size = 16,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height={size}
    viewBox="0 0 36 25"
    width={size}
  >
    <path d="M4 8 H28 L16 26 z" />
  </svg>
);

export const SitesUpArrow: React.FC<IconProps> = ({ className, size = 16 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height={size}
    viewBox="0 0 36 16"
    width={size}
  >
    <path d="M4 24 H28 L16 6 z" />
  </svg>
);

export const ThinUpArrow: React.FC<IconProps> = ({ className }) => (
  <svg
    width="16"
    height="20"
    viewBox="0 0 28 24"
    xmlns="http://www.w3.org/2000/svg"
    fill="white"
    fill-rule="evenodd"
    clip-rule="evenodd"
  >
    <path d="M11 2.206l-6.235 7.528-.765-.645 7.521-9 7.479 9-.764.646-6.236-7.53v21.884h-1v-21.883z" />
  </svg>
);

export const ThinDownArrow: React.FC<IconProps> = ({ className }) => (
  <svg
    width="16"
    height="20"
    viewBox="0 0 28 16"
    fill="white"
    strokeWidth="5"
    xmlns="http://www.w3.org/2000/svg"
    fill-rule="evenodd"
    clip-rule="evenodd"
  >
    <path d="M11 21.883l-6.235-7.527-.765.644 7.521 9 7.479-9-.764-.645-6.236 7.529v-21.884h-1v21.883z" />
  </svg>
);

export const Checkmark: React.FC<IconProps> = ({ className }) => (
  // checkmark
  <svg
    className={`w-4 h-4 mr-1 -mt-1${className ? ` ${className}` : ""}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M5 13l4 4L19 7"
    />
  </svg>
);

export const SpinnerSmall = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    className={`animate-spin fill-white ${props.className}`}
    width={24}
    height={24}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx={12}
      cy={12}
      r={10.5}
      stroke="currentColor"
      fill="none"
      strokeOpacity={0.25}
      strokeWidth={3}
    />
    <path
      d="M12 1.5a10.5 10.5 0 019.988 7.26"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SpinnerTextInline = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    className={`animate-spin fill-white ${props.className}`}
    width={14}
    height={14}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx={7}
      cy={7}
      r={6}
      stroke="currentColor"
      fill="none"
      strokeOpacity={0.25}
      strokeWidth={2}
    />
    <path
      d="M7 1a6 6 0 015.707 4.149"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SpinnerTextInlineSmall = (
  props: React.SVGProps<SVGSVGElement> & { title?: string }
) => (
  <span title={props.title || "Loading..."}>
    <svg
      width={10}
      height={10}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`animate-spin fill-white ${props.className}`}
    >
      <circle
        cx={5}
        cy={5}
        r={4}
        stroke="currentColor"
        fill="none"
        strokeOpacity={0.25}
        strokeWidth={2}
      />
      <path
        d="M5 1a4 4 0 013.805 2.766"
        stroke="currentColor"
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

export const CheckInlineSmall = (
  props: React.SVGProps<SVGSVGElement> & { title: string }
) => (
  <span title={props.title || ""}>
    <svg
      width={10}
      height={10}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={props.className}
    >
      <path
        d="M1 5l3 3 5-5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

export const CrossInlineSmall = (
  props: React.SVGProps<SVGSVGElement> & { title: string }
) => (
  <span title={props.title || ""}>
    <svg
      width={10}
      height={10}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={props.className}
    >
      <path
        d="M2 8l6-6M2 2l3 3 3 3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

export const ClockInlineSmall = (
  props: React.SVGProps<SVGSVGElement> & { title: string }
) => (
  <span>
    <svg
      width={10}
      height={10}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g clipPath="url(#prefix__clip0_2537_298)" stroke="currentColor">
        <path d="M9.5 5a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
        <path d="M5 2.5V5H3.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <defs>
        <clipPath id="prefix__clip0_2537_298">
          <path fill="currentColor" d="M0 0h10v10H0z" />
        </clipPath>
      </defs>
    </svg>
  </span>
);

// right arrow

export const RightArrow: React.FC<IconProps> = ({ className }) => (
  <span>
    <svg
      className={className || ""}
      width={28}
      height={8}
      fill="none"
      viewBox={`0 0 28 8`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20.354 4.354a.5.5 0 000-.708L17.172.464a.5.5 0 10-.707.708L19.293 4l-2.828 2.828a.5.5 0 10.707.708l3.182-3.182zM8 4.5h12v-1H8v1z"
        fill="#fff"
      />
    </svg>
  </span>
);

// chevron double right
export const ChevronRight: React.FC<IconProps> = ({ className }) => (
  <span>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      className="w-6 h-6"
      stroke="white"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5"
      />
    </svg>
  </span>
);

// chevron double left

export const ChevronLeft: React.FC<IconProps> = ({ className }) => (
  <span>
    <svg width={24} height={24} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width={24} height={24} rx={8} fill="#fff" fillOpacity={0.4} />
      <path
        d="M18.707 6.293a1 1 0 00-1.414 0l-5 5a1 1 0 000 1.414l5 5a1 1 0 001.414-1.414L14.414 12l4.293-4.293a1 1 0 000-1.414z"
        fill="#fff"
      />
      <path
        d="M11.707 6.293a1 1 0 00-1.414 0l-5 5a1 1 0 000 1.414l5 5a1 1 0 001.414-1.414L7.414 12l4.293-4.293a1 1 0 000-1.414z"
        fill="#fff"
      />
    </svg>
  </span>
);

// hamburger menu

export const HamburgerMenu: React.FC<IconProps> = ({ className }) => (
  <span>
    <svg width={24} height={24} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 5a1 1 0 000 2h18a1 1 0 100-2H3zM3 11a1 1 0 100 2h18a1 1 0 100-2H3zM3 17a1 1 0 100 2h18a1 1 0 100-2H3z"
        fill="#fff"
      />
    </svg>
  </span>
);

// info icon

export const InfoIcon = (props: React.SVGProps<SVGSVGElement>) => {
  <svg
    width={24}
    height={24}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 8h.01"
      stroke="#fff"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11 12h1v4h1"
      stroke="#fff"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>;
};

// power

export const PowerIcon: React.FC<IconProps> = ({ className }) => (
  <span>
    <svg
      className={className || ""}
      width={32}
      height={32}
      fill="none"
      stroke={"white"}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15.519 19.027v-.865H6.902l7.752-13.957v8.768c0 .23.09.45.255.61.16.16.385.255.61.255h8.617l-7.752 13.957v-8.768a.875.875 0 00-.865-.865v.865h-.865v12.106a.867.867 0 001.622.424l10.087-18.16a.883.883 0 00-.009-.86.87.87 0 00-.743-.428h-9.223V.867a.866.866 0 00-1.621-.424L4.679 18.603a.864.864 0 00.752 1.288H15.52v-.864h-.865.865z"
        fill="white"
      />
    </svg>
  </span>
);

// solar
export const SolarIcon: React.FC<IconProps> = ({ className }) => (
  <span>
    <svg
      className={className || ""}
      width={32}
      height={33}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15.069.714v4.932h1.862V.714h-1.863zM15.069 27.783v4.931h1.862v-4.931h-1.863z"
        fill="#fff"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.945 24.824a8.055 8.055 0 100-16.11 8.055 8.055 0 000 16.11zm0-1.863a6.192 6.192 0 100-12.384 6.192 6.192 0 000 12.384z"
        fill="#fff"
      />
      <path
        d="M27.069 15.783H32v1.863h-4.931v-1.863zM0 15.783h4.932v1.863H0v-1.863zM23.142 8.255l3.487-3.487 1.317 1.317-3.487 3.487-1.317-1.317zM4.002 27.395l3.487-3.487 1.317 1.318-3.487 3.487-1.317-1.318zM27.946 27.343l-3.487-3.487-1.317 1.318 3.487 3.487 1.317-1.318zM8.806 8.203L5.319 4.716 4.002 6.033 7.489 9.52l1.317-1.317z"
        fill="#fff"
      />
    </svg>
  </span>
);

// wind

export const WindIcon: React.FC<IconProps> = ({ className, strokeWidth }) => (
  <span>
    <svg
      width={32}
      height={32}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15.754 9.2a2.343 2.343 0 112.343 2.343H2.589v1.714h15.508A4.057 4.057 0 1014.04 9.2h1.714z"
        fill="#fff"
      />
      <path
        d="M25.6 12.646a2.343 2.343 0 112.343 2.343H0v1.714h27.943a4.057 4.057 0 10-4.057-4.057H25.6zM25.6 22.492a4.057 4.057 0 00-4.057-4.057H2.589v1.715h18.954a2.343 2.343 0 11-2.343 2.343h-1.714a4.057 4.057 0 008.114 0z"
        fill="#fff"
      />
    </svg>
  </span>
);
