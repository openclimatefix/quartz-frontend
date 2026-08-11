# Phase 6 followup, Track H — the footer's scrub track

Phase 6's live pass asked for the one thing Track D deferred. Its reasoning was scope discipline
rather than a technical objection — "§4 only asks for the readout, and the time range is
explicitly unchanged for Europe v1 … a real scrub bar is a new interaction, not a move" — and
Brad has now asked for the interaction. This is it, built on Track B's seam and mounted inside
the readout Track D shipped.

## What it is, and why it is not a slider

**Time here is a grid, not a continuum.** Contract §4 settled that deliberately: a fully
continuous cursor was prototyped and rejected because it puts the cursor on an instant that is
real for nobody. The cursor steps on the finest *enabled* country's grid — 30 minutes with only
GB on, 15 with NL alongside it — so every position the handle can occupy is a real published
instant for at least one country.

That single fact is what makes the naive implementation wrong. A range input maps a pixel to a
continuous value and rounds to the nearest step, and **nearest is the wrong rule here**:
timestamps label the *end* of their period, so the slot containing an instant is the next label
at or after it. A track that rounded to nearest would be right half the time and wrong by up to
half a period the other half, and it would look completely correct on screen. Nothing in this
track rounds. Every snap goes through Track B's `snapToCadence`.

## How it snaps, and to what

One path, four steps, and it is the same path for a pointer and for a key:

```
pointer x  ──fractionForClientX──►  0..1
0..1       ──instantForFraction──►  startMs + f·span
instant    ──snapToCadence────────►  the next slot at or after it   (Track B's ceiling)
slot       ──clamp────────────────►  inside [firstMs, lastMs]
```

**Snap then clamp, in that order**, and the order is load-bearing. An instant in the last
part-step of the window ceilings *past* the end and is pulled back onto the final published
slot; clamping first and ceiling after would push it off the end again. Pinned by a test.

The grid's two ends are not symmetrical, and this is the one thing added to Track B's module:

- the **first** reachable slot is `snapToCadence(range.start)` — the ceiling, as everywhere;
- the **last** is `snapDownToCadence(range.end)` — a **new export** in `lib/time/cursor.ts`.

The floor exists for exactly one job and its doc comment says so: finding the far end of a
*bounded span*. Ceiling the window's end would give the track a final position one step past
the last published value — a handle you can drag onto an instant nothing has a number for.
Nothing else uses it, and the ceiling remains the rule everywhere a cursor *input* is resolved.
No existing exported behaviour changed.

**The grain is re-derived on every render** from `useEnabledCountries()`, and the pointer
handlers close over a ref holding the current scale rather than over the scale itself, so
toggling a country changes the step under a drag in progress rather than at the next
pointer-down. Re-snapping the *cursor* when the set changes is `globalState.resnapCursorToGrid`'s
job and is not duplicated here — a test asserts the track agrees with it rather than rounding the
other way and leaving the handle a slot behind the map.

## How the range is derived

**Derived, never invented.** §4 is explicit that the range is unchanged for Europe v1 — "no range
picker, no date picker — the window we already show" — so the risk was a track that quietly
introduces one.

`use-cursor-range.ts` reads the window the app already shows: the focused country's national
forecast axis, first `timeUtc` to last. That is *the same query* `pv-remix-chart.tsx` runs for
its first series, and its endpoints are already the arrow keys' limits (`chartLimits`) and the
play button's wrap point (`forecastEndTime`). Deriving it this way is what makes the four inputs
agree about where the ends are rather than three agreeing and the new one being close.

It costs no request — SWR dedupes on the cache key, and every argument matches the chart's: the
focused country's national scope, `nationalChartSeries[0]`'s model, and a window that pins
`start` only. The end is deliberately left to the API's default: pinning it is what silently
clipped GB's horizon from 48h to ~26h before Phase 4, and a scrub track stopping 22 hours short
of the forecast would look entirely reasonable.

`getEarliestForecastTimestamp()` floors to a 6-hour boundary and both call sites memoise it on
mount, so they compute the same string for any pair of mounts inside the same 6-hour block —
which, since the shell mounts them together, is every session. If they ever did diverge the cost
is one extra cached request, not a wrong range.

**When the window is unknown the track is inert** — a flat bar, no handle, no interaction. There
is no defensible default for "how far ahead does this country forecast", and a scrubber over a
guessed horizon is wrong rather than absent. The footer keeps its height either way.

## How it stays in sync with the other three inputs

By construction, and this is the whole design: **the track has no position state of its own.**
The handle is derived from `selectedISOTime` on every render, which is what the chart click, the
arrow keys and the play button all write. So the handle follows playback without knowing playback
exists, and a drag moves the map and the chart because they read the same value. There is nothing
to keep in step.

Two consequences worth stating:

- **A cursor written off the track is shown at the end it ran past**, not hidden. The cursor can
  legitimately sit outside the window for a moment — the minute timer advances `timeNow` — and
  clamping the *display* rather than the *state* means the track never fights another input.
- **Dragging stops the minute timer** (`stopTime`), the same thing the chart click does. Without
  it a scrub into the past is overwritten by "now" within the minute.

**One file outside the track was edited, and it is flagged here.**
`components/hooks/use-hot-key-control-chart.tsx` gains a three-line guard: it stands down for key
events originating inside `[data-cursor-scrubber]`. The track is a `role="slider"`, so ARIA
requires it to step on Left/Right while focused; that listener is on `document` and would
otherwise also fire, moving the cursor two slots per press. Owning the arrows in the track rather
than leaving them to the hook also **gives the delta view arrow keys at all** — its own call to
the hook is commented out. Everywhere else the hook is unchanged: the arrows still work with
nothing focused, exactly as before.

