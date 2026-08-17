import React from "react";
import { PlaybackSpeed } from "../helpers/globalState";

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

const SPEEDS: PlaybackSpeed[] = [1, 2, 4];

type SpeedControlProps = {
  speed: PlaybackSpeed;
  onChange: (speed: PlaybackSpeed) => void;
};

/**
 * The 1x/2x/4x rate picker, stacked under the play button (`index.tsx` owns the stack, and
 * that stacking is what lets both the footer and `/sites` pick this up for free).
 *
 * Same width as the button above it (`w-7`) so the pair reads as one column, not two
 * differently-sized controls sharing a corner. It is secondary to the button and the scrub
 * track it sits under, so it is a row of bare text rather than another bordered icon block —
 * quiet, not competing. `aria-pressed` marks the active speed the same way the button marks
 * play/pause; `role="group"` plus its `aria-label` say what the buttons are choosing between,
 * since colour/weight alone would not reach assistive tech.
 */
export const SpeedControl: React.FC<SpeedControlProps> = ({ speed, onChange }) => (
  <div
    role="group"
    aria-label={`Playback speed: ${speed}x`}
    className="mt-1 flex w-7 justify-between"
  >
    {SPEEDS.map((s) => (
      <button
        key={s}
        type="button"
        onClick={() => onChange(s)}
        aria-pressed={speed === s}
        title={`Play at ${s}x speed`}
        className={`rounded-sm px-0.5 text-2xs leading-none transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ocf-yellow ${
          speed === s ? "text-ocf-yellow" : "text-ocf-gray-700 hover:text-ocf-gray-400"
        }`}
      >
        {s}x
      </button>
    ))}
  </div>
);

export default Ui;
