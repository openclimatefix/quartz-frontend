import { FC, KeyboardEvent, PointerEvent } from "react";

/**
 * The chart panel's resize grip — replaces `expand-button.tsx`.
 *
 * Sits bottom-right, the corner opposite the panel's fixed top-left anchor
 * (`floating-chart.tsx`), so dragging it directly manipulates the two edges that actually move.
 * It was top-right while the panel hung from the bottom edge; the corner follows the anchor,
 * and so does the `nwse`/`nesw` resize cursor naming the diagonal it travels.
 * All the drag/keyboard logic lives in `use-resizable-chart-split.ts`; this component is just
 * the operable target — hit area, cursor, focus ring, and the a11y wiring a `slider`-shaped
 * control needs, the same shape `scrub-track.tsx` uses for the cursor.
 *
 * Double-click resets to the mode's seed (Enter/Space do the same from the keyboard) — the
 * reset affordance removing the expand handle otherwise leaves nothing to provide. It is not
 * labelled on the control itself (no room, and a visible "reset" button is a second target);
 * `aria-label` names it instead.
 */
const ChartResizeHandle: FC<{
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
}> = ({
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onKeyDown,
  onDoubleClick
}) => (
  <div
    // Not `role="slider"`: this drags two independent dimensions (width and height), and
    // ARIA's slider role is defined for one, which is also why there is no single
    // `aria-valuenow` to give it. `aria-label` plus the keyboard wiring below is the operable
    // contract instead — arrow keys resize, Enter/Space reset, same as a slider's keys.
    tabIndex={0}
    aria-label="Resize chart panel. Arrow keys resize, Enter resets to default size."
    // `use-hot-key-control-chart.tsx` runs a `document` keydown listener that steps the time
    // cursor on Left/Right. It stands down for events originating inside anything marked as
    // handling the arrows itself; without this attribute, resizing the chart from the keyboard
    // would also walk the forecast time.
    data-arrow-keys-handled
    className="group absolute -right-1.5 -bottom-1.5 z-20 flex h-6 w-6 cursor-nwse-resize touch-none items-center justify-center rounded-full outline-none focus-visible:ring-1 focus-visible:ring-ocf-yellow"
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerCancel}
    onLostPointerCapture={onLostPointerCapture}
    onKeyDown={onKeyDown}
    onDoubleClick={onDoubleClick}
    title="Drag to resize. Double-click to reset."
  >
    {/* The corner glyph points the way the panel grows — bottom and right edges, matching the
        two edges the drag actually moves. */}
    <span className="pointer-events-none block h-2.5 w-2.5 rounded-sm border-b-2 border-r-2 border-white/60 group-hover:border-ocf-yellow group-focus-visible:border-ocf-yellow" />
  </div>
);

export default ChartResizeHandle;
