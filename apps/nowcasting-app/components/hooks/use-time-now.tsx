import { useEffect } from "react";
import useGlobalState, { get30MinNow } from "../globalState";
import { addMinutesToISODate } from "../utils";

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

export default useTimeNow;
