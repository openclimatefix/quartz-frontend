import { FC, KeyboardEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";

import useGlobalState from "../helpers/globalState";
import { useFocusedCountry } from "../../hooks/data";
import { cursorCadenceMinutes } from "../../lib/time/cursor";
import { selectAxisTicks, TickDensity } from "../../lib/time/ticks";
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
 * **At rest it stays in sync with the other three inputs by construction**: the handle's
 * position is derived from `selectedISOTime`, and the chart click, the arrow keys and the play
 * button all write that. There is no position state to fall out of step, which is why the
 * handle follows playback without knowing playback exists.
 *
 * **During a drag that same property is what made it janky**, and the drag model below is the
 * fix. Writing the cursor is a global commit: every distinct value rebuilds the map's feature
 * states across all enabled countries and recomputes both charts, so a handle derived only from
 * the committed value moves at the app's re-render rate rather than the pointer's.
 *
 * So a drag runs at **two rates**: the handle renders from drag-local state on every pointer
 * event, in a render confined to this component, while the shared cursor is committed at most
 * once per animation frame. Both carry the same snapped instant — the local one is not a
 * different value, only an earlier one. See `dragInstant` and `scheduleCommit` below.
 *
 * **"Now" is marked** because the cursor sitting in the past and the cursor sitting in the
 * forecast mean different things, and on a track that is mostly forecast there is otherwise no
 * way to tell which side you are on. The past is drawn filled; the future is not.
 */

/** PageUp/PageDown stride, in minutes — a coarse jump, in slots so it always lands on grid. */
const PAGE_MINUTES = 180;

/**
 * The track's own tick labels — 6-hourly (00:00/06:00/12:00/18:00) when there is room,
 * midnight/midday only when there is not. `lib/time/ticks.ts` owns the rule and the hysteresis
 * that keeps a resize from relabelling every frame; this component only measures its own width
 * and asks for instants in the country's zone.
 *
 * `previousDensityRef` is a plain ref, not state: the density is a derived value with nowhere
 * else it needs to live, and reading it during render (then writing it back) is one render
 * cheaper than round-tripping it through `useState` for the same result.
 */
const TrackTicks: FC<{ scale: ScrubScale; zone: string }> = ({ scale, zone }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [widthPx, setWidthPx] = useState(0);
  const previousDensityRef = useRef<TickDensity | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setWidthPx(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const ticks = useMemo(() => {
    const selection = selectAxisTicks({
      startMs: scale.startMs,
      endMs: scale.endMs,
      zone,
      widthPx,
      previousDensity: previousDensityRef.current
    });
    previousDensityRef.current = selection.density;

    let previousDay = "";
    return selection.ticks.map((ms) => {
      const dt = DateTime.fromMillis(ms, { zone });
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
  }, [scale.startMs, scale.endMs, zone, widthPx]);

  return (
    <div ref={containerRef} aria-hidden="true" className="flex justify-between pt-1">
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
  const [isPlaying, setIsPlaying] = useGlobalState("isPlaying");
  const focusedCountry = useFocusedCountry();
  const { stopTime } = useStopAndResetTime();
  const range = useCursorRange();

  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const scaleRef = useRef<ScrubScale | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<string | null>(null);

  /**
   * The handle's position **while a drag is in progress**, and at no other time.
   *
   * Strictly drag-scoped: set on pointerdown, dropped on release, `null` the rest of the time,
   * and the render below falls back to `selectedISOTime` whenever it is `null`. So this is not
   * a second source of truth that outlives the gesture — at rest the at-rest design is exactly
   * as it was.
   *
   * It is also not a *different* value from the committed one. It holds the same snapped
   * instant the commit will carry, just sooner, which is what makes the handoff on release
   * incapable of flashing: dropping the local value and committing the final one land in the
   * same batch and name the same instant.
   */
  const [dragInstant, setDragInstant] = useState<string | null>(null);

  const cadenceMinutes = cursorCadenceMinutes(focusedCountry);
  const scale = useMemo(() => scrubScale(range, cadenceMinutes), [range, cadenceMinutes]);

  // The pointer handlers close over this ref rather than over `scale`, so a grain change
  // mid-drag takes effect on the next pointermove instead of on the next pointerdown.
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  const cancelPendingCommit = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    pendingRef.current = null;
  };

  // A drag that is torn down mid-gesture must not leave a frame pointing at a dead component.
  useEffect(() => cancelPendingCommit, []);

  /**
   * Commit at most once per animation frame, always the latest position.
   *
   * `pendingRef` is overwritten rather than queued, and a frame is only requested when one is
   * not already outstanding, so a fast drag produces one commit per frame and never a backlog
   * of frames replaying stale positions after the finger has stopped.
   */
  const flushCommit = () => {
    frameRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending !== null) setSelectedISOTime(pending);
  };

  const scheduleCommit = (instant: string) => {
    pendingRef.current = instant;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(flushCommit);
  };

  /** The snapped instant under a pointer, or `null` if the track cannot be measured yet. */
  const instantAt = (clientX: number): string | null => {
    const current = scaleRef.current;
    const element = trackRef.current;
    if (!current || !element) return null;
    return instantForFraction(
      fractionForClientX(clientX, element.getBoundingClientRect()),
      current
    );
  };

  /**
   * What any deliberate cursor input has to do before it writes.
   *
   * `stopTime` clears the minute timer, as the chart click does, so a scrub into the past is
   * not overwritten by "now" within the minute. Clearing `isPlaying` is the other half and was
   * missing: the play button's interval lives in a ref of its own and is **not** one of the
   * globals `stopTime` clears, so it kept stepping the cursor once a second underneath a drag,
   * fighting it. Writing the shared flag pauses it through the button's own effect rather than
   * reaching into the component.
   */
  const beginUserInput = () => {
    stopTime();
    if (isPlaying) setIsPlaying(false);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!scale || event.button !== 0) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    beginUserInput();

    // A press is a click as much as the start of a drag, so it commits at once rather than
    // waiting a frame — the map should react to a tap with no perceptible delay.
    const instant = instantAt(event.clientX);
    if (instant === null) return;
    cancelPendingCommit();
    setDragInstant(instant);
    setSelectedISOTime(instant);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const instant = instantAt(event.clientX);
    if (instant === null) return;
    // Two different rates, deliberately. The handle moves now, in a render confined to this
    // component; the cursor the rest of the app reads is committed on the next frame.
    setDragInstant(instant);
    scheduleCommit(instant);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    // The drag always ends on its true final value, committed exactly once: take whatever the
    // last frame did not get to, cancel that frame, and write it here instead.
    const pending = pendingRef.current;
    cancelPendingCommit();
    if (pending !== null) setSelectedISOTime(pending);
    setDragInstant(null);

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
    beginUserInput();
    setSelectedISOTime(instantForSlotIndex(target, current));
  };

  // An inert track while the window is unknown. Drawing a handle over a guessed horizon would
  // be a scrubber that is wrong rather than absent, and the footer keeps its height either way.
  if (!scale || !selectedISOTime) {
    return (
      <div data-testid="scrub-track-idle">
        <div className="h-[3px] w-full rounded-sm bg-white/10" />
        <div className="h-4" />
      </div>
    );
  }

  // The drag-local value while a drag is live, the shared cursor otherwise. `dragInstant` is
  // null at rest, so at rest this line *is* the original derive-from-`selectedISOTime`.
  const cursor = clampToScale(dragInstant ?? selectedISOTime, scale);
  const cursorFraction = fractionForInstant(cursor, scale);
  const nowFraction = timeNow ? fractionForInstant(timeNow, scale) : null;
  const cursorLabel = DateTime.fromISO(cursor, { zone: "utc" })
    .setZone(zone)
    .toFormat("ccc d LLL HH:mm");

  return (
    <div data-cursor-scrubber="true">
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
        // Capture can be lost without either of the above firing — a browser-level interruption
        // mid-gesture. Without this the drag flag would stay set and the handle would be stuck
        // on its drag-local value. `endDrag` bails when no drag is live, so the ordinary
        // pointerup-then-lostpointercapture pair is idempotent rather than a double commit.
        onLostPointerCapture={endDrag}
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
