import { useSyncExternalStore } from "react";

/**
 * SPIKE — where the scrub chrome is mounted. Not a shipping feature; delete with the branch.
 *
 * Dan's request is to fold the time slider into the chart card, so that the chart owns its own
 * x-axis control the way a chart usually does. The argument against is that the cursor is not
 * the chart's — the map reads it too, and so does every country row in the footer — so this
 * exists to make both readings visible rather than argued about: `?scrub=chart` mounts the
 * footer inside the chart panel, anything else leaves it where it is.
 *
 * **Read during render, not in an effect.** The first version read it in a `useEffect`, which
 * meant every load rendered the shell footer once and then unmounted it — and Mapbox does not
 * notice its container growing, so the map kept the canvas it was sized for and left a footer's
 * worth of empty ground along the bottom edge for the rest of the session. A flag that changes
 * the layout cannot arrive a frame late. The page is `ClientOnly` (see `client-only.tsx`), so
 * there is no server render to disagree with; `useSyncExternalStore`'s server snapshot is
 * supplied anyway, so the hook stays correct if that ever changes.
 *
 * The map now also observes its own container (`map.tsx`), which is the general fix — this one
 * only stops the specific reflow.
 */
export type ScrubPlacement = "shell" | "chart";

const read = (): ScrubPlacement =>
  new URLSearchParams(window.location.search).get("scrub") === "chart" ? "chart" : "shell";

const subscribe = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
};

export function useScrubPlacement(): ScrubPlacement {
  return useSyncExternalStore(subscribe, read, () => "shell" as const);
}

/**
 * The floor the in-chart placement puts under the chart's width.
 *
 * Measured from what the row actually contains, left to right: the zone stack's fixed cells
 * (20px code + 6px gap + 72px span = 98px), the play button (28px), two 12px row gaps, the
 * track's own `min-w-[140px]`, and the card's 16px of horizontal padding either side. That
 * comes to 322px — one pixel over `MIN_CHART_WIDTH_PX`, and at that width the axis has 140px
 * to draw two days in, which `selectAxisTicks` answers by dropping to `midnight-only`.
 *
 * 460px is the width at which the axis can still hold `midday-midnight` across a two-day
 * window (~55px per gap, per `lib/time/ticks.ts`'s ladder). That is the honest minimum for the
 * control to still be a control, and it is 140px of chart width bought by a row that does not
 * belong to the chart — which is the finding, not a number to tune.
 */
export const SCRUB_IN_CHART_MIN_WIDTH_PX = 460;
