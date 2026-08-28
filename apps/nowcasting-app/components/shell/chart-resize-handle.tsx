import { FC, KeyboardEvent, PointerEvent } from "react";

import type { ResizeAxis } from "./use-resizable-chart-split";

type GripProps = {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
};

/**
 * How each grip is placed, shaped and described — the only thing that differs between the
 * three, since `use-resizable-chart-split.ts` runs the same gesture for all of them.
 *
 * The edges stop short of the corner (`bottom-6` / `right-6`) rather than running the full
 * side. Overlapping grips would make the corner — the one that resizes both dimensions, and
 * the harder target of the three to replace — a coin toss decided by paint order.
 */
const GRIP: Record<ResizeAxis, { className: string; label: string; title: string; glyph: string }> =
  {
    both: {
      className: "-right-1.5 -bottom-1.5 h-6 w-6 cursor-nwse-resize rounded-full",
      label: "Resize chart panel. Arrow keys resize, Enter resets to default size.",
      title: "Drag to resize. Double-click to reset.",
      // The corner glyph points the way the panel grows — bottom and right edges, matching the
      // two edges the drag actually moves. Always visible: it is the affordance saying the
      // panel is resizable at all, and the one that survived from the expand handle. The edges
      // below stay invisible until hovered — three permanent grips would read as chrome
      // drawn around the chart.
      glyph:
        "h-2.5 w-2.5 rounded-sm border-b-2 border-r-2 border-content/60 group-hover:border-interactive group-focus-visible:border-interactive"
    },
    x: {
      className: "-right-1 top-4 bottom-6 w-2 cursor-ew-resize rounded-full",
      label: "Resize chart panel width. Left and right arrow keys resize, Enter resets.",
      title: "Drag to resize width. Double-click to reset.",
      glyph:
        "h-8 w-0.5 rounded-full bg-content/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    },
    y: {
      className: "-bottom-1 left-4 right-6 h-2 cursor-ns-resize rounded-full",
      label: "Resize chart panel height. Up and down arrow keys resize, Enter resets.",
      title: "Drag to resize height. Double-click to reset.",
      glyph:
        "h-0.5 w-8 rounded-full bg-content/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    }
  };

/**
 * A resize grip on the chart panel — bottom-right corner, right edge, or bottom edge.
 *
 * The panel's fixed corner is top-left (`floating-chart.tsx`), so the three edges that move are
 * the right, the bottom, and the corner between them; each gets a grip, because asking for a
 * wider chart should not mean holding its height steady by hand along the diagonal. The corner
 * came first (it replaced `expand-button.tsx`) and is why the `nwse` cursor names that diagonal;
 * the edges take the single-axis `ew`/`ns` cursors for the one dimension each moves.
 *
 * All the drag/keyboard logic lives in `use-resizable-chart-split.ts`; this component is just
 * the operable target — hit area, cursor, focus ring, and the a11y wiring a `slider`-shaped
 * control needs, the same shape `scrub-track.tsx` uses for the cursor.
 *
 * Double-click resets to the mode's seed (Enter/Space do the same from the keyboard) — the
 * reset affordance removing the expand handle otherwise leaves nothing to provide. It is not
 * labelled on the control itself (no room, and a visible "reset" button is a second target);
 * `aria-label` names it instead.
 */
const ChartResizeHandle: FC<GripProps & { axis?: ResizeAxis }> = ({
  axis = "both",
  ...handlers
}) => {
  const grip = GRIP[axis];
  return (
    <div
      // Not `role="slider"`: the corner drags two independent dimensions, and ARIA's slider
      // role is defined for one, which is also why there is no single `aria-valuenow` to give
      // it. The edges are kept the same shape as the corner rather than split into real
      // sliders, so the three grips are one control with one keyboard contract. `aria-label`
      // plus the keyboard wiring below is the operable contract instead — arrow keys resize,
      // Enter/Space reset, same as a slider's keys.
      // Only the corner is a tab stop. It already resizes both dimensions from the keyboard, so
      // focusable edges would add two tab stops between the chart and the map that reach
      // nothing the corner does not — the edges are a pointer convenience, and are described to
      // assistive tech by the corner's label rather than three times over.
      tabIndex={axis === "both" ? 0 : undefined}
      aria-hidden={axis === "both" ? undefined : true}
      aria-label={grip.label}
      // `use-cursor-hotkeys.tsx` runs a `document` keydown listener that steps the time
      // cursor on Left/Right. It stands down for events originating inside anything marked as
      // handling the arrows itself; without this attribute, resizing the chart from the keyboard
      // would also walk the forecast time.
      data-arrow-keys-handled
      className={`group absolute z-20 flex touch-none items-center justify-center outline-none focus-visible:ring-1 focus-visible:ring-interactive ${grip.className}`}
      {...handlers}
      title={grip.title}
    >
      <span className={`pointer-events-none block ${grip.glyph}`} />
    </div>
  );
};

export default ChartResizeHandle;
