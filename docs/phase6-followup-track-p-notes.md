# Phase 6 followup, Track P — the play button moves into the footer, and stops fighting "now"

## The two modes, and why they're different things

Two ways the cursor moves on its own, and the brief's whole point is that they are not the same
thing wearing two names:

- **Playing** — `components/play-button/index.tsx` walks the cursor forward a slot at a time on
  its own `setInterval` (in a ref), with `isPlaying` in global state as the flag anything else
  reads.
- **Following now (live)** — `use-and-update-selected-time`'s 60-second interval pins the cursor
  to the current slot. Its existence *is* the mode: recorded in the `intervals` global,
  started/stopped by `resetTime`/`stopTime`. The footer's `now` button (`scrub-track.tsx`) is the
  control; the orange dot on the tethered tag (Track O) is the state.

## Mutual exclusion, both directions

- **Playing stops following** — already true (`play()` calls `stopTime()`), unchanged.
- **Following stops playing** — the missing direction, added in `play-button/index.tsx`:
  ```ts
  const [intervals] = useGlobalState("intervals");
  useEffect(() => {
    if (intervals.length > 0 && isPlaying) pause();
  }, [intervals]);
  ```
  This reads the same `intervals` global `scrub-track.tsx`'s `isLive` already reads, rather than
  inventing a third notion of "moving on its own." Clicking `now` calls `resetTime()`, which
  clears then restarts the interval (new non-empty `intervals` array) — the effect above sees
  that transition and pauses playback if it was running. No edit to
  `use-and-update-selected-time.tsx` was needed or made.

## Placement and the seam

`PlayButton`'s prop contract (`startTime`/`endTime`, both required strings) is **unchanged** —
no optional-props flag was needed. Instead:

- `cursor-readout.tsx` now calls `useCursorRange()` itself (the same hook `scrub-track.tsx`
  calls) and renders `<PlayButton startTime={rangeData.range.start} endTime={rangeData.range.end} />`
  to the *left* of the track, only once that data exists (mirrors the track's own "inert until
  real data" rule — no button, not a guessed range, while loading).
- `solar-site-view/solar-site-chart.tsx` keeps its own explicit `startTime`/`endTime` derivation
  from the sites forecast data, unchanged.

Both call sites just pass different explicit values into the same component — that's the whole
seam, no flag inside `PlayButton` itself.

## `/sites` — kept, and now different from the dashboard

`/sites` has no footer and no scrub track (confirmed: `CursorReadout` is only mounted in
`components/shell/dashboard-shell.tsx`, not in `pages/sites.tsx`). Removing its play button there
would have taken away a feature it has no replacement for, so **it stays mounted, unchanged, in
`solar-site-chart.tsx`**. It shares the same (now much smaller) `Ui` component as the footer's
instance, so it also shrank from the old full-height yellow block to a small bordered icon
button — that visual change is unavoidable since there is one `Ui`, but the mount and its props
are untouched. **Brad: `/sites` now has a materially different time control from the dashboard**
(a lone play button, no scrub track, no "now" button, no tethered reading) — worth deciding
whether that route eventually grows a footer of its own, per the brief.

## Removed

Both dashboard mounts came out of `components/charts/forecast-header/index.tsx` (the `deltaView`
branch and the plain branch). Cleanup that fell out of removing them:
- `getCursorNow` import and the whole `useGlobalState` import (now unused) dropped from that file.
- `forecastEndTime` (only ever fed the removed `PlayButton`) dropped.
- `ForecastHeaderUI`'s `children` prop made optional in `forecast-header/ui.tsx` — the non-delta
  branch now renders `<ForecastHeaderUI ... />` with no children at all.

## Visual

`components/play-button/ui.tsx` rewritten: a 24×24px bordered icon button
(`h-6 w-6 rounded border border-white/10 text-ocf-yellow`), matching the footer's existing weight
(the `now` button's border/hover treatment, the grain value's understatement) rather than the old
`w-14 h-14`/`dash:h-full` yellow block. Native `<button>` (keyboard-operable for free), with
`aria-label`/`aria-pressed`/`title` following the exact pattern `now` already set
(`aria-label="Play"`/`"Pause"`, `aria-pressed={isPlaying}`).

## Files touched

- `components/play-button/index.tsx` — mutual-exclusion effect added, doc comment.
- `components/play-button/ui.tsx` — rewritten, small footer-weight control.
- `components/play-button/index.test.tsx` — new.
- `components/shell/cursor-readout.tsx` — mounts `PlayButton`, calls `useCursorRange()`.
- `components/shell/cursor-readout.test.tsx` — new describe blocks (range-wiring, not-rendered-
  until-data).
- `components/charts/forecast-header/index.tsx` — both `PlayButton` mounts removed, dead
  imports/vars cleaned up.
- `components/charts/forecast-header/ui.tsx` — `children` made optional.
- `components/hooks/use-and-update-selected-time.tsx` — **not touched.**
- `components/charts/solar-site-view/solar-site-chart.tsx` — **not touched** (mount kept as-is).

## Tests

**+5 tests, +1 suite**, baseline 1168/51 → **1173/52**.

- `play-button/index.test.tsx` (new, 3 tests): starting playback clears the following interval;
  resuming following (via the real `resetTime`, not a direct write to `intervals`) pauses an
  in-progress play; clicking `now` while not playing is a no-op for `isPlaying`.
- `cursor-readout.test.tsx` (+2): playing one tick from `range.end` wraps to `range.start` —
  proves the button's `startTime`/`endTime` are exactly what `useCursorRange()` returned, not a
  separately computed range; the button is absent (not disabled — absent) until `useCursorRange`
  has data, mirroring the track's own idle state.

No test on the small-icon visual weight or on real timer cadence, per the brief.

## Verification (from `apps/nowcasting-app`)

- `yarn tsc --noEmit` — clean, only the known pre-existing `jest.globalSetup.ts(14,1) TS1208`.
- `npx next lint` — 0 errors, 16 warnings (unchanged from baseline, none in any file this track
  touched).
- `npx jest` — **1173 passed / 52 suites**.
- `next build` not run, per the brief.

## For Brad to check by hand

- The button's small size/border against the rest of the footer row — no visual-weight test
  exists for this by design.
- That the row still reads as one line: zone stack, grain, play button, track, all on one baseline
  in a real (possibly narrow) footer.
- `/sites`' shrunk play button — it's now a small icon rather than the old yellow block; confirm
  that's acceptable there too, or whether that route wants its own restyle once it gets a footer.
- Play → click `now` → confirm playback visibly stops (not just the flag) and the cursor jumps to
  now and keeps advancing.
- Scrub while playing, then let go — the existing "drag beats play" behaviour (`scrub-track.tsx`'s
  `beginUserInput`) is unchanged, but worth a real click-through given how close this track sits
  to the same mechanism.
