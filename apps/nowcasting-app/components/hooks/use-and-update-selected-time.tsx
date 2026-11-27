import { useEffect } from "react";
import useGlobalState, {
  getCursorNow,
  getGlobalState,
  setGlobalState
} from "../helpers/globalState";

const intervals = (() => getGlobalState("intervals"))();
const setIntervals = (newIntervals: any[]) => setGlobalState("intervals", newIntervals);
const setSelectedISOTime = (newTime: string) => setGlobalState("selectedISOTime", newTime);
// An expired trial cannot see live, so its cursor sits 30 min back, on the last period it sees.
const liveCursor = () => getCursorNow(getGlobalState("trialExpiredAt") ? -30 : 0);
const clearIntervals = () => {
  console.log("clearing intervals");
  getGlobalState("intervals").forEach((i) => {
    console.log("clearing interval", i);
    clearInterval(i);
  });
  console.log("cleared intervals");
  setIntervals([]);
  console.log("set intervals to empty");
};
const startNewInterval = () => {
  const newInterval = setInterval(() => {
    console.log("checking for new time");
    setSelectedISOTime(liveCursor());
  }, 1000 * 60);
  console.log("starting new interval: ", newInterval);
  setIntervals([...intervals, newInterval]);
};
const useAndUpdateSelectedTime = () => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const [trialExpiredAt] = useGlobalState("trialExpiredAt");
  useEffect(() => {
    if (trialExpiredAt && getGlobalState("intervals").length > 0) {
      setSelectedISOTime(liveCursor());
    }
  }, [trialExpiredAt]);
  useEffect(() => {
    if (intervals.length < 1) {
      startNewInterval();
    }
    return () => {
      clearIntervals();
    };
  }, []);
  return selectedISOTime;
};
export const useStopAndResetTime = () => {
  const [, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const stopTime = () => {
    console.log("stopping time");
    clearIntervals();
  };
  const resetTime = () => {
    console.log("restarting time");
    clearIntervals();
    setSelectedISOTime(liveCursor());
    startNewInterval();
  };
  return { stopTime, resetTime };
};

export default useAndUpdateSelectedTime;
