import { KeyboardEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";

import { ChartContainerSizePx, ChartSplitPercent, clampChartSplit } from "./geometry";

/** Keyboard resize stride, in percent of the container — a visible step per press. */
const KEY_STEP_PERCENT = 3;

/**
 * Drag-to-resize for the floating chart panel — the override half of OPEN 5, replacing the
 * expand handle.
 *
 * Follows `scrub-track.tsx`'s pattern for the reason it exists there: writing shared state on
 * every `pointermove` re-renders the chart (Recharts) and the map underneath it on every pixel
 * of movement, which Brad rejected on the cursor scrubber and would feel worse here, resizing
 * the very component doing the expensive rendering. So a drag runs at two rates. `dragSplit` is
 * the handle's own position, set on pointerdown, updated every `pointermove` in a render
 * confined to whatever consumes this hook, and dropped on release; the size the rest of the app
 * reads (`onCommit`) is coalesced to at most once per animation frame while dragging, and
 * written exactly once, synchronously, on release, so a drag never leaves a frame's write
 * pending after the pointer is already gone.
 *
 * The clamp (`clampChartSplit`) is re-applied on every move against the container's *live*
 * measured size, not a size captured at drag start, so a window resize mid-drag (or the display
 * rail opening, which changes the inset's width) cannot leave the handle proposing something
 * unreachable.
 */
export function useResizableChartSplit({
  seed,
  override,
  onCommit,
  onReset
}: {
  /** The mode's `CHART_SPLIT` entry — what a mode with no stored override renders. */
  seed: ChartSplitPercent;
  /** The mode's stored override, if the user has sized this mode before. */
  override: ChartSplitPercent | undefined;
  /** Called with the clamped, final split — on each animation frame while dragging, and once more on release. */
  onCommit: (split: ChartSplitPercent) => void;
  /** Called to clear the current mode's override, returning it to its seed. */
  onReset: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number; split: ChartSplitPercent } | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<ChartSplitPercent | null>(null);
  const [dragSplit, setDragSplit] = useState<ChartSplitPercent | null>(null);

  // The resting (non-drag) container size, kept only so the steady-state render can be
  // reclamped when the inset resizes under it — the display rail opening, a browser resize, a
  // stored override from a previous, wider session. Drag handlers below measure live instead
  // of reading this, so a fast drag is never a frame behind a `ResizeObserver` callback.
  const [restingSize, setRestingSize] = useState<ChartContainerSizePx>({ widthPx: 0, heightPx: 0 });

  useEffect(() => {
    const container = panelRef.current?.offsetParent as HTMLElement | null;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setRestingSize({ widthPx: entry.contentRect.width, heightPx: entry.contentRect.height });
    });
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const committed = override ?? seed;

  /** The container's size right now, queried live — used by the drag/keyboard handlers. */
  const liveContainerSize = useCallback((): ChartContainerSizePx => {
    const container = panelRef.current?.offsetParent as HTMLElement | null;
    return { widthPx: container?.clientWidth ?? 0, heightPx: container?.clientHeight ?? 0 };
  }, []);

  const cancelPendingCommit = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    pendingRef.current = null;
  };
  // A drag torn down mid-gesture (unmount) must not leave a frame pointing at a dead component.
  useEffect(() => cancelPendingCommit, []);

  const flushCommit = () => {
    frameRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) onCommit(pending);
  };
  const scheduleCommit = (split: ChartSplitPercent) => {
    pendingRef.current = split;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(flushCommit);
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    startRef.current = { x: event.clientX, y: event.clientY, split: committed };
    setDragSplit(committed);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!draggingRef.current || !startRef.current) return;
    const size = liveContainerSize();
    if (size.widthPx <= 0 || size.heightPx <= 0) return;
    const dxPercent = ((event.clientX - startRef.current.x) / size.widthPx) * 100;
    // The panel's fixed corner is bottom-left (`left`/`bottom` in `floating-chart.tsx`), so the
    // handle sits top-right: dragging up is a negative `clientY` delta but must *grow* the
    // height, hence the sign flip here and nowhere else.
    const dyPercent = ((startRef.current.y - event.clientY) / size.heightPx) * 100;
    const proposed: ChartSplitPercent = {
      width: startRef.current.split.width + dxPercent,
      height: startRef.current.split.height + dyPercent
    };
    const clamped = clampChartSplit(proposed, size);
    setDragSplit(clamped);
    scheduleCommit(clamped);
  };

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    // The drag always ends on its true final value, committed exactly once — the same handoff
    // `scrub-track.tsx` uses, for the same reason: take whatever the last frame did not get to,
    // cancel that frame, and write it here instead.
    const pending = pendingRef.current;
    cancelPendingCommit();
    if (pending) onCommit(pending);
    setDragSplit(null);
    startRef.current = null;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  /**
   * Arrow keys resize in `KEY_STEP_PERCENT` steps; Enter/Space reset to the mode's seed — the
   * keyboard equivalent of the double-click reset, since a keyboard user cannot double-click.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    let dWidth = 0;
    let dHeight = 0;
    switch (event.key) {
      case "ArrowLeft":
        dWidth = -KEY_STEP_PERCENT;
        break;
      case "ArrowRight":
        dWidth = KEY_STEP_PERCENT;
        break;
      case "ArrowUp":
        dHeight = KEY_STEP_PERCENT;
        break;
      case "ArrowDown":
        dHeight = -KEY_STEP_PERCENT;
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onReset();
        return;
      default:
        return;
    }
    event.preventDefault();
    const size = liveContainerSize();
    const proposed: ChartSplitPercent = {
      width: committed.width + dWidth,
      height: committed.height + dHeight
    };
    onCommit(clampChartSplit(proposed, size));
  };

  return {
    /** The size to render this instant — drag-local while dragging, the clamped rest state otherwise. */
    split: dragSplit ?? clampChartSplit(committed, restingSize),
    isDragging: dragSplit !== null,
    panelRef,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
      onKeyDown,
      onDoubleClick: onReset
    }
  };
}
