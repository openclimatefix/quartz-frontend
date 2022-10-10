import { useEffect, useMemo } from "react";
import useGlobalState from "../helpers/globalState";
import { addMinutesToISODate, formatISODateString } from "../helpers/utils";

const leftKey = "ArrowLeft";
const rightKey = "ArrowRight";
const useHotKeyControlChart = (limits?: { start: string; end: string }) => {
  const [, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const handleKeyDown = useMemo(
    () => (e: KeyboardEvent) => {
      if (e.key === leftKey) {
        setSelectedISOTime((selectedISOTime) => {
          if (
            formatISODateString(selectedISOTime || "") === formatISODateString(limits?.start || "")
          )
            return selectedISOTime;
          return addMinutesToISODate(selectedISOTime || "", -30);
        });
      } else if (e.key === rightKey) {
        setSelectedISOTime((selectedISOTime) => {
          if (formatISODateString(selectedISOTime || "") === formatISODateString(limits?.end || ""))
            return selectedISOTime;
          return addMinutesToISODate(selectedISOTime || "", 30);
        });
      }
    },
    [limits]
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
};
export default useHotKeyControlChart;
