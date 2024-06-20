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

type SpinnerProps = {
  className?: string;
  children?: React.ReactNode;
};

export const Spinner: React.FC<SpinnerProps> = ({ className = "" }) => {
  return (
    <svg
      role="status"
      className={`mr-2 text-ocf-gray-700 m-auto self-center animate-spin dark:text-gray-600 ${className}`}
      viewBox="0 0 100 101"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ margin: "auto" }}
    >
      <path
        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
        fill="currentColor"
      />
      <path
        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
        fill="currentFill"
      />
    </svg>
  );
};

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
  <svg
    width={16}
    height={16}
    viewBox="0 0 16 16"
    fill="none"
    className={className || ""}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1.2928 2.29309C1.48034 2.10543 1.73467 2 1.99985 2C2.26503 2 2.51935 2.10543 2.70689 2.29309L7.7072 7.29831C7.89468 7.48603 8 7.7406 8 8.00604C8 8.27148 7.89468 8.52606 7.7072 8.71378L2.70689 13.719C2.51828 13.9013 2.26566 14.0022 2.00345 14C1.74123 13.9977 1.49041 13.8924 1.30499 13.7068C1.11957 13.5212 1.01439 13.2701 1.01211 13.0077C1.00983 12.7452 1.11064 12.4923 1.2928 12.3035L5.58607 8.00604L1.2928 3.70857C1.10532 3.52084 1 3.26627 1 3.00083C1 2.73539 1.10532 2.48082 1.2928 2.29309Z"
      fill="white"
    />
    <path
      d="M8.2928 2.35977C8.48034 2.17211 8.73467 2.06668 8.99985 2.06668C9.26503 2.06668 9.51935 2.17211 9.70689 2.35977L14.7072 7.36499C14.8947 7.55271 15 7.80728 15 8.07272C15 8.33816 14.8947 8.59274 14.7072 8.78046L9.70689 13.7857C9.51828 13.968 9.26566 14.0689 9.00345 14.0666C8.74123 14.0644 8.49041 13.9591 8.30499 13.7735C8.11957 13.5879 8.01439 13.3368 8.01211 13.0743C8.00983 12.8119 8.11064 12.559 8.2928 12.3702L12.5861 8.07272L8.2928 3.77525C8.10532 3.58752 8 3.33295 8 3.06751C8 2.80207 8.10532 2.5475 8.2928 2.35977Z"
      fill="white"
    />
  </svg>
);

// chevron double left

export const ChevronLeft: React.FC<IconProps> = ({ className }) => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 16 16"
    fill="none"
    className={className || ""}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M14.7072 2.29309C14.5197 2.10543 14.2653 2 14.0002 2C13.735 2 13.4806 2.10543 13.2931 2.29309L8.2928 7.29831C8.10532 7.48603 8 7.7406 8 8.00604C8 8.27148 8.10532 8.52606 8.2928 8.71378L13.2931 13.719C13.4817 13.9013 13.7343 14.0022 13.9966 14C14.2588 13.9977 14.5096 13.8924 14.695 13.7068C14.8804 13.5212 14.9856 13.2701 14.9879 13.0077C14.9902 12.7452 14.8894 12.4923 14.7072 12.3035L10.4139 8.00604L14.7072 3.70857C14.8947 3.52084 15 3.26627 15 3.00083C15 2.73539 14.8947 2.48082 14.7072 2.29309Z"
      fill="white"
    />
    <path
      d="M7.7072 2.35977C7.51966 2.17211 7.26533 2.06668 7.00015 2.06668C6.73497 2.06668 6.48065 2.17211 6.29311 2.35977L1.2928 7.36499C1.10532 7.55271 1 7.80728 1 8.07272C1 8.33816 1.10532 8.59274 1.2928 8.78046L6.29311 13.7857C6.48172 13.968 6.73434 14.0689 6.99655 14.0666C7.25877 14.0644 7.50959 13.9591 7.69501 13.7735C7.88043 13.5879 7.98561 13.3368 7.98789 13.0743C7.99017 12.8119 7.88936 12.559 7.7072 12.3702L3.41393 8.07272L7.7072 3.77525C7.89468 3.58752 8 3.33295 8 3.06751C8 2.80207 7.89468 2.5475 7.7072 2.35977Z"
      fill="white"
    />
  </svg>
);

// hamburger menu

export const HamburgerMenu: React.FC<IconProps> = ({ className }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    className={className || ""}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1.7 2C1.51435 2 1.3363 2.09031 1.20503 2.25105C1.07375 2.4118 1 2.62981 1 2.85714C1 3.08447 1.07375 3.30249 1.20503 3.46323C1.3363 3.62398 1.51435 3.71429 1.7 3.71429H14.3C14.4857 3.71429 14.6637 3.62398 14.795 3.46323C14.9263 3.30249 15 3.08447 15 2.85714C15 2.62981 14.9263 2.4118 14.795 2.25105C14.6637 2.09031 14.4857 2 14.3 2H1.7ZM1.7 7.14286C1.51435 7.14286 1.3363 7.23316 1.20503 7.39391C1.07375 7.55465 1 7.77267 1 8C1 8.22733 1.07375 8.44535 1.20503 8.60609C1.3363 8.76684 1.51435 8.85714 1.7 8.85714H14.3C14.4857 8.85714 14.6637 8.76684 14.795 8.60609C14.9263 8.44535 15 8.22733 15 8C15 7.77267 14.9263 7.55465 14.795 7.39391C14.6637 7.23316 14.4857 7.14286 14.3 7.14286H1.7ZM1.7 12.2857C1.51435 12.2857 1.3363 12.376 1.20503 12.5368C1.07375 12.6975 1 12.9155 1 13.1429C1 13.3702 1.07375 13.5882 1.20503 13.7489C1.3363 13.9097 1.51435 14 1.7 14H14.3C14.4857 14 14.6637 13.9097 14.795 13.7489C14.9263 13.5882 15 13.3702 15 13.1429C15 12.9155 14.9263 12.6975 14.795 12.5368C14.6637 12.376 14.4857 12.2857 14.3 12.2857H1.7Z"
      fill="currentColor"
    />
  </svg>
);

