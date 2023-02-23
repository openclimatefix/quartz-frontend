import { useEffect } from "react";
import useGlobalState, {
  get30MinNow,
  getGlobalState,
  setGlobalState
} from "../helpers/globalState";

const intervals = (() => getGlobalState("intervals"))();
const setIntervals = (newIntervals: any[]) => setGlobalState("intervals", newIntervals);
const setSelectedISOTime = (newTime: string) => setGlobalState("selectedISOTime", newTime);
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
  setIntervals([
    ...intervals,
    setInterval(() => {
      console.log("checking for new time");
      const time30MinNow = get30MinNow();
      setSelectedISOTime(time30MinNow);
    }, 1000 * 60)
  ]);
};
const useAndUpdateSelectedTime = () => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");
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
    setSelectedISOTime(get30MinNow());
    startNewInterval();
  };
  return { stopTime, resetTime };
};

export default useAndUpdateSelectedTime;
