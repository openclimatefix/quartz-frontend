import React from "react";

type UiProps = {
  onClick: () => void;
  isPlaying: boolean;
};

const Ui: React.FC<UiProps> = ({ onClick, isPlaying }) => {
  return (
    <button
      className="items-center w-16 h-16 px-3 text-lg m text-black bg-amber-400  hover:bg-amber-400 focus:z-10 focus:bg-amber-400 "
      onClick={() => {
        onClick();
      }}
      data-e2e={isPlaying ? "pause-button" : "play-button"}
    >
      {!isPlaying ? (
        <svg viewBox="0 0 24 24" fill="currentColor" height="3rem" width="3rem">
          <path d="M7 6v12l10-6z" />
        </svg>
      ) : (
        <svg fill="none" viewBox="0 0 24 24" height="3rem" width="3rem">
          <path fill="currentColor" d="M11 7H8v10h3V7zM13 17h3V7h-3v10z" />
        </svg>
      )}
    </button>
  );
};

export default Ui;
