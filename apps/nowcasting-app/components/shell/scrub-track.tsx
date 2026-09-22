import { FC, KeyboardEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";

import useGlobalState from "../helpers/globalState";
import { useFocusedCountry } from "../../hooks/data";
import { cursorCadenceMinutes, periodForLabel, slotForInstant } from "../../lib/time/cursor";
import {
  middayInstants,
  midnightInstants,
  quarterDayInstants,
  selectAxisTicks,
  tickLabels,
  TickDensity
} from "../../lib/time/ticks";
import { DEFAULT_LOCALE, formatISODateStringAsZonedTime } from "../helpers/utils";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import useCursorRange from "./use-cursor-range";
import ZoomFrame from "./zoom-frame";
import {
  clampToScale,
  fractionForClientX,
  fractionForInstant,
  fractionForMs,
  instantForSlotIndex,
  scrubScale,
  selectableLabelRange,
  slotIndexOf,
  slotsPerMinutes,
  type CursorRange,
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
 * 3c. 06:00/18:00 ticks — `quarterDayInstants`, midday's height and a step dimmer. Height is
 *    spent on the midnight/not-midnight distinction only; below that the daylight banding
 *    behind the marks already tells them apart.
 * 4. the handle;
 * 5. NOW, drawn last so it is never covered.
 *
 * **The strip is 20px tall**, halved from 40px along with every offset inside it. That was the
 * height of the shell footer this used to sit in, where nothing else in the row was as tall.
 * The track lives inside the chart card now (`chart-scrubber.tsx`) and the footer is gone, so
 * the height is no longer setting anyone else's — it is just the strip's own.
 *
 * **The tethered reading is a sixth thing, layered between 4 and 5, and it is not part of the
 * ranked strip encodings above** — it is text riding above the strip's own box, not a mark on
 * it. It used to be a fixed position in the shell footer's row (Track N); Brad's reaction to
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
/** A tick label whose instant is within this many px of an end is held flush to that end. */
const TICK_EDGE_ANCHOR_PX = 30;
/**
 * Room a day label ("Thu →") needs to the right of its midnight line before it is worth
 * drawing. A day label cannot re-anchor the way a time can — it is flush left *because* it
 * names the day starting there — so one too near the right edge overhangs the track instead.
 * Dropped rather than squeezed: the day it names is barely on screen anyway.
 */
const DAY_LABEL_MIN_PX = 40;

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

    // The window is ~three days long, so bare times repeat; `tickLabels` names the days.
    const labels = tickLabels(selection.ticks, zone);
    return selection.ticks.map((ms, i) => ({
      ...labels[i],
      key: ms,
      fraction: fractionForMs(ms, scale)
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale.startMs, scale.endMs, zone, widthPx]);

  // Each label centred on its instant, as the chart's axis centres its own — they were spread
  // evenly with `justify-between`, which put them nowhere near the hairlines they name. A label
  // too close to an end to centre is held flush to that end instead of overflowing it.
  return (
    <div ref={containerRef} aria-hidden="true" className="relative my-0.5 h-4">
      {ticks.map((tick) => {
        const px = tick.fraction * widthPx;
        if (tick.startsDay && widthPx - px < DAY_LABEL_MIN_PX) return null;
        // A day label starts at its midnight line; the rest centre on their instant.
        const translate =
          tick.startsDay || px < TICK_EDGE_ANCHOR_PX
            ? "0%"
            : widthPx - px < TICK_EDGE_ANCHOR_PX
            ? "-100%"
            : "-50%";
        return (
          <span
            key={tick.key}
            className={`absolute top-0 whitespace-nowrap font-mono text-2xs tabular-nums text-content-secondary ${
              tick.startsDay ? "pl-1" : ""
            }`}
            style={{ left: `${tick.fraction * 100}%`, transform: `translateX(${translate})` }}
          >
            {tick.startsDay ? (
              <>
                {tick.day}
                {/* A margin, not a space: a monospace space is a whole character wide. */}
                <span className="ml-0.5">→</span>
              </>
            ) : tick.day ? (
              `${tick.day} ${tick.time}`
            ) : (
              tick.time
            )}
          </span>
        );
      })}
    </div>
  );
};

/**
 * `range` overrides the window the track draws, and exists so the track can be handed the
 * *plotted* domain of the chart it sits under rather than deriving a parallel one.
 *
 * `useCursorRange` reads the raw forecast series; the chart plots a merge of that series with
 * generation, having dropped every point whose value is null (`use-format-chart-data.tsx`'s
 * `fromTimeSeries`). Those two are close but not equal, and the difference shows as the track
 * reaching further back than the axis above it. Deriving the window twice was always going to
 * drift; passing the chart's own first and last key makes the two ends the same fact.
 *
 * Omitted, the hook's window is used — which is what the shell footer does, since a footer that
 * outlives the chart swap cannot take its domain from whichever chart is mounted.
 */
const ScrubTrack: FC<{ zone?: string; range?: CursorRange | null }> = ({
  zone = "UTC",
  range: rangeOverride
}) => {
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
  // The override wins when there is one; daylight shading still comes from the hook, which is
  // the only source for it and is derived over the same forecast series either way.
  const range = rangeOverride ?? rangeData?.range ?? null;
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
  // Drawn against the whole window; stops only where a whole period fits inside it.
  const scale = useMemo(() => {
    if (!range?.start || !range?.end) return null;
    return scrubScale(range, cadenceMinutes, selectableLabelRange(range, focusedCountry));
  }, [range, cadenceMinutes, focusedCountry]);

  // The scale is in **label** space — the window is the chart's first and last published
  // timestamp, and the track is drawn against the chart's axis — while the cursor is an
  // instant. Writing a label as the cursor selected the period after it wherever labels close
  // their period (GB), and at the track's right end that is a slot past the chart, which the
  // chart's out-of-range guard reset to now while the drag wrote it back: the edge flash. So
  // every value crosses between the two here, and nowhere else.
  const toCursor = (label: string) => periodForLabel(label, focusedCountry).start;
  const toLabel = (instant: string) => slotForInstant(instant, focusedCountry);

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

  const quarterDayFractions = useMemo(() => {
    if (!scale) return [];
    return quarterDayInstants(scale.startMs, scale.endMs, zone).map((ms) =>
      fractionForMs(ms, scale)
    );
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
    // The period the pointer's instant falls in — not the label nearest it, nor the one after
    // it, either of which lit a band beside the pointer on one country or the other. Then held
    // to the selectable labels, as every other stop is.
    const fraction = fractionForClientX(clientX, element.getBoundingClientRect());
    const pointerMs = current.startMs + fraction * (current.endMs - current.startMs);
    const label = toLabel(DateTime.fromMillis(pointerMs, { zone: "utc" }).toISO() as string);
    return toCursor(clampToScale(label, current));
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

  /** A click that another control inside the track handed back: set the cursor there. */
  const selectAt = (clientX: number) => {
    const instant = instantAt(clientX);
    if (instant === null) return;
    beginUserInput();
    cancelPendingCommit();
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
    const index = slotIndexOf(toLabel(selectedISOTime), current);
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
    setSelectedISOTime(toCursor(instantForSlotIndex(target, current)));
  };

  // An inert track while the window is unknown. Drawing a handle over a guessed horizon would
  // be a scrubber that is wrong rather than absent, and the footer keeps its height either way.
  //
  // "Either way" is now true, which it was not before: this used to be 3px + 16px against a live
  // track of 40px + a 20px tick row, so the footer grew by ~21px the moment a range arrived. The
  // boxes below mirror the live layout exactly — the slider's `pt-0.5 pb-1` around an `h-5` strip
  // with the resting line centred in it, then an `h-5` stand-in for `TrackTicks` (its `my-0.5`
  // around an `h-4` row). Halving the track was the moment to make the claim honest rather than
  // re-break it.
  if (!scale || !selectedISOTime) {
    return (
      <div data-testid="scrub-track-idle">
        <div className="pb-1 pt-0.5">
          <div className="flex h-5 items-center">
            <div className="h-[3px] w-full rounded-sm bg-content/10" />
          </div>
        </div>
        <div className="h-5" />
      </div>
    );
  }

  // The drag-local value while a drag is live, the shared cursor otherwise. `dragInstant` is
  // null at rest, so at rest this line *is* the original derive-from-`selectedISOTime`.
  // `cursor` is the label the handle sits on, so it lines up with the chart's point for it.
  const cursor = clampToScale(toLabel(dragInstant ?? selectedISOTime), scale);
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
  // The **period**, not the instant. A single time on this chip made the reader supply the
  // country's labelling convention to know what it covered — GB's 13:00 is the half hour before
  // it, NL's the quarter after — which is precisely the thing nobody knows. A range says it.
  const focusedPeriod = periodForLabel(cursor, focusedCountry);
  const focusedLocal = `${formatISODateStringAsZonedTime(
    focusedPeriod.start,
    zone,
    DEFAULT_LOCALE
  )}–${formatISODateStringAsZonedTime(focusedPeriod.end, zone, DEFAULT_LOCALE)}`;
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
          to 26px, and the painted box is the child below at 20px.

          The padding has to live on a wrapper rather than on the strip itself: absolutely
          positioned children resolve against the *padding* box, so padding here would stretch
          the `inset-y-0` bands and NOW's `h-full` back to 26px and undo the halving.

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
        className="group cursor-grab touch-none select-none pt-0.5 pb-1 outline-none active:cursor-grabbing"
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
          //
          // `surface-inner` is the ground: the strip is a recess cut into the footer panel, the
          // same idea as the chart's plot well and the control trays, so it takes the same step.
          // It was transparent, which left the night hours sitting at panel level and the strip
          // reading as a drawing *on* the bar rather than a channel *in* it.
          //
          // No `overflow-hidden` here. Three things deliberately overhang the strip — the
          // handle, which spills top and bottom; the tethered tag, which rides above it; and
          // NOW's label. Clipping belongs to the ground layers only, so it lives on the inner
          // box below.
          className="relative h-5 rounded-sm bg-surface group-focus-visible:ring-1 group-focus-visible:ring-interactive"
        >
          {/* The ground: everything painted *into* the channel, clipped to its rounding. */}
          <div className="absolute inset-0 overflow-hidden rounded-sm">
            {/* Layer 1 (softest, bottom): daylight — the focused country's forecast > 0 windows. */}
            {daylightBands.map((band) => (
              <div
                key={`${band.startFraction}-${band.endFraction}`}
                // Solar, not interactive: these bands are where the forecast is above zero —
                // daylight. They read as data behind the track, not as something to click.
                className="pointer-events-none absolute inset-y-0 bg-solar/[0.14]"
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
                className="pointer-events-none absolute inset-y-0 left-0 bg-content/[0]"
                style={{ width: `${nowFraction * 100}%` }}
              />
            )}
            <div className="pointer-events-none absolute inset-x-0 top-[9px] h-[2px] rounded-sm bg-content/15" />
            {/* Layer 3: midnight hairlines — hard calendar edges, agreeing with `TrackTicks`' own
            midnight labels regardless of which tick density it has chosen. Full height less a
            2px inset top and bottom. */}
            {midnightFractions.map((fraction) => (
              <div
                key={fraction}
                className="pointer-events-none absolute top-0.5 h-4 w-px bg-content/20"
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
                className="pointer-events-none absolute top-1.5 h-2 w-px bg-content/10"
                style={{ left: `${fraction * 100}%` }}
              />
            ))}
            {/* Layer 3c: 06:00 and 18:00. Midday's height, one step dimmer. Height is spent on
            the midnight/not-midnight distinction alone — these two sit near the daylight band's
            own edges, so the ground behind them separates them from midday without a third
            height saying it again. Only those two hours: midnight and midday have their own
            marks, and a 6-hourly walk including them would stack two weights on one instant. */}
            {quarterDayFractions.map((fraction) => (
              <div
                key={fraction}
                className="pointer-events-none absolute top-1.5 h-2 w-px bg-content/[0.07]"
                style={{ left: `${fraction * 100}%` }}
              />
            ))}
          </div>
          {/* Layer 3d: the chart's zoom window, when it has one. Above the ground, under the
              handle and NOW. */}
          <ZoomFrame
            scale={scale}
            trackRef={trackRef}
            cursorFraction={cursorFraction}
            onSelectAt={selectAt}
          />
          {/* Layer 4: the handle. */}
          <div
            // Wider, rounded and ringed rather than a hairline rule: it is a control, and it was
            // reading as one more vertical line among the midnight hairlines and the now mark.
            //
            // Full strength at rest, not on hover: this and the chart's cursor pill are two
            // renderings of one value, and they only teach that by looking like one object. Dim
            // until touched made the handle the odd one out — the chart's line is drawn the whole
            // time, because it is the same control. Hover and focus escalate to
            // `--interactive-hover`, which is the app's standard step.
            className="pointer-events-none z-20 absolute -top-[3px] h-[26px] w-[5px] -translate-x-1/2 rounded-full bg-interactive shadow-[0_0_0_1.5px_rgba(0,0,0,0.7)]"
            style={{ left: `${cursorFraction * 100}%` }}
          />
          {/* The tethered reading: the focused country's own time, riding with the handle.
            Not part of the five-layer strip hierarchy above — it sits *below* the channel, over
            the tick labels, which is the row it is a reading of. It used to ride above, where it
            escaped the footer onto the map and sat on Mapbox's attribution. No transition — it
            must track the handle exactly, pointer-rate, with no lag or smoothing. */}
          <div
            // `items-center`, not `items-baseline`: the country code is `text-2xs` and the time
            // larger, so baseline alignment sat them on a shared baseline with visibly different
            // cap heights and left the tag looking tilted. Centring aligns what the eye reads.
            className="absolute top-[26px] z-30 flex touch-none items-center gap-1 whitespace-nowrap rounded border border-interactive/60 bg-surface px-[4px] py-[3.5px] tabular-nums shadow"
            style={{ left: `${cursorFraction * 100}%`, transform: `translateX(${labelTranslate})` }}
          >
            {/* `text-box` trims each line box to cap height and baseline, so centring the two spans
                centres the glyphs themselves. Without it the capitals sat off-centre, because
                the two fonts put different space above and below their capitals. */}
            <span className="text-[9px] font-bold uppercase leading-none tracking-wider text-interactive/80 [text-box:trim-both_cap_alphabetic]">
              {focusedCountry}
            </span>
            <span className="font-mono text-[11px] font-semibold leading-none text-interactive [text-box:trim-both_cap_alphabetic]">
              {focusedLocal}
            </span>
            {/* The live dot: state, on the thing that moves. The same colour as the lettering it
              sits beside, so it reads as part of the chip rather than a separate object. Small and
              never a fill, because red is not in this palette and a filled chip would say
              "alert" where this only says "following".

              `animate-beat`, not Tailwind's `animate-pulse`: at 6px a dip to 50% opacity is a
              shimmer you have to look for, where a fade almost to nothing is a blink you cannot
              miss. `motion-safe` so anyone who has asked the OS for less motion gets a static
              dot, which says the same thing. */}
            {isLive && (
              <span
                aria-hidden
                className="h-[5px] w-[5px] shrink-0 self-center rounded-full bg-interactive motion-safe:animate-beat"
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
              className="absolute top-0 z-[15] h-full w-px bg-content"
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
                  // the pulsing dot on the tethered tag is what says so — one label cannot honestly
                  // do both jobs, which is what this one was trying to do.
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded border border-interactive bg-surface px-1 py-px text-[9px] font-semibold uppercase leading-none tracking-wider text-interactive transition-colors hover:bg-surface-raised focus:outline-none focus-visible:ring-1 focus-visible:ring-interactive`}
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
