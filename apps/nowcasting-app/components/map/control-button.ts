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
  "inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-semibold transition-colors";

/**
 * Selected. Carried by weight rather than hue: the selected button is the only one in the row
 * with a ground, and it is the lightest thing there — now by inverting outright, an oat fill
 * with dark lettering.
 *
 * The ladder up to it went `surface-raised` with an oat hairline, one tone step above the idle
 * buttons. With the accent gone neutral that step was the *whole* of selection, and a step in a
 * ramp whose neighbours are also steps in the same ramp is not enough to pick a button out of a
 * row of four. Inverting is the strongest thing a single neutral can do, and it is unambiguous
 * at a glance across the room, which is what the dashboard mode is for.
 *
 * No ring: an oat hairline around an oat ground draws nothing. The fill *is* the edge.
 *
 * This also replaced, earlier, a fill-versus-fill arrangement where idle buttons sat on
 * `surface-sunken` — darker than the panel behind them — so the *unselected* buttons read as
 * the heavier objects. An orange edge was tried first and had the same problem: a hairline
 * cannot outweigh a solid block.
 */
export const CONTROL_BUTTON_ACTIVE = "bg-selected text-content-on-accent";

/**
 * Selectable, not selected. Sits *in* the group's well rather than on top of it, so it still
 * reads as a button — going fully transparent lost the affordance — while staying below the
 * selected one. One step above the tray (ink-4 in ink-3), one below the selected (ink-5).
 */
export const CONTROL_BUTTON_IDLE =
  "bg-surface-panel text-content-muted hover:bg-surface-raised hover:text-content";

/**
 * Not applicable in the current view — inert, and never the selected style even for the frame
 * before state settles. The hover highlight goes too, or an inert button looks live.
 */
export const CONTROL_BUTTON_UNAVAILABLE =
  "cursor-not-allowed bg-surface-inset text-surface-panel hover:text-surface-panel";

/** Share the row's width equally. For groups that span the panel, not the half-column ones. */
export const CONTROL_BUTTON_GROW = "flex-1";

/**
 * SINGLE-SELECT row. A well: a sunken tray the idle buttons belong to and the selected one
 * lifts out of. The tray is what says "these are the options, pick one" — the shape carries the
 * exclusivity, which is what lets selection be a matter of depth rather than hue.
 *
 * The tray is `surface-inner`, the same step as the chart's plot well, because it is the same
 * idea: a recess cut into a Black 1 panel. It used to be `surface` — Black 2, three steps down
 * from the panel around it, where the chart only drops one — which is what made the dock read
 * as punched through where the chart reads as cut into.
 *
 * Used by Forecast/Delta, %/MW/Capacity and GSP/DNO.
 */
export const CONTROL_ROW =
  "flex items-center gap-0.5 rounded-md bg-surface-inner p-0.5 shadow-well";

/**
 * MULTI-SELECT row. No tray, because there is no "one of these" to enclose — each button is an
 * independent switch and keeps its own outline whether on or off. See
 * `docs/phase6-track-a-notes.md`: independent toggles and single-select are different controls
 * and must not look alike, or a layer toggle reads as though turning one on turns another off.
 *
 * Used by the Clouds/PV layer toggles.
 */
export const CONTROL_ROW_MULTI = "flex items-center gap-1";

/**
 * The lamp on a multi-select button — the same device as the header's country toggle, and for
 * the same reason: a switch has to say what it is *not* doing as loudly as what it is. Fill and
 * outline alone leave "off" reading as "not currently chosen", which is a single-select idea.
 *
 * Both states keep a lamp in the same place, so the eye tracks one thing changing rather than an
 * ornament appearing and vanishing. Off is a black disc — visible against the panel, plainly
 * unlit. On is the same disc filled with `content`, the light grey the label is already in.
 *
 * 10px with a 2px ring, matching `country-toggle.tsx`: at 8px the ring reads as a smudge rather
 * than as a lamp with an off position.
 *
 * Grayscale on purpose. Orange means "you can act on this" and every one of these is actionable
 * whichever way it is pointing, so colour here would be saying something the state does not.
 */
// The border colour lives on the states, not here: the two states now sit on different grounds
// (oat when on, the panel when off), so one border colour cannot serve both.
export const CONTROL_LAMP_BASE = "h-2.5 w-2.5 shrink-0 rounded-full border-2 transition-colors";
/** Lit: a light fill inside the dark ring. */
export const CONTROL_LAMP_ON = "border-content-on-accent bg-content";
/** Unlit: the same ring, dark all the way through. */
export const CONTROL_LAMP_OFF = "border-content-on-accent bg-content-on-accent";
/**
 * Working. The lamp pulses rather than a spinner sitting beside the label — the dock column is
 * 116px and a 14px spinner plus its margin is 20px the row does not have, so the separate
 * spinner wrapped the row exactly when something was happening. One indicator, three states.
 */
export const CONTROL_LAMP_BUSY = "border-content-on-accent bg-content motion-safe:animate-beat";

/**
 * On, in a multi-select. Filled and outlined — a switch that is up.
 *
 * The ring is the same in both states: it draws the switch's body, and the lamp above says which
 * way it is pointing. `content-on-accent` (Black 2) rather than a bare `black`, so it stays a
 * role and follows the theme.
 *
 * 2px, matching the lamp's own ring — the switch and its lamp are drawn with one pen. At 1px a
 * dark ring on a dark panel read thinner than the hard tone step that bounds a single-select
 * tray, so the two controls looked differently defined when they should look equally so.
 */
export const CONTROL_BUTTON_ON =
  "bg-selected text-content-on-accent ring-2 ring-inset ring-content-on-accent";

/** Off, in a multi-select. Outlined but unfilled — the same switch, down. */
export const CONTROL_BUTTON_OFF =
  "bg-transparent text-content-muted ring-2 ring-inset ring-content-on-accent hover:bg-surface-raised/40 hover:text-content";
