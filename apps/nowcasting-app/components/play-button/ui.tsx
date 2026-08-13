import React from "react";

type UiProps = {
  onClick: () => void;
  isPlaying: boolean;
};

/**
 * Phase 6 followup, Track P: the footer's version of this control, not the chart header's.
 *
 * This used to be a full-height yellow block (`w-14 h-14 dash:h-full`) sized for a chart header
 * row. Its only home now is the dense footer strip (plus `/sites`, which has no footer of its
 * own — see `components/play-button/index.tsx`'s doc comment), so it is sized and weighted like
 * the footer's other controls (`now` in `scrub-track.tsx`, the grain value in
 * `cursor-readout.tsx`): a small bordered icon button rather than a headline block, with
 * `aria-label`/`aria-pressed`/`title` matching the pattern the `now` button already set, and a
 * native `<button>` so it is keyboard-operable for free.
 */
const Ui: React.FC<UiProps> = ({ onClick, isPlaying }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isPlaying}
      aria-label={isPlaying ? "Pause" : "Play"}
      title={isPlaying ? "Pause playback" : "Play through the window"}
      className="flex h-7 w-7 flex-none items-center justify-center rounded border border-white/10 text-ocf-yellow transition-colors hover:border-white/20 hover:bg-white/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-ocf-yellow"
    >
      {isPlaying ? (
        <svg width="14" height="14" viewBox="7 6 10 12" fill="none" aria-hidden="true">
          <path fill="currentColor" d="M11 7H8v10h3V7zM13 17h3V7h-3v10z" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="12 9 21 24" fill="currentColor" aria-hidden="true">
          <path d="M13.75 10.5V31.5L31.25 21L13.75 10.5Z" />
        </svg>
      )}
    </button>
  );
};

export default Ui;
