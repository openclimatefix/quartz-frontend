import React from "react";
import logout from "../../pages/logout";

type LegendLineGraphIconProps = {
  className?: string;
  dashStyle?: "both" | "dashed" | "solid";
};

type IconProps = {
  className?: string;
};

type InfoIconProps = {
  className?: string;
};

export const LegendLineGraphIcon: React.FC<LegendLineGraphIconProps> = ({
  className,
  dashStyle = "solid"
}) => {
  let dash = "0";
  switch (dashStyle) {
    case "both":
      dash = "8 4 3 4 3";
      break;
    case "dashed":
      dash = "3 3";
      break;
    case "solid":
      break;
  }
  return (
    <svg
      className={className}
      width="20"
      height="18"
      viewBox="0 0 20 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.5 15.5C5.8 15.5 10 13 10.4 9.1C10.8 5.1 14.2 2.5 17.5 2.5"
        strokeWidth={2}
        stroke="currentColor"
        strokeLinecap="round"
        strokeDasharray={dash}
      />
    </svg>
  );
};

export const LegendAreaGraphIcon: React.FC<LegendLineGraphIconProps> = ({ className }) => {
  return (
    <svg
      className={className}
      width="20"
      height="18"
      viewBox="0 0 20 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 15.5C1.87861 15.5109 1.7622 15.5731 1.67637 15.6667C1.59054 15.7607 1.54231 15.8783 1.54231 16C1.54231 16.1217 1.59054 16.2393 1.67637 16.3333C1.7622 16.4269 1.87861 16.4891 2 16.5C2.39362 16.5327 2.7908 16.5338 3.1869 16.507C4.81548 16.3935 6.40004 15.829 7.84314 14.9673C9.53289 13.979 11.5594 12.6385 12.2608 10.4437C12.2917 10.3466 12.3199 10.2484 12.3453 10.1491C12.6961 8.69735 12.7647 6.98526 13.782 5.70539C14.5737 4.71012 15.7057 3.98989 16.9886 3.67384C17.3174 3.59156 17.6555 3.53401 18 3.5C18.1209 3.48869 18.2369 3.4261 18.3224 3.33252C18.408 3.23857 18.456 3.1213 18.456 3C18.456 2.8787 18.408 2.76143 18.3224 2.66748C18.2369 2.5739 18.1209 2.51131 18 2.5C17.6058 2.46595 17.206 2.46368 16.8057 2.49451C15.24 2.60838 13.6987 3.26384 12.4083 4.25181C10.7995 5.45575 9.14451 7.04778 8.508 9.05092C8.48796 9.11063 8.46841 9.17018 8.44945 9.22973C8.05984 10.4865 7.83539 12.1887 6.63861 13.3707C5.66619 14.3295 4.38907 15.0146 3.01881 15.3335C2.68435 15.4113 2.34398 15.4673 2 15.5Z"
        fill="currentColor"
      />
    </svg>
  );
};

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
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M7 12.3743C9.96813 12.3743 12.3743 9.96813 12.3743 7C12.3743 4.03187 9.96813 1.62573 7 1.62573C4.03187 1.62573 1.62573 4.03187 1.62573 7C1.62573 9.96813 4.03187 12.3743 7 12.3743Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 3.77545V7.00001L9.14971 8.07487"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
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

// icons for the delta view

type DeltaIconProps = {
  className?: string;
  size?: number;
};

export const UpArrow: React.FC<DeltaIconProps> = ({ className, size = 22 }) => (
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

export const DownArrow: React.FC<DeltaIconProps> = ({ className, size = 22 }) => (
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

export const SitesDownArrow: React.FC<DeltaIconProps> = ({ className, size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 0 36 25" width={size}>
    <path d="M4 8 H28 L16 26 z" />
  </svg>
);

export const SitesUpArrow: React.FC<DeltaIconProps> = ({ className, size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 0 36 16" width={size}>
    <path d="M4 24 H28 L16 6 z" />
  </svg>
);

export const ThinUpArrow: React.FC<DeltaIconProps> = ({ className }) => (
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

export const ThinDownArrow: React.FC<DeltaIconProps> = ({ className }) => (
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
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
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

export const CheckInlineSmall = (props: React.SVGProps<SVGSVGElement> & { title: string }) => (
  <span title={props.title || ""}>
    <svg
      width={10}
      height={10}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={props.className}
    >
      <path d="M1 5l3 3 5-5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

export const CrossInlineSmall = (props: React.SVGProps<SVGSVGElement> & { title: string }) => (
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

export const ClockInlineSmall = (props: React.SVGProps<SVGSVGElement> & { title: string }) => (
  <span title={props.title || ""}>
    <svg width={10} height={10} fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
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

export const ZoomOutIcon = (props: React.SVGProps<SVGSVGElement> & { title: string }) => (
  <span title={props.title || ""}>
    <svg viewBox="0 0 24 24" height="24" width="24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <style>
          {
            ".cls-1,.cls-2{fill:none;}.cls-2{stroke:#FFFF;stroke-linecap:round;stroke-linejoin:round;}"
          }
        </style>
      </defs>
      <g data-name="Layer 2" id="Layer_2">
        <g id="Workspace">
          <rect className="cls-1" height={24} width={24} />
          <circle className="cls-2" cx={11.5} cy={11.5} r={4.5} />
          <line className="cls-2" x1={18} x2={14.68} y1={18} y2={14.68} />
          <line className="cls-2" x1={9.5} x2={13.5} y1={11.5} y2={11.5} />
        </g>
      </g>
    </svg>
  </span>
);
export default ZoomOutIcon;
