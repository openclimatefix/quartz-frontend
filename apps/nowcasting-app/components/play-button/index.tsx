import React, { useRef, useState } from "react";
import useGlobalState from "../globalState";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import { formatISODateString } from "../utils";
import Ui from "./ui";

type PlatButtonProps = {
  endTime: string;
  startTime: string;
};
const add30Minutes = (date: string) => {
  var d = new Date(date);
  d.setMinutes(d.getMinutes() + 30);
  return d.toISOString();
};
const PlatButton: React.FC<PlatButtonProps> = ({ endTime, startTime }) => {
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
        return add30Minutes(selectedISOTime || "");
      });
    }, 2000);
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

export default PlatButton;
