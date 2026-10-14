import { useEffect } from "react";
import useGlobalState, {
  get30MinNow,
  getGlobalState,
  setGlobalState
} from "../helpers/globalState";

const useAndUpdateSelectedTime = () => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  useEffect(() => {
    // This is the single clock for the page.  It remains active while a user is
    // inspecting another timestamp, so every consumer agrees on what "now" is.
    const interval = setInterval(() => {
      const timeNow = get30MinNow();
      setGlobalState("timeNow", timeNow);
      if (getGlobalState("isFollowingNow")) {
        setGlobalState("selectedISOTime", timeNow);
      }
    }, 1000 * 60);
    return () => {
      clearInterval(interval);
    };
  }, []);
  return selectedISOTime;
};
export const useStopAndResetTime = () => {
  const stopTime = () => {
    setGlobalState("isFollowingNow", false);
  };
  const resetTime = () => {
    const timeNow = get30MinNow();
    setGlobalState("timeNow", timeNow);
    setGlobalState("selectedISOTime", timeNow);
    setGlobalState("isFollowingNow", true);
  };
  return { stopTime, resetTime };
};

export default useAndUpdateSelectedTime;
