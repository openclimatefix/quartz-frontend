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
      // This listener is on `document`, so it fires no matter what has focus — including
      // controls that bind the arrow keys to something of their own. Those double up: a press
      // moves the control *and* walks the cursor. So it stands down for events originating
      // inside anything that claims the arrows for itself. Two do:
      //
      // - the footer's scrub track (`[data-cursor-scrubber]`), a `role="slider"` that ARIA
      //   requires to step on Left/Right while focused — and it must, since this hook's only
      //   caller is the forecast chart and the delta view's call is commented out, leaving that
      //   view with no arrow keys at all. Without this it would move the cursor two slots per
      //   press;
      // - the chart's resize handle (`[data-arrow-keys-handled]`), where all four arrows resize
      //   the panel (`use-resizable-chart-split.ts`) and Left/Right would otherwise also drag
      //   the forecast time along with them.
      //
      // Everywhere else it is unchanged: the arrows still work with nothing focused, which is
      // how they always have.
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-cursor-scrubber],[data-arrow-keys-handled]")) return;

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
