import { useEffect } from "react";
import useGlobalState, { get30MinNow } from "../globalState";

const useAndUpdateSelectedTime = () => {
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  useEffect(() => {
    const interval = setInterval(() => {
      const time30MinNow = get30MinNow();
      setSelectedISOTime(time30MinNow);
    }, 1000 * 60);
    return () => {
      clearInterval(interval);
    };
  }, []);
  return selectedISOTime;
};
export default useAndUpdateSelectedTime;
