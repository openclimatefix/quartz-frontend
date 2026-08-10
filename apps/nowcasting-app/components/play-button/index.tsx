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
  const [view] = useGlobalState("view");
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

  // Pause when tab changes
  useEffect(() => {
    pause();
  }, [view]);

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
