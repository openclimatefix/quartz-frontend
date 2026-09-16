import { useEffect, useMemo } from "react";
import useGlobalState, { getCursorCadenceMinutes } from "../helpers/globalState";
import { addMinutesToISODate } from "../helpers/utils";
import type { CursorRange } from "../shell/scrub-scale";

/**
 * One step, stopping at the limits rather than passing them. Compared as times: an equality
 * check on the ends let a cursor that was already past one (written by another input) keep
 * walking away from the window.
 */
const stepWithin = (current: string, minutes: number, limits?: CursorRange): string => {
  const next = addMinutesToISODate(current || "", minutes);
  if (!limits) return next;
  if (minutes < 0 && Date.parse(next) < Date.parse(limits.start)) {
    return Date.parse(current) < Date.parse(limits.start) ? current : limits.start;
  }
  if (minutes > 0 && Date.parse(next) > Date.parse(limits.end)) {
    return Date.parse(current) > Date.parse(limits.end) ? current : limits.end;
  }
  return next;
};

const leftKey = "ArrowLeft";
const rightKey = "ArrowRight";

/**
 * Left/Right walk the shared cursor one slot at a time.
 *
 * **Mount this once, from the shell — not from a pane.** It was `useHotKeyControlChart` and it
 * was called by `pv-remix-chart.tsx`, which made a chart component the owner of a shortcut that
 * drives `selectedISOTime` — global state the map, both charts and the footer scrubber all read.
 * `pages/index.tsx` swaps the chart on a comparison, so the shortcut went down with it: the
 * arrow keys worked in the forecast view and silently did nothing in the delta view, whose own
 * call sat commented out. Ownership at the wrong level, not a missing feature.
 *
 * The listener is on `document`, so it fires with nothing focused — which is how it has always
 * worked and what makes "the arrow keys move time" true everywhere on the page rather than only
 * over the chart.
 *
 * `/sites` still has no arrow keys. It is a separate cursor story and is deliberately left for
 * the sites work rather than pulled in here (Brad, 2026-08-17).
 *
 * @param limits The window the cursor may not step outside. Pass the app's cursor range
 *   (`useCursorRange`), the same one the scrub track is drawn against — see below.
 */
const useCursorHotkeys = (limits?: CursorRange) => {
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
      //   requires to step on Left/Right while focused. Without this a press would move the
      //   cursor two slots;
      // - the chart's resize handle (`[data-arrow-keys-handled]`), where all four arrows resize
      //   the panel (`use-resizable-chart-split.ts`) and Left/Right would otherwise also drag
      //   the forecast time along with them.
      //
      // Everywhere else it is unchanged: the arrows still work with nothing focused, which is
      // how they always have.
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-cursor-scrubber],[data-arrow-keys-handled]")) return;

      if (e.key === leftKey) {
        setSelectedISOTime((selectedISOTime) =>
          stepWithin(selectedISOTime, -getCursorCadenceMinutes(), limits)
        );
      } else if (e.key === rightKey) {
        setSelectedISOTime((selectedISOTime) =>
          stepWithin(selectedISOTime, getCursorCadenceMinutes(), limits)
        );
      }
    },
    [limits, setSelectedISOTime]
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
};
export default useCursorHotkeys;
