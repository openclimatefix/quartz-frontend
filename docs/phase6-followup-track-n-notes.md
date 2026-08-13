# Phase 6 followup, Track N — the footer's local time, and its second row

Two of Brad's asks against one small surface: slim the footer, and stop making every reader do
UTC arithmetic to place the cursor in the day. Both land in `components/shell/cursor-readout.tsx`
and `components/shell/scrub-track.tsx`; `scrub-scale.ts` and `lib/time/ticks.ts` needed no change
— the zone was already a prop the track took and held no timezone of its own, exactly as Track H's
notes flagged when they deferred this.

## The layout

Before: two stacked rows — the readout (full width) above `ScrubTrack` (full width, itself two
visual lines: the bar, then the ticks below it).

After: one row. `CursorReadout` is now a flex row with the compact readout as one child and
`ScrubTrack` as a second, `flex-1` child filling the rest of the width. `ScrubTrack`'s own
`px-4 pb-2` wrapper became a bare `pb-2` — the horizontal inset now comes once, from the footer,
rather than twice (footer `px-4` plus the track's own). The track's tick row is still its own line
underneath the bar, but it is now only as wide as the track itself rather than the whole footer,
since it is no longer a sibling of the readout, it's a child of the same flex-1 column the bar is
in. Net: the footer lost one full row of height, and the tick row shrank to the track's own width
— which is exactly the case Track J's density rule was built for ("a narrower track legitimately
shows fewer ticks"). Nothing in `ticks.ts` or `selectAxisTicks` changed; `TrackTicks` already
measured its own container via `ResizeObserver`, so it just sees a smaller number now.

I did not try to also compress the two-line internals of `ScrubTrack` itself (bar + ticks into
one line) — the ticks need the bar's full pixel width to align under, and Track H already pinned
that as separate DOM. Merging those two felt like it would fight the DST/hysteresis machinery for
no real height win; the row that actually cost height was the readout's, and that's gone.

## The zone

`READOUT_ZONE = "UTC"` is deleted. `CursorReadout` now computes
`getCountryConfig(useFocusedCountry())?.timezone ?? DEFAULT_TIMEZONE` and passes that to
`ScrubTrack zone={focusedZone}` — the same registry lookup the file already used for every other
country's slot, so no new pattern. `ScrubTrack` itself required no change: its `zone` prop already
drove `TrackTicks`' local-calendar ticks and the `aria-valuetext` cursor label; only the value
arriving from its caller changed.

**Cadence and zone move together because they always shared one root cause.** `ScrubTrack` derives
its cadence from `cursorCadenceMinutes(useFocusedCountry())` internally — it does not take cadence
as a prop — so both the grid the handle steps on and the zone its labels are read in come from the
same `focusedCountry` global on the same render. There is no way for one to update a render behind
the other; they are not two facts kept in sync, they are one fact (which country is focused) read
twice from the same hook. This was already true before this track — Track B keyed cadence on focus
for the same "must not jump" reason — I only had to stop overriding the zone half with a constant.

## What's on screen, and the order

Left to right, in the readout's compact block:

1. `CURSOR 12:00 UTC` (`live` appended when the cursor sits on "now") — demoted to
   `text-2xs text-ocf-gray-600`, where the whole readout row used to be `font-semibold text-white`.
   UTC is still there, unconditionally, per the brief ("the canonical instant, stays visible,
   stops being the headline"). Nothing about UTC is hidden or requires a hover — it just isn't the
   biggest text in the row any more.
2. `30-minute steps` — the cadence, unchanged position and styling.
3. Every *other* enabled country's slot (`CountrySlot`, unchanged component) — same local time +
   `+15m`-style lag marker as before. The focused country is filtered out of this list
   (`enabledCountries.filter((code) => code !== focusedCountry)`), because it would otherwise be
   the same instant shown twice a few pixels apart.
4. The focused country's own reading, primary: a small yellow country-code chip plus the local
   time in `text-sm font-semibold text-white` — the biggest text in the row, and the last thing
   before the track starts. That's "near the handle" as asked: the track is the very next element
   in the flex row, so the primary reading and the thing it's the label for sit shoulder to
   shoulder regardless of where the handle itself currently is along the bar.

The focused reading resolves through `slotForInstant(selectedISOTime, focusedCountry)`, the same
call every `CountrySlot` makes — not the raw `selectedISOTime` — so a viewer comparing the primary
number against another country's row in the same footer is comparing two things computed the same
way. (In practice these are almost always equal, since the cursor already sits on the focused
country's grid; the exception is the moment focus itself just changed but a re-render hasn't
resnapped yet, and `slotForInstant` is what keeps the display honest either way rather than
showing a raw instant that doesn't match anyone's slot.)

## What I rejected

- **Putting the country-code chip on the track's own aria label instead of the readout.** The
  slider's `aria-label`/`aria-valuetext` already carries the grain and the zone-qualified time
  (`"Time cursor, 30-minute steps"`, `"Tue 11 Aug 13:00 Europe/London"`); duplicating the code
  there felt like solving a problem the readout row already solves visually, for no accessibility
  gain — a screen reader user tabs into one control and reads one value.
- **Collapsing UTC into a tooltip.** Considered it as a way to buy back more width, but the brief
  is explicit UTC "should remain visible", and a hover-only value on a control meant to be read at
  a glance (a control-room wall, Brad's own persona list) is the opposite of that.
- **Keying the axis zone off something other than focus** (e.g. the coarsest enabled country, or a
  user preference). Not asked for, and it would decouple the axis from the cadence, which is
  exactly the "must not jump" trap the brief calls out — the two need one source, and focus is
  already that source for cadence.

## DST

No new arithmetic was added; this track's whole change is *which* zone string gets passed into
code that already handled DST correctly. `formatISODateStringAsZonedTime` (used for both UTC and
the focused-primary line) and `slotForInstant`/`tickInstants` (used by `TrackTicks`) are unchanged.
Verified anyway: `cursor-readout.test.tsx` asserts GB's 12:00 UTC reads as 13:00 local on 11 Aug
2026 (BST, UTC+1) and, once focus moves to NL, the same instant reads 14:00 (CEST, UTC+2) — two
different offsets off one instant, which is the whole point of a per-country zone. The existing
DST-crossing tests in `lib/time/ticks.test.ts` and `lib/time/cursor.test.ts` were untouched and
still pass; nothing here re-derives an offset by hand.

## Tests

**+5, `components/shell/cursor-readout.test.tsx` (new file).** No prior test existed for this
component. Pinned:

- the track's `aria-valuetext` reads in the focused country's zone (GB by default, 13:00 for a
  12:00 UTC cursor in BST);
- switching focus to NL moves the zone *and* the cadence together — `aria-valuetext` shows 14:00
  (CEST) and `aria-valuemax`'s accessible name reports "15-minute steps", not 30;
- UTC stays on screen, unconditionally, in its own line;
- the focused country is not double-rendered — `getAllByText("GB")` is length 1 whether NL is also
  enabled or not, while NL still gets its own `CountrySlot` when enabled.

I did not add a visual/layout test — per the brief, visual density and drag feel have no oracle
here and are Brad's to judge by eye.

## Verification

From `apps/nowcasting-app`:

- `yarn tsc --noEmit` — clean in every file this track touched. (One unrelated failure was present
  mid-run in `components/map/country-coverage.test.ts` — Track M's file, concurrently in progress
  — and had cleared by the time of the final check; not this track's.)
- `npx next lint` — **0 errors, 0 warnings in the touched files**; one prettier formatting error
  was introduced and fixed in `cursor-readout.tsx` during the work. Remaining lint output in the
  final run is entirely in `components/map/*` (Track M).
- `npx jest` — **1147 passed / 51 suites**, from the 1132/49 baseline: +5 from
  `cursor-readout.test.tsx`, the rest from Track M running concurrently.
- `npx next build` — compiles and generates all pages, exit 0.

## What Brad should check by eye

- **The footer is visibly one row shorter.** Compare against the pre-track screenshot/live pass —
  the readout no longer occupies its own full-width band above the track.
- **The primary time is the biggest, whitest text in the footer, and sits immediately left of the
  track**, not off at the far right where the country list used to be pushed by `ml-auto`.
- **UTC is still there and still legible**, just smaller and grayer than the primary reading —
  confirm it doesn't read as "hidden" or require hunting.
- **Switch focused country (GB ↔ NL) and watch three things move together**: the primary reading's
  time, the primary reading's country chip, and the track's tick labels (they should re-anchor to
  the new country's midnight/6am/noon rather than staying on the old country's). The handle itself
  should **not** visibly jump — it's still derived from `selectedISOTime`, unaffected by the zone
  the label is drawn in.
- **Narrow the window (or open the display rail) until the track is tight.** Tick density should
  still collapse to midnight/midday as before; the readout block wraps onto a second line if it
  runs out of room rather than crushing the track to nothing (it's a sibling flex item with its
  own `flex-wrap`, not `flex-1`, so it takes only the space its content needs).
- **Enable a second country and confirm its row still shows the `+15m`-style lag** where its
  cadence is coarser than the cursor grid — this substance was not supposed to change, only its
  position and the fact that the *focused* country no longer appears in that list alongside it.
