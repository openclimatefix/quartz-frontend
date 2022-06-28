import { useEffect } from "react";
import useGlobalState, { get30MinNow, getFloor30MinNow } from "../globalState";
import addMinutesToISODate from "../utils";

const useTimeNow = () => {
  // This get the Time now, but rounded up to the nearest 30 minutes.
  // TODO add return type.
  const [timeNow, setTimeNow] = useGlobalState("timeNow");
  useEffect(() => {
    const interval = setInterval(() => {
      const time30MinNow = get30MinNow();
      setTimeNow(time30MinNow);
    }, 1000 * 60);
    return () => {
      clearInterval(interval);
    };
  }, []);
  return timeNow;
};

const useFloorTimeNow = () => {
  // This get the Time now, but rounded down to the nearest 30 minutes.
  // TODO add return type.
  const [timeNow, ] = useGlobalState("timeNow");

  timeNow = addMinutesToISODate(timeNow,-30)
  return timeNow;
};

export default useTimeNow;