// info icon

export const InfoIcon = (props: React.SVGProps<SVGSVGElement>) => (
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
  </svg>
);

// power

export const PowerIcon: React.FC<IconProps> = ({ className }) => (
  <span>
    <svg
      className={className || ""}
      width={32}
      height={32}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15.519 19.027v-.865H6.902l7.752-13.957v8.768c0 .23.09.45.255.61.16.16.385.255.61.255h8.617l-7.752 13.957v-8.768a.875.875 0 00-.865-.865v.865h-.865v12.106a.867.867 0 001.622.424l10.087-18.16a.883.883 0 00-.009-.86.87.87 0 00-.743-.428h-9.223V.867a.866.866 0 00-1.621-.424L4.679 18.603a.864.864 0 00.752 1.288H15.52v-.864h-.865.865z"
        fill="white"
      />
    </svg>
  </span>
);

export const PowerIcon24: React.FC<IconProps> = ({ className }) => (
  <span>
    <svg
      className={className || ""}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M11.639 14.27V13.6214H5.17599L10.9904 3.15351V9.73001C10.9904 9.90188 11.0585 10.0673 11.1817 10.1872C11.3017 10.3072 11.4704 10.3786 11.639 10.3786H18.102L12.2876 20.8465V14.27C12.2876 14.0981 12.2195 13.9327 12.0962 13.8128C11.9762 13.6928 11.8076 13.6214 11.639 13.6214V14.27H10.9904V23.35C10.9904 23.6451 11.1915 23.9045 11.4769 23.9791C11.7622 24.0537 12.0638 23.924 12.2065 23.6678L19.772 10.0478C19.8823 9.84675 19.8791 9.60029 19.7656 9.40248C19.6488 9.20467 19.4348 9.08144 19.2078 9.08144H12.2908V0.650035C12.2908 0.354936 12.0897 0.0955074 11.8044 0.020922C11.519 -0.0536635 11.2174 0.0760525 11.0747 0.332237L3.50917 13.9522C3.39891 14.1533 3.40216 14.3997 3.51566 14.5975C3.62916 14.7953 3.84643 14.9186 4.07343 14.9186H11.639V14.27H10.9904H11.639Z"
        fill="currentColor"
      />
    </svg>
  </span>
);

// solar
export const SolarIcon: React.FC<IconProps> = ({ className }) => (
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
);
export const SolarIcon24: React.FC<IconProps> = ({ className }) => (
  <svg
    className={className || ""}
    width={24}
    height={24}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M11.301.786v3.698H12.7V.786H11.3zM11.301 21.087v3.699H12.7v-3.699H11.3z"
      fill="#fff"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.959 18.868a6.041 6.041 0 100-12.082 6.041 6.041 0 000 12.082zm0-1.397a4.644 4.644 0 100-9.288 4.644 4.644 0 000 9.288z"
      fill="#fff"
    />
    <path
      d="M20.301 12.087H24v1.397h-3.699v-1.397zM0 12.087h3.699v1.397H0v-1.397zM17.356 6.441l2.616-2.615.988.988-2.616 2.615-.988-.988zM3.001 20.797l2.616-2.616.988.988-2.616 2.616-.988-.988zM20.96 20.758l-2.616-2.616-.988.988 2.616 2.616.988-.988zM6.605 6.402L3.989 3.787l-.988.988L5.617 7.39l.988-.988z"
      fill="#fff"
    />
  </svg>
);

// wind

export const WindIcon: React.FC<IconProps> = ({ className, strokeWidth }) => (
  <svg
    className={className || ""}
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
);
export const WindIcon24: React.FC<IconProps> = ({ className, strokeWidth }) => (
  <svg
    className={className || ""}
    width={24}
    height={24}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M11.815 6.9a1.757 1.757 0 111.758 1.757H1.941v1.286h11.63A3.043 3.043 0 1010.53 6.9h1.285z"
      fill="#fff"
    />
    <path
      d="M19.2 9.485a1.757 1.757 0 111.757 1.757H0v1.285h20.957a3.043 3.043 0 10-3.043-3.042H19.2zM19.2 16.87a3.043 3.043 0 00-3.043-3.044H1.942v1.286h14.215A1.757 1.757 0 1114.4 16.87h-1.286a3.043 3.043 0 106.086 0z"
      fill="#fff"
    />
  </svg>
);

export const DownloadIcon: React.FC<IconProps> = ({
  className,
  strokeWidth,
}) => (
  <svg
    className={className || ""}
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    fill="none"
  >
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="m16.75 8.96-4.01 4.01-.707.708-.708-.707-4.01-4.01 1.414-1.415 2.304 2.303V2h2v7.85l2.303-2.304zM1 20.34v-9h6v2H3v5h18v-5h-4v-2h6v9H1"
      clipRule="evenodd"
    />
  </svg>
);
