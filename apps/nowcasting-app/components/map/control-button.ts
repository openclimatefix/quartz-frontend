/**
 * One button vocabulary for the map control panel.
 *
 * The panel had accumulated three. The comparison row ("Forecast"/"Delta") was `text-xs
 * font-semibold` in `px-2 py-1`, rounded, separated by a gap. `MapUIButton` — the %/MW/Capacity
 * and GSP/DNO toggles — was `text-sm font-extrabold` in `px-3 py-0.5`, square, welded into a
 * segmented bar by `border-r`, and grew to `dash:text-lg` on the dashboard breakpoint where
 * nothing else did. The Clouds/PV layer buttons were a third copy of that second style, written
 * out by hand rather than shared. Three type sizes, three paddings and two hover languages, in
 * one panel roughly 200px wide.
 *
 * These constants are that panel's whole button vocabulary, taken from the comparison row
 * because it is the one Brad picked out. Two decisions are worth recording:
 *
 * - **`transition-colors`, not `transition-all`.** The layer buttons animated every property so
 *   they could carry `active:scale-95`. A control that shrinks when pressed reads as a different
 *   kind of object from one that does not, and only two of the panel's buttons did it.
 * - **Hover brightens the label; it does not fill.** `MapUIButton` and the layer buttons filled
 *   yellow on hover — the same yellow that means *selected* — so passing the pointer across the
 *   row made every button look momentarily active. The comparison row never did this.
 *
 * Width is the caller's business, not this module's: the unit toggle spreads across the panel
 * (`GROW` on each button), while the two half-column groups stay tight so they fit beside each
 * other. See `map-encoding-controls.tsx` for that layout.
 */

/** Geometry and type. Every button in the panel starts here. */
export const CONTROL_BUTTON_BASE =
  "inline-flex items-center justify-center rounded px-2 py-1 text-xs font-semibold transition-colors";

/** Selected. The one place the brand yellow appears on a control in this panel. */
export const CONTROL_BUTTON_ACTIVE = "bg-ocf-yellow text-black";

/** Selectable, not selected. */
export const CONTROL_BUTTON_IDLE = "bg-mapbox-black text-ocf-gray-400 hover:text-white";

/**
 * Not applicable in the current view — inert, and never the selected style even for the frame
 * before state settles. The hover highlight goes too, or an inert button looks live.
 */
export const CONTROL_BUTTON_UNAVAILABLE =
  "cursor-not-allowed bg-black text-ocf-gray-800 hover:text-ocf-gray-800";

/** Share the row's width equally. For groups that span the panel, not the half-column ones. */
export const CONTROL_BUTTON_GROW = "flex-1";

/** The row a group of these sits in — the gap that replaced `border-r` dividers. */
export const CONTROL_ROW = "flex items-center gap-1";
