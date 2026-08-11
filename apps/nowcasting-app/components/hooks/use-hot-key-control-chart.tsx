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
      // The footer's scrub track is a `role="slider"`, so ARIA requires it to step on Left and
      // Right while focused — and it must, since this hook's only caller is the forecast chart
      // and the delta view's call is commented out, leaving that view with no arrow keys at
      // all. The track therefore handles the arrows itself when it has focus. This listener is
      // on `document` and would otherwise also fire, moving the cursor two slots per press, so
      // it stands down for events originating inside the track. Everywhere else it is
      // unchanged: the arrows still work with nothing focused, which is how they always have.
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-cursor-scrubber]")) return;

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
