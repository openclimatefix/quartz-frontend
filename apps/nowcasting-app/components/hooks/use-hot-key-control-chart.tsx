import { useEffect, useMemo } from "react";
import useGlobalState from "../globalState";
import { addMinutesToISODate } from "../utils";

const leftKey = "ArrowLeft";
const rightKey = "ArrowRight";
const useHotKeyControlChart = () => {
  const [, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const handleKeyDown = useMemo(
    () => (e: KeyboardEvent) => {
      if (e.key === leftKey) {
        setSelectedISOTime((selectedISOTime) => addMinutesToISODate(selectedISOTime || "", -30));
      } else if (e.key === rightKey) {
        setSelectedISOTime((selectedISOTime) => addMinutesToISODate(selectedISOTime || "", 30));
      }
    },
    [],
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
};
export default useHotKeyControlChart;
