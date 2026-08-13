import React, { useRef, useEffect } from "react";
import useGlobalState, { getCursorCadenceMinutes } from "../helpers/globalState";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import { addMinutesToISODate, formatISODateString } from "../helpers/utils";
import Ui from "./ui";

/**
 * Phase 6 followup, Track P: the footer's play control, and the two-way mutual exclusion with
 * "following now".
 *
 * There are two genuinely different ways the cursor moves on its own:
 *
 * - **playing** — this component walks it forward a slot at a time on its own `setInterval`,
 *   with `isPlaying` in global state as the flag other components read;
 * - **following now (live)** — `use-and-update-selected-time`'s 60-second interval pins the
 *   cursor to the current slot. Its existence *is* the mode: it is recorded in the `intervals`
 *   global (see `scrub-track.tsx`'s `isLive`), and `stopTime`/`resetTime` stop and start it.
 *
 * They must never both be true. `play()` already had one direction — it calls `stopTime()`
 * before starting. The direction that was missing is the reverse: resuming following (the
 * footer's `now` button, via `resetTime`) must stop playback. Rather than inventing a third
 * notion of "moving on its own", this reads the same `intervals` global `scrub-track.tsx`
 * already reads: a transition to a non-empty `intervals` array while `isPlaying` is true means
 * following just resumed, and it wins — see the effect below.
 */
type PlayButtonProps = {
  endTime: string;
  startTime: string;
};

const PlayButton: React.FC<PlayButtonProps> = ({ endTime, startTime }) => {
  const [isPlaying, setIsPlaying] = useGlobalState("isPlaying");
  const [, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [intervals] = useGlobalState("intervals");
  const { stopTime } = useStopAndResetTime();
  const intervalRef = useRef<any>();
  const pause = () => {
    clearInterval(intervalRef.current);
    setIsPlaying(false);
  };

  const play = () => {
    stopTime();
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      setSelectedISOTime((selectedISOTime) => {
        if (formatISODateString(selectedISOTime || "") === formatISODateString(endTime)) {
          return startTime;
        }
        // Step the cursor by one slot on its own grid, not by a hardcoded half hour — on a
        // 15-minute grid that stride skipped every other published value.
        return addMinutesToISODate(selectedISOTime || "", getCursorCadenceMinutes());
      });
    }, 1000);
  };

  useEffect(() => {
    if (!isPlaying && intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, [isPlaying]);

  // The direction `play()` doesn't cover: following resumed (the `now` button's `resetTime`
  // started a fresh interval) while this was mid-playback. Pausing here — rather than, say,
  // `resetTime` reaching into `isPlaying` itself — keeps the two modes coordinated through the
  // one piece of state that already names "following", instead of adding a second wire between
  // them.
  useEffect(() => {
    if (intervals.length > 0 && isPlaying) {
      pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervals]);

  // Pause on mount. Used to be keyed on `view`, back when the three dashboard views were
  // mounted-but-hidden and this component stayed mounted across a tab switch — the dependency
  // was what caught the "switched away while playing" case. Every owner of `PlayButton` now
  // fully unmounts and remounts on the equivalent transitions (`pages/index.tsx` swaps
  // `PvRemixChart`/`DeltaViewChart` on `comparison`, and `/sites` is a real route change), so
  // this instance is always freshly mounted when it matters and an empty dependency array is
  // the same edge, not a behaviour change.
  useEffect(() => {
    pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ui
      onClick={() => {
        isPlaying ? pause() : play();
      }}
      isPlaying={isPlaying}
    ></Ui>
  );
};

export default PlayButton;
