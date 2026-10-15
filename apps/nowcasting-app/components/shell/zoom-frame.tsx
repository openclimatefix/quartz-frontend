import { FC, PointerEvent, RefObject, useEffect, useRef, useState } from "react";
import { DateTime } from "luxon";

import useGlobalState from "../helpers/globalState";
import { fractionForInstant, type ScrubScale } from "./scrub-scale";

/**
 * The chart's zoom window, drawn on the scrub track as a frame — MOCK.
 *
 * Outside the window is dimmed and the window itself is outlined, so the track still reads as
 * the whole range while saying which part the chart is showing. Dragging the frame's body moves
 * the window and its two edges resize it, as a Plotly range slider does.
 *
 * The cursor handle wins: a press within a few pixels of it is left to the track, so the handle
 * can still be dragged anywhere inside the frame. A press on the body that never moves is a click,
 * and sets the cursor there as a click anywhere else on the track does.
 *
 * Zoom is held as the chart's category labels (`formattedDate`, 16 characters, UTC), and every
 * write stays on the focused cadence so the chart's filter always lands on real labels.
 */

type Mode = "move" | "start" | "end";

type Drag = {
  mode: Mode;
  pointerX: number;
  width: number;
  moved: boolean;
  startMs: number;
  endMs: number;
};

/** A press this close to the cursor handle, in px, belongs to the handle. */
const HANDLE_PRIORITY_PX = 6;
/** How far, in px, a press on the body must travel before it is a drag rather than a click. */
const CLICK_SLOP_PX = 3;
/** The narrowest window a resize may leave, in slots. */
const MIN_SLOTS = 2;

const labelMs = (label: string) => DateTime.fromISO(`${label}:00.000Z`, { zone: "utc" }).toMillis();
const msLabel = (ms: number) =>
  (DateTime.fromMillis(ms, { zone: "utc" }).toISO() as string).slice(0, 16);

const ZoomFrame: FC<{
  scale: ScrubScale;
  trackRef: RefObject<HTMLDivElement | null>;
  cursorFraction: number;
  /** Sets the cursor under a pointer — what a click on the body does. */
  onSelectAt: (clientX: number) => void;
}> = ({ scale, trackRef, cursorFraction, onSelectAt }) => {
  const [zoomArea, setZoomArea] = useGlobalState("globalZoomArea");
  const [isZoomed] = useGlobalState("globalChartIsZoomed");
  const [isZooming] = useGlobalState("globalChartIsZooming");

  // Drag-local, as the handle's is: the frame follows the pointer every event, and the chart's
  // re-filter is committed at most once a frame.
  const [local, setLocal] = useState<{ startMs: number; endMs: number } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x1: string; x2: string } | null>(null);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    []
  );

  if (!isZoomed || isZooming || !zoomArea?.x1 || !zoomArea?.x2) return null;

  const step = scale.cadenceMinutes * 60_000;
  const snap = (ms: number) => Math.round(ms / step) * step;
  const bounds = { start: scale.startMs, end: scale.endMs };

  const startMs = local?.startMs ?? labelMs(zoomArea.x1);
  const endMs = local?.endMs ?? labelMs(zoomArea.x2);
  const startFraction = fractionForInstant(msLabel(startMs) + ":00.000Z", scale);
  const endFraction = fractionForInstant(msLabel(endMs) + ":00.000Z", scale);

  const commit = (next: { startMs: number; endMs: number }) => {
    setLocal(next);
    pendingRef.current = { x1: msLabel(next.startMs), x2: msLabel(next.endMs) };
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      if (pendingRef.current) setZoomArea(pendingRef.current);
      pendingRef.current = null;
    });
  };

  const onPointerDown = (mode: Mode) => (event: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track || event.button !== 0) return;
    const rect = track.getBoundingClientRect();
    const handleX = rect.left + cursorFraction * rect.width;
    if (Math.abs(event.clientX - handleX) <= HANDLE_PRIORITY_PX) return;

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode,
      pointerX: event.clientX,
      width: rect.width,
      moved: false,
      startMs,
      endMs
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.width <= 0) return;
    event.stopPropagation();
    if (!drag.moved && Math.abs(event.clientX - drag.pointerX) < CLICK_SLOP_PX) return;
    drag.moved = true;
    const deltaMs = ((event.clientX - drag.pointerX) / drag.width) * (bounds.end - bounds.start);
    const minSpan = MIN_SLOTS * step;

    if (drag.mode === "move") {
      const span = drag.endMs - drag.startMs;
      const start = Math.min(
        Math.max(snap(drag.startMs + deltaMs), bounds.start),
        bounds.end - span
      );
      commit({ startMs: start, endMs: start + span });
    } else if (drag.mode === "start") {
      const start = Math.min(
        Math.max(snap(drag.startMs + deltaMs), bounds.start),
        drag.endMs - minSpan
      );
      commit({ startMs: start, endMs: drag.endMs });
    } else {
      const end = Math.max(
        Math.min(snap(drag.endMs + deltaMs), bounds.end),
        drag.startMs + minSpan
      );
      commit({ startMs: drag.startMs, endMs: end });
    }
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.stopPropagation();
    dragRef.current = null;
    if (!drag.moved && drag.mode === "move" && event.type === "pointerup") {
      onSelectAt(event.clientX);
    }
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (pendingRef.current) setZoomArea(pendingRef.current);
    pendingRef.current = null;
    setLocal(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlers = (mode: Mode) => ({
    onPointerDown: onPointerDown(mode),
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onLostPointerCapture: endDrag
  });

  return (
    <>
      {/* Dim outside the window, inside the strip's rounding. Under the handle and NOW. */}
      <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden rounded-sm">
        <div
          className="absolute inset-y-0 left-0 bg-black/50"
          style={{ width: `${startFraction * 100}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-black/50"
          style={{ width: `${(1 - endFraction) * 100}%` }}
        />
      </div>

      {/* The frame. Its body moves the window; its edges resize it. */}
      <div
        data-testid="zoom-frame"
        className="pointer-events-none absolute -inset-y-px z-10 rounded-sm border border-interactive/70"
        style={{
          left: `${startFraction * 100}%`,
          width: `${(endFraction - startFraction) * 100}%`
        }}
      >
        <div
          title="Drag to move the zoom window"
          className="pointer-events-auto absolute inset-0 cursor-grab hover:bg-interactive/[0.06] active:cursor-grabbing"
          {...handlers("move")}
        />
        <div
          title="Drag to change where the zoom starts"
          className="group/edge pointer-events-auto absolute -left-[5px] inset-y-0 w-[10px] cursor-ew-resize"
          {...handlers("start")}
        >
          <div className="absolute left-1/2 top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-interactive/80 group-hover/edge:bg-interactive" />
        </div>
        <div
          title="Drag to change where the zoom ends"
          className="group/edge pointer-events-auto absolute -right-[5px] inset-y-0 w-[10px] cursor-ew-resize"
          {...handlers("end")}
        >
          <div className="absolute left-1/2 top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-interactive/80 group-hover/edge:bg-interactive" />
        </div>
      </div>
    </>
  );
};

export default ZoomFrame;
