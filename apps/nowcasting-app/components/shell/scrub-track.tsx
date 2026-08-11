import { FC, KeyboardEvent, PointerEvent, useEffect, useMemo, useRef } from "react";
import { DateTime } from "luxon";

import useGlobalState from "../helpers/globalState";
import { useEnabledCountries } from "../../hooks/data";
import { finestCadenceMinutes } from "../../lib/time/cursor";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import useCursorRange from "./use-cursor-range";
import {
  clampToScale,
  fractionForClientX,
  fractionForInstant,
  instantForFraction,
  instantForSlotIndex,
  scrubScale,
  slotIndexOf,
  slotsPerMinutes,
  type ScrubScale
} from "./scrub-scale";

/**
 * The footer's scrub track — the cursor's fourth input.
 *
 * Contract §4 makes the cursor shell chrome; Track D built the readout and deferred the track,
 * on the grounds that a scrub bar is a new interaction rather than a move. Brad asked for the
 * interaction during the live pass, so here it is.
 *
 * **This is not a slider, because time here is not a continuum.** The cursor steps on the
 * finest *enabled* country's grid (§4), which is 30 minutes with only GB on and 15 with NL
 * alongside it, and every position it can occupy is a real published instant for at least one
 * country. So the track is a grid the pointer picks a cell of, not a range input:
 *
 * - **it snaps with Track B's `snapToCadence`**, the same ceiling every other input uses.
 *   Nothing here rounds. Timestamps label the *end* of their period, so "nearest" — the natural
 *   reflex for a slider — is wrong by up to half a period and looks completely plausible;
 * - **the grain is re-read on every render and kept in a ref**, so enabling or disabling a
 *   country changes the step under a drag in progress rather than at the next pointer-down.
 *   Re-snapping the cursor itself is `globalState`'s job (`resnapCursorToGrid`) and is not
 *   duplicated here;
 * - **the window is the one the app already shows** (`useCursorRange`), not a new one.
 *
 * It stays in sync with the other three inputs by construction: the handle's position is
 * derived from `selectedISOTime` on every render, and the chart click, the arrow keys and the
 * play button all write that. There is no local position state to fall out of step, which is
 * why the handle follows playback without knowing playback exists.
 *
 * **"Now" is marked** because the cursor sitting in the past and the cursor sitting in the
 * forecast mean different things, and on a track that is mostly forecast there is otherwise no
 * way to tell which side you are on. The past is drawn filled; the future is not.
 */

/** How many labels along the axis. Five gives a mark per ~12h over the ~72h window. */
const TICK_COUNT = 5;

/** PageUp/PageDown stride, in minutes — a coarse jump, in slots so it always lands on grid. */
const PAGE_MINUTES = 180;

const TrackTicks: FC<{ scale: ScrubScale; zone: string }> = ({ scale, zone }) => {
  const ticks = useMemo(() => {
    const span = scale.endMs - scale.startMs;
    let previousDay = "";
    return Array.from({ length: TICK_COUNT }, (_, index) => {
      const dt = DateTime.fromMillis(scale.startMs + (index / (TICK_COUNT - 1)) * span, {
        zone
      });
      const day = dt.toFormat("yyyy-LL-dd");
      // The window is ~three days long, so bare times repeat and a reader cannot place them.
      // Name the day only when it changes — including on the first mark, which anchors the rest.
      const showDay = day !== previousDay;
      previousDay = day;
      return {
        key: day + dt.toFormat("HHmm"),
        label: dt.toFormat(showDay ? "ccc HH:mm" : "HH:mm")
      };
    });
  }, [scale.startMs, scale.endMs, zone]);

  return (
    <div aria-hidden="true" className="flex justify-between pt-1">
      {ticks.map((tick) => (
        <span key={tick.key} className="text-2xs tabular-nums text-ocf-gray-600">
          {tick.label}
        </span>
      ))}
    </div>
  );
};

