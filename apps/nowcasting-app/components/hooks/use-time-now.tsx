import { useEffect } from "react";
import useGlobalState, { get30MinNow } from "../globalState";

const useTimeNow = () => {
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
