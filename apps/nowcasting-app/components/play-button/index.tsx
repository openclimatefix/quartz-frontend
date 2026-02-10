import React, { useRef, useState } from "react";
import useGlobalState from "../helpers/globalState";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import { addMinutesToISODate, formatISODateString } from "../helpers/utils";
import Ui from "./ui";

type PlayButtonProps = {
  endTime: string;
  startTime: string;
};

const PlayButton: React.FC<PlayButtonProps> = ({ endTime, startTime }) => {
  const [isPlaying, setIsPlaying] = useState(false);
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
        return addMinutesToISODate(selectedISOTime || "", 30);
      });
    }, 1000);
  };

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
