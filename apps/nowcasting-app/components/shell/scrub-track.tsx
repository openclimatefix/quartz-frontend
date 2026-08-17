import { FC, KeyboardEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";

import useGlobalState from "../helpers/globalState";
import { useFocusedCountry } from "../../hooks/data";
import { cursorCadenceMinutes, slotForInstant } from "../../lib/time/cursor";
import {
  middayInstants,
  midnightInstants,
  selectAxisTicks,
  TickDensity
} from "../../lib/time/ticks";
import { DEFAULT_LOCALE, formatISODateStringAsZonedTime } from "../helpers/utils";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import useCursorRange from "./use-cursor-range";
import {
  clampToScale,
  fractionForClientX,
  fractionForInstant,
  fractionForMs,
  instantForFraction,
  instantForSlotIndex,
  scrubScale,
  slotIndexOf,
  slotsPerMinutes,
  type DaylightWindow,
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
 *
 * **Track O adds three more layers to the strip**, ranked deliberately so the whole thing does
 * not turn to mud: NOW (strongest) > the handle > midnight hairlines > midday ticks >
 * past/future contrast > daylight shading (softest, bottom). Later siblings paint over earlier
 * ones with no `z-index`, so **paint order below is the hierarchy, read top to bottom of the
 * JSX**:
 *
 * 1. daylight shading — the focused country's forecast-is-positive windows, from
 *    `useCursorRange`'s `daylight` (no separate request, no astronomical calculation);
 * 2. the past/future line — unchanged from before this track, a contrast on the one strip
 *    rather than a second fill;
 * 3. midnight hairlines — `midnightInstants`, independent of whatever tick density
 *    `TrackTicks` has chosen below, but landing on the same calendar boundaries;
 * 3b. midday ticks — `middayInstants`, the same density-independent walk. Half a hairline's
 *    height, vertically centred and dimmer: midday divides a day, midnight separates two, and
 *    the mark says which it is without needing a label;
 * 4. the handle;
 * 5. NOW, drawn last so it is never covered.
 *
 * **The strip is 20px tall**, halved from 40px along with every offset inside it, which is what
 * sets the footer's height — nothing else in `cursor-readout.tsx`'s row is as tall. The floor is
 * the zone stack beside it (one `text-2xs` line per enabled country plus UTC), so on a
 * two-country build the track can shrink a little further before the footer stops following it.
 *
 * **The tethered reading is a sixth thing, layered between 4 and 5, and it is not part of the
 * ranked strip encodings above** — it is text riding above the strip's own box, not a mark on
 * it. It used to be a fixed position in `cursor-readout.tsx`'s row (Track N); Brad's reaction to
 * that ("doesn't click as tethered") is what moved it here. It reads `cursor` — the same
 * drag-local-or-committed value the handle derives from — so it moves at the same pointer rate
 * as the handle, with no separate state and no easing.
 */

/** PageUp/PageDown stride, in minutes — a coarse jump, in slots so it always lands on grid. */
const PAGE_MINUTES = 180;

/**
 * How close to either end of the track, as a fraction, before the tethered reading re-anchors
 * from centred-on-the-handle to flush against that edge. Below this the label would otherwise
 * overflow the track's own box. **Guess** — untested against a real narrow footer.
 */
const LABEL_EDGE_ANCHOR_FRACTION = 0.1;

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
  /**
   * Live is a *mode*, not a coincidence.
   *
   * `use-and-update-selected-time` keeps a 60-second interval that writes the cursor to now,
   * and `stopTime` clears it — so "following now" is exactly "that interval exists", which is
   * what `intervals` holds. The old `live` chip compared `selectedISOTime === timeNow`, an
   * equality that can be true while nothing is following: scrub away (timer stops) and then
   * scrub back onto the current slot and it claimed to be live. This reads the mode itself.
   */
  const [intervals] = useGlobalState("intervals");
  const isLive = intervals.length > 0;
  const { stopTime, resetTime } = useStopAndResetTime();
  const rangeData = useCursorRange();
  const range = rangeData?.range ?? null;
  const daylight = rangeData?.daylight;

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

  // Both memoised on the scale and the country's zone/data, never on the drag-local cursor —
  // neither layer may recompute per pointer move.
  const midnightFractions = useMemo(() => {
    if (!scale) return [];
    return midnightInstants(scale.startMs, scale.endMs, zone).map((ms) => fractionForMs(ms, scale));
  }, [scale, zone]);

  const middayFractions = useMemo(() => {
    if (!scale) return [];
    return middayInstants(scale.startMs, scale.endMs, zone).map((ms) => fractionForMs(ms, scale));
  }, [scale, zone]);

  const daylightBands = useMemo(() => {
    if (!scale || !daylight?.length) return [];
    return daylight
      .map((window: DaylightWindow) => ({
        startFraction: fractionForMs(window.startMs, scale),
        endFraction: fractionForMs(window.endMs, scale)
      }))
      .filter((band) => band.endFraction > band.startFraction);
  }, [scale, daylight]);

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
   * Left/Right are also bound on `document` by `use-cursor-hotkeys`, which stands down for
   * events originating in this control (the `data-cursor-scrubber` guard) so a press is not
   * handled twice. Owning them here is what gives the track the rest of the ARIA slider
   * keyboard (Home/End/PageUp/PageDown), and it means every key steps on the scale the handle
   * is drawn against.
   *
   * It used to carry a second justification — that the delta view had no arrow keys otherwise,
   * since the hook was mounted per chart and that view's call was commented out. That is fixed
   * at the source: the hook is mounted once by `dashboard-shell.tsx` and both views have it.
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
  //
  // "Either way" is now true, which it was not before: this used to be 3px + 16px against a live
  // track of 40px + a 20px tick row, so the footer grew by ~21px the moment a range arrived. The
  // two boxes below mirror the live layout exactly — an `h-5` strip with the resting line centred
  // in it, then an `h-5` stand-in for `TrackTicks` (its `pt-1` plus one `text-2xs`/`text-xs`
  // line). Halving the track was the moment to make the claim honest rather than re-break it.
  if (!scale || !selectedISOTime) {
    return (
      <div data-testid="scrub-track-idle">
        <div className="flex h-5 items-center">
          <div className="h-[3px] w-full rounded-sm bg-white/10" />
        </div>
        <div className="h-5" />
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

  // The tethered reading — the focused country's own reading, riding with the handle rather
  // than sitting fixed in the row. `slotForInstant`/`formatISODateStringAsZonedTime` are the
  // same resolution and formatting every other reading in the footer uses (Track B / Track N);
  // nothing here does offset arithmetic of its own. This recomputes on every pointer move
  // exactly as `cursorFraction` does — it is cheap string formatting, not a measurement, so it
  // costs nothing extra beyond the render the handle's own movement already causes.
  const focusedLocal = formatISODateStringAsZonedTime(
    slotForInstant(cursor, focusedCountry),
    zone,
    DEFAULT_LOCALE
  );
  // Centred on the handle in the middle of the track, re-anchored flush to whichever edge it is
  // near so the label clamps inside the track's box instead of overflowing or clipping.
  const labelTranslate =
    cursorFraction < LABEL_EDGE_ANCHOR_FRACTION
      ? "0%"
      : cursorFraction > 1 - LABEL_EDGE_ANCHOR_FRACTION
      ? "-100%"
      : "-50%";

  return (
    <div data-cursor-scrubber="true">
      {/* **The target is bigger than the drawing, deliberately.** The strip is 20px tall (halved
          from 40px, along with every offset inside it, so it is the same drawing at half scale
          rather than the same marks in a shorter box). But the whole strip is what you grab —
          `onPointerDown` is here, not on the handle — and a 20px-tall target fails WCAG 2.2
          SC 2.5.8, which asks for 24×24 CSS px. So the interactive box is this element, padded
          to 28px, and the painted box is the child below at 20px.

          The padding has to live on a wrapper rather than on the strip itself: absolutely
          positioned children resolve against the *padding* box, so padding here would stretch
          the `inset-y-0` bands and NOW's `h-full` back to 28px and undo the halving.

          Nothing about the drag maths cares — `instantAt` reads `getBoundingClientRect()` for x
          only, and `trackRef` stays on the painted strip, whose width is identical. */}
      <div
        role="slider"
        tabIndex={0}
        aria-label={`Time cursor, ${cadenceMinutes}-minute steps`}
        aria-valuemin={0}
        aria-valuemax={scale.slotCount}
        aria-valuenow={slotIndexOf(cursor, scale)}
        aria-valuetext={`${cursorLabel} ${zone}`}
        aria-orientation="horizontal"
        className="group cursor-ew-resize touch-none select-none py-1 outline-none"
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
        <div
          ref={trackRef}
          // The focus ring belongs on the drawing, not the padded hit box — focus should outline
          // the strip the user sees, so it is driven from the focusable parent via `group`.
          className="relative h-5 group-focus-visible:ring-1 group-focus-visible:ring-ocf-yellow"
        >
          {/* Layer 1 (softest, bottom): daylight — the focused country's forecast > 0 windows. */}
          {daylightBands.map((band) => (
            <div
              key={`${band.startFraction}-${band.endFraction}`}
              className="pointer-events-none absolute inset-y-0 bg-ocf-yellow/[0.14]"
              style={{
                left: `${band.startFraction * 100}%`,
                width: `${(band.endFraction - band.startFraction) * 100}%`
              }}
            />
          ))}
          {/* Layer 2: past (observed + forecast) versus future (forecast only). A background
            wash across the strip's height rather than a brighter track line — the line version
            was louder than the daylight ground it was supposed to sit above, which inverted the
            hierarchy. The line itself is now one neutral baseline the whole way across. */}
          {nowFraction !== null && (
            <div
              className="pointer-events-none absolute inset-y-0 left-0 bg-white/[0.05]"
              style={{ width: `${nowFraction * 100}%` }}
            />
          )}
          <div className="pointer-events-none absolute inset-x-0 top-[9px] h-[2px] rounded-sm bg-white/15" />
          {/* Layer 3: midnight hairlines — hard calendar edges, agreeing with `TrackTicks`' own
            midnight labels regardless of which tick density it has chosen. Full height less a
            2px inset top and bottom. */}
          {midnightFractions.map((fraction) => (
            <div
              key={fraction}
              className="pointer-events-none absolute top-0.5 h-4 w-px bg-white/20"
              style={{ left: `${fraction * 100}%` }}
            />
          ))}
          {/* Layer 3b: midday. Half a midnight hairline's height and vertically centred, because
            midday *divides* a day where midnight *separates* two — a lesser boundary, drawn as
            a lesser mark. Dimmer as well as shorter (`white/10` against midnight's `white/20`),
            so it stays below midnight in the strip's ranked hierarchy on both counts and cannot
            be mistaken for a calendar edge at a glance. It reads as a centred tick on the
            baseline rather than a rule crossing the whole strip. */}
          {middayFractions.map((fraction) => (
            <div
              key={fraction}
              className="pointer-events-none absolute top-1.5 h-2 w-px bg-white/10"
              style={{ left: `${fraction * 100}%` }}
            />
          ))}
          {/* Layer 4: the handle. */}
          <div
            // Wider, rounded and ringed rather than a hairline rule: it is a control, and it was
            // reading as one more vertical line among the midnight hairlines and the now mark.
            className="pointer-events-none absolute top-[3px] h-3.5 w-[6px] -translate-x-1/2 rounded-full bg-ocf-yellow shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
            style={{ left: `${cursorFraction * 100}%` }}
          />
          {/* The tethered reading: the focused country's own time, riding with the handle. Not
            part of the five-layer strip hierarchy above (it sits above the strip's own box,
            not on it) but drawn before NOW so NOW's mark is never covered by it. No transition
            — it must track the handle exactly, pointer-rate, with no lag or smoothing. */}
          <div
            // `items-center`, not `items-baseline`: the country code is `text-2xs` and the time
            // larger, so baseline alignment sat them on a shared baseline with visibly different
            // cap heights and left the tag looking tilted. Centring aligns what the eye reads.
            className="pointer-events-none absolute -top-6 flex items-center gap-1 whitespace-nowrap rounded border border-white/10 bg-mapbox-black-700 px-1.5 py-0.5 tabular-nums shadow-lg"
            style={{ left: `${cursorFraction * 100}%`, transform: `translateX(${labelTranslate})` }}
          >
            <span className="text-2xs font-bold uppercase tracking-wider text-ocf-yellow">
              {focusedCountry}
            </span>
            <span className="text-xs font-semibold leading-none text-white">{focusedLocal}</span>
            {/* The live dot: state, on the thing that moves. Orange rather than red because red
              is not in this palette and would read as an alert; small and never a fill, for the
              same reason. `motion-safe` so a slow pulse does not become a permanently animating
              element for anyone who has asked the OS for less motion — they get a static dot,
              which says the same thing. */}
            {isLive && (
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 self-center rounded-full bg-ocf-orange motion-safe:animate-pulse"
              />
            )}
          </div>
          {/* Layer 5 (strongest, top): NOW — full-height, drawn last so nothing covers it. */}
          {/* Layer 5 (strongest, top): NOW — and the one control that takes you back to it.
            The *action* is here rather than on the tethered tag because the tag moves: a "take
            me back to now" button that sits wherever your handle happens to be is a target you
            have to hunt for. This one is always in the same place. Bright while following,
            dimmed while adrift — which is also the only honest reading of the mode. */}
          {nowFraction !== null && (
            <div
              className="absolute top-0 h-full w-px bg-white"
              style={{ left: `${nowFraction * 100}%` }}
            >
              {/* Only while adrift. The label is a *destination* — "there is a place to get back
                to" — which says nothing when you are already there, and that is exactly when it
                sits on top of the handle and hides the one thing you would want to grab. It
                comes back the moment you scrub away, which is when it starts being useful. */}
              {!isLive && (
                <button
                  type="button"
                  // The track owns pointerdown for scrubbing; without this, pressing the button
                  // would also begin a drag and the click would land somewhere else entirely.
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={resetTime}
                  title={
                    isLive
                      ? "The cursor is following now"
                      : "Return to now and follow it as it advances"
                  }
                  aria-label={isLive ? "Following now" : "Return to now"}
                  aria-pressed={isLive}
                  // Centred *on* the line, not offset to one side of it. Offset, it read as
                  // labelling whichever half of the strip it sat in rather than the rule itself —
                  // and it is the rule it names. Inside the strip rather than below, where it
                  // collided with the tick labels and took their baseline.
                  //
                  // Called "now" and not "live": the mark is a *place*, and clicking it means
                  // "take me there". Whether the cursor is *following* that place is a mode, and
                  // the orange dot on the tethered tag is what says so — one label cannot honestly
                  // do both jobs, which is what this one was trying to do.
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-black/70 px-1 py-px text-[9px] font-semibold uppercase leading-none tracking-wider transition-colors ${
                    isLive
                      ? "text-white"
                      : "text-white/50 hover:bg-black/80 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50"
                  }`}
                >
                  now
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <TrackTicks scale={scale} zone={zone} />
    </div>
  );
};

export default ScrubTrack;
