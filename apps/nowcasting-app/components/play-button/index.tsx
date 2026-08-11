import React, { useRef, useEffect } from "react";
import useGlobalState, { getCursorCadenceMinutes } from "../helpers/globalState";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import { addMinutesToISODate, formatISODateString } from "../helpers/utils";
import Ui from "./ui";

type PlayButtonProps = {
  endTime: string;
  startTime: string;
};

const PlayButton: React.FC<PlayButtonProps> = ({ endTime, startTime }) => {
  const [isPlaying, setIsPlaying] = useGlobalState("isPlaying");
  const [, setSelectedISOTime] = useGlobalState("selectedISOTime");
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
