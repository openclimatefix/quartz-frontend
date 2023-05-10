import React from "react";

type UiProps = {
  onClick: () => void;
  isPlaying: boolean;
};

const Ui: React.FC<UiProps> = ({ onClick, isPlaying }) => {
  return (
    <button
      className="flex items-center w-14 h-14 2xl:h-full 2xl:w-[5rem] text-lg 2xl:text-2xl justify-center text-black bg-ocf-yellow  hover:bg-ocf-yellow focus:z-10 focus:bg-ocf-yellow "
      onClick={() => {
        onClick();
      }}
    >
      {!isPlaying ? (
        <svg
          width="3.5rem"
          height="3.5rem"
          viewBox="0 0 42 42"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M13.75 10.5V31.5L31.25 21L13.75 10.5Z" fill="black" />
        </svg>
      ) : (
        <svg fill="none" viewBox="0 0 22 24" height="3rem" width="3rem">
          <path fill="currentColor" d="M11 7H8v10h3V7zM13 17h3V7h-3v10z" />
        </svg>
      )}
    </button>
  );
};

export default Ui;
