import { useEffect } from "react";
import useGlobalState, { get30MinNow } from "../helpers/globalState";

let intervals: any[] = [];
const clearIntervals = () => {
  intervals.forEach((i) => clearInterval(i));
};
const useAndUpdateSelectedTime = () => {
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  useEffect(() => {
    intervals.push(
      setInterval(() => {
        const time30MinNow = get30MinNow();
        setSelectedISOTime(time30MinNow);
      }, 1000 * 60)
    );
    return () => {
      clearIntervals();
    };
  }, []);
  return selectedISOTime;
};
export const useStopAndResetTime = () => {
  const [, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const stopTime = clearIntervals;
  const resetTime = () => {
    clearIntervals();
    setSelectedISOTime(get30MinNow());
    intervals.push(
      setInterval(() => {
        const time30MinNow = get30MinNow();
        setSelectedISOTime(time30MinNow);
      }, 1000 * 60)
    );
  };
  return { stopTime, resetTime };
};

export default useAndUpdateSelectedTime;
