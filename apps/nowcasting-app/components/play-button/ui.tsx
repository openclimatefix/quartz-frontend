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
      // The same body every other button in the app wears — see `CONTROL_BUTTON_OFF` in
      // `map/control-button.ts`: transparent, a 2px `content-on-accent` ring, and a hover that
      // lifts the ground rather than touching the colour. Written out rather than imported
      // because the one thing that differs is the part that matters, and it would have to be
      // overridden anyway: the glyph stays `--interactive`, because this is a control.
      //
      // It had a brand-orange border, which made it the only outlined-in-accent object on a
      // screen where the accent marks the cursor family — the handle, the pill, NOW. A border
      // is the body of the button, not a statement about it.
      className="flex h-7 w-7 flex-none items-center justify-center rounded bg-transparent text-interactive ring-2 ring-inset ring-content-on-accent transition-colors hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-interactive"
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
 * The playback rate, as one cycling chip: it shows the speed you are playing at, and clicking it
 * moves to the next one — 1x → 2x → 4x → 1x.
 *
 * It was three buttons side by side. Two problems with that at this size: three labels do not
 * fit the play button's own 28px column, so the row set its own width and pushed the pair out of
 * alignment with the tick labels beside it; and two of the three were always inert, which is a
 * lot of permanent chrome for a setting almost nobody changes. A cycling chip is one target that
 * is always live and always exactly as wide as one label.
 *
 * The trade is discoverability — you cannot see the other speeds without clicking. That is the
 * right trade here: the set is three values on an obvious scale, the title and `aria-label` both
 * name the next one, and the cost of a wrong click is one more click.
 *
 * `mt-1` puts it on the tick-label row: the play button is `h-7` (28px) and `TrackTicks` opens
 * with its own `pt-1`, so the two baselines meet.
 */
export const SpeedControl: React.FC<SpeedControlProps> = ({ speed, onChange }) => {
  const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={`Playing at ${speed}x — click for ${next}x`}
      aria-label={`Playback speed: ${speed}x. Click for ${next}x`}
      className="mt-1 rounded-sm px-1 text-2xs leading-none text-content-muted transition-colors hover:text-content focus:outline-none focus-visible:ring-1 focus-visible:ring-interactive"
    >
      {speed}x
    </button>
  );
};

export default Ui;
