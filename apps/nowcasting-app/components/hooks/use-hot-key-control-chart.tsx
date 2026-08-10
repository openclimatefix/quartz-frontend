import { useEffect, useMemo } from "react";
import useGlobalState, { getCursorCadenceMinutes } from "../helpers/globalState";
import { addMinutesToISODate, formatISODateString } from "../helpers/utils";

const leftKey = "ArrowLeft";
const rightKey = "ArrowRight";
const useHotKeyControlChart = (limits?: { start: string; end: string }) => {
  const [, setSelectedISOTime] = useGlobalState("selectedISOTime");
  // Arrow keys walk the cursor one slot at a time, on its own grid — read inside the handler
  // so enabling a country mid-session changes the stride without re-binding the listener.
  const handleKeyDown = useMemo(
    () => (e: KeyboardEvent) => {
      if (e.key === leftKey) {
        setSelectedISOTime((selectedISOTime) => {
          if (
            formatISODateString(selectedISOTime || "") === formatISODateString(limits?.start || "")
          )
            return selectedISOTime;
          return addMinutesToISODate(selectedISOTime || "", -getCursorCadenceMinutes());
        });
      } else if (e.key === rightKey) {
        setSelectedISOTime((selectedISOTime) => {
          if (formatISODateString(selectedISOTime || "") === formatISODateString(limits?.end || ""))
            return selectedISOTime;
          return addMinutesToISODate(selectedISOTime || "", getCursorCadenceMinutes());
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