Keyboard, in full: Left/Down back one slot, Right/Up forward one, PageUp/PageDown ±3 hours
expressed in slots so the jump always lands on the grid, Home/End to the window's ends. The
control is labelled with its current grain ("Time cursor, 30-minute steps"), reports
`aria-valuenow` as a **slot index** rather than milliseconds or a percentage — the control
genuinely has `slotCount + 1` positions and no others — and carries a human `aria-valuetext`.

## DST

Everything is epoch milliseconds off UTC instants, so neither country's transition can move the
scale. This is Track B's decision inherited rather than a new one, and it matters more here
because the track spans ~72 hours and therefore crosses local midnight in both countries.

Pinned: a window across each 2026 transition contains exactly 48 slots at 30 minutes and 96 at 15
— the counts a local-time scale would give as 47 or 49 — and the scale is byte-identical with the
viewer in UTC, London, Amsterdam or Los Angeles. One test walks the four slots around the October
change and shows London reading `01:00, 01:30, 01:00, 01:30` while Amsterdam reads `02:00, 02:30,
02:00, 02:30`: the two repeat at the same UTC instant but at different local hours, which is
precisely why one grid can serve both and a local one cannot. The ambiguity is displayed by the
per-country readout, not resolved by the scale.

The tick labels name the weekday whenever the day changes, because bare times repeat three times
across the window and a reader cannot otherwise place them.

## What was tested, and what has no oracle

**35 new tests, in three files.**

`components/shell/scrub-scale.test.ts` (21) is the real oracle — the pure pixel ↔ instant module:
snapping (ceiling, never nearest, at the 15/30 boundary), clamping at both ends including the
snap-then-clamp ordering, the reachable ends, a window with no slot in it, a pointer that has left
the element, a full round-trip of every slot through its own fraction, slot indices, and the DST
cases above.

`components/shell/scrub-track.test.tsx` (10) pins the two claims the pure tests cannot make: that
the handle is derived from shared state (so anything writing `selectedISOTime` moves it), and that
the grain re-derives from the enabled set — toggling NL doubles the reachable positions and halves
the arrow-key step. Pointer dragging is deliberately *not* asserted: jsdom gives every element a
zero-width `getBoundingClientRect`, so a synthetic drag would exercise the zero-width fallback
rather than the conversion. The conversion is `fractionForClientX` and it is pinned pure.

`lib/time/cursor.test.ts` (+4) pins the new `snapDownToCadence`, including that it is the exact
opposite of `snapToCadence` at a quarter hour and that it floors rather than truncating towards
zero for a negative epoch.

**No oracle, and therefore Brad's:** every pixel of it. Track height, handle size, whether the
past shading reads as "already happened", whether the "now" tick is findable, tick density and
whether five labels is right for a 72-hour window, and whether a drag *feels* like it is snapping
or stuttering at 15 minutes across a wide screen.

## Verification

- `yarn tsc --noEmit` — clean bar the known pre-existing `jest.globalSetup.ts(14,1) TS1208`.
- `npx next lint` — **16 warnings, 0 errors**: the baseline exactly, none in the touched files.
- Full Jest suite — **1073 passed / 44 suites**, from a 1038 / 42 baseline. Purely by addition; no
  existing test changed.
- `next build` — green, exit 0.

(One earlier `next build` failed on `MAP_CONTROL_WIDTH_PX` in `components/shell/floating-chart.tsx`
— Track G's file, mid-edit while this track was verifying. It cleared on its own and the numbers
above are from the run after it did.)

## For the live pass

The track is the footer's second row, under the readout.

- **Drag it.** The map and the chart should repaint continuously, and the handle should visibly
  step rather than glide — with GB only, in half-hour jumps.
- **Enable NL and drag again.** The step should visibly halve. Then toggle NL *mid-drag* if you
  can manage it; the grain should change under your finger rather than at the next press.
- **Check the four inputs agree.** Click the chart and watch the handle move; hold an arrow key;
  press play and watch the handle track it; then drag and confirm play has stopped rather than
  fighting you.
- **The ends.** Drag hard past both ends — the handle should stop at the first and last published
  slot, and the readout should still name a real instant. Press End, then Right: nothing should
  move.
- **"now".** The mark should sit where the past shading stops, and the cursor's side of it should
  be obvious at a glance. This is the thing the track is for beyond convenience — past and
  forecast mean different things.
- **The keyboard alone.** Tab to the track (it takes focus and shows a ring), then Home, End,
  PageUp, PageDown and the arrows. In the delta comparison too, where the arrows did not work
  before this track.
- **Tick labels across midnight** — the weekday should appear on the first mark of each new day
  and nowhere else.

## Deferred, and why

- **The readout still leads with UTC**, and the track's axis follows it. Whether the footer should
  lead with the focused country's local time is Brad's open decision and this track does not
  pre-empt it: the zone is a single constant in `cursor-readout.tsx` passed to the track as a
  prop, and the track holds no timezone of its own.
- **No range control**, per §4. The window is derived and fixed; the 7-day cap and wider history
  belong to the forecast-accuracy phase.
- **No coverage or data-density on the track.** The orphaned `coverage` (OPEN 7) has an obvious
  home here — shading where values are thin — but it needs the map fan-out first and is a
  presentation decision nobody has taken.
- **The map corner's `ButtonGroup` still prints the selected time.** Track D flagged it as a
  Wave 4 trim; the track makes it redundant twice over rather than once.
