import { useEffect } from "react";
import useGlobalState, { getCursorNow } from "../helpers/globalState";
import { addMinutesToISODate } from "../helpers/utils";

const useTimeNow = () => {
  // Now, rounded up onto the cursor grid — the finest enabled country's cadence, not a fixed
  // half hour. See `lib/time/cursor.ts`.
  // TODO add return type.
  const [timeNow, setTimeNow] = useGlobalState("timeNow");
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeNow(getCursorNow());
    }, 1000 * 60);
    return () => {
      clearInterval(interval);
    };
  }, []);
  return timeNow;
};

export default useTimeNow;