const ScrubTrack: FC<{ zone?: string }> = ({ zone = "UTC" }) => {
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [timeNow] = useGlobalState("timeNow");
  const enabledCountries = useEnabledCountries();
  const { stopTime } = useStopAndResetTime();
  const range = useCursorRange();

  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const scaleRef = useRef<ScrubScale | null>(null);

  const cadenceMinutes = finestCadenceMinutes(enabledCountries);
  const scale = useMemo(() => scrubScale(range, cadenceMinutes), [range, cadenceMinutes]);

  // The pointer handlers close over this ref rather than over `scale`, so a grain change
  // mid-drag takes effect on the next pointermove instead of on the next pointerdown.
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Writing the cursor from a pointer position. `stopTime` is what the chart click does too:
  // any deliberate cursor input stops the minute timer (and the play button's own interval
  // clears when it is paused), so a scrub is not overwritten a moment later by "now".
  const writeFromPointer = (clientX: number) => {
    const current = scaleRef.current;
    const element = trackRef.current;
    if (!current || !element) return;
    const rect = element.getBoundingClientRect();
    setSelectedISOTime(instantForFraction(fractionForClientX(clientX, rect), current));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!scale || event.button !== 0) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    stopTime();
    writeFromPointer(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    writeFromPointer(event.clientX);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  /**
   * The full ARIA slider keyboard, owned here while the track has focus.
   *
   * Left/Right are also bound on `document` by `use-hot-key-control-chart`, which stands down
   * for events originating in this control (the `data-cursor-scrubber` guard) so a press is not
   * handled twice. Owning them here rather than leaving them to that hook is what gives the
   * *delta* view arrow keys at all — its own call to the hook is commented out — and it means
   * every key steps on the scale the handle is drawn against, so the ends agree.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = scale;
    if (!current || !selectedISOTime) return;
    const index = slotIndexOf(selectedISOTime, current);
    const page = slotsPerMinutes(PAGE_MINUTES, current);

    const target = (() => {
      switch (event.key) {
        case "ArrowLeft":
        case "ArrowDown":
          return index - 1;
        case "ArrowRight":
        case "ArrowUp":
          return index + 1;
        case "Home":
          return 0;
        case "End":
          return current.slotCount;
        case "PageDown":
          return index - page;
        case "PageUp":
          return index + page;
        default:
          return null;
      }
    })();

    if (target === null) return;
    event.preventDefault();
    stopTime();
    setSelectedISOTime(instantForSlotIndex(target, current));
  };

  // An inert track while the window is unknown. Drawing a handle over a guessed horizon would
  // be a scrubber that is wrong rather than absent, and the footer keeps its height either way.
  if (!scale || !selectedISOTime) {
    return (
      <div className="px-4 pb-2" data-testid="scrub-track-idle">
        <div className="h-[3px] w-full rounded-sm bg-white/10" />
        <div className="h-4" />
      </div>
    );
  }

  const cursor = clampToScale(selectedISOTime, scale);
  const cursorFraction = fractionForInstant(cursor, scale);
  const nowFraction = timeNow ? fractionForInstant(timeNow, scale) : null;
  const cursorLabel = DateTime.fromISO(cursor, { zone: "utc" })
    .setZone(zone)
    .toFormat("ccc d LLL HH:mm");

  return (
    <div className="px-4 pb-2" data-cursor-scrubber="true">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={`Time cursor, ${cadenceMinutes}-minute steps`}
        aria-valuemin={0}
        aria-valuemax={scale.slotCount}
        aria-valuenow={slotIndexOf(cursor, scale)}
        aria-valuetext={`${cursorLabel} ${zone}`}
        aria-orientation="horizontal"
        className="relative h-7 cursor-ew-resize touch-none select-none outline-none focus-visible:ring-1 focus-visible:ring-ocf-yellow"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        {/* The window. */}
        <div className="pointer-events-none absolute inset-x-0 top-3 h-[3px] rounded-sm bg-white/10" />
        {/* Everything already observed, so the cursor's side of "now" is readable at a glance. */}
        {nowFraction !== null && (
          <div
            className="pointer-events-none absolute left-0 top-3 h-[3px] rounded-sm bg-white/25"
            style={{ width: `${nowFraction * 100}%` }}
          />
        )}
        {nowFraction !== null && (
          <div
            className="pointer-events-none absolute top-1.5 h-4 w-px bg-ocf-gray-600"
            style={{ left: `${nowFraction * 100}%` }}
          >
            <span className="absolute -top-[9px] left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-wider text-ocf-gray-600">
              now
            </span>
          </div>
        )}
        <div
          className="pointer-events-none absolute top-2 h-[15px] w-[3px] -translate-x-[1px] rounded-sm bg-ocf-yellow"
          style={{ left: `${cursorFraction * 100}%` }}
        />
      </div>
      <TrackTicks scale={scale} zone={zone} />
    </div>
  );
};

export default ScrubTrack;
