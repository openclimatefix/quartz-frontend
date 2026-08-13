# Phase 6 followup, Track O — tethering the reading, and making the line carry meaning

**Working mock. Not committed — everything below is in the working tree for Brad to drive and
react to.** Two changes, both against the footer: (1) the focused country's reading now rides
with the handle, and (2) the scrub track's line encodes daylight, midnight, NOW and past/future,
ranked so it does not turn to mud.

## 1. Tethering the reading

**Revised.** The first pass of this track left the reading at Track N's fixed position left of
the track and argued that was close enough to "tethered." Brad's own words on why that was wrong:
"the times changing on one side of the footer don't immediately click as tethered to where the
cursor is on the scrub line" — a fixed position is the problem this item was naming, not a
solution to it. Built properly below.

The focused country's reading (country chip + local time) no longer renders in
`cursor-readout.tsx`'s row at all. It now renders inside `scrub-track.tsx`, positioned at the
handle's own `left: ${cursorFraction * 100}%` and reading `cursor` — the exact same
drag-local-or-committed value the handle itself derives from. There is no second position
variable: the label moves because it is computed from the same value, on the same render, as the
handle. During a drag that value is `dragInstant`, updated at pointer rate outside the
rAF-coalesced commit, so the label tracks the finger, not the throttled `selectedISOTime` — it
cannot lag the handle because it's driven by the same expression the handle's `left` is.

**No easing.** No `transition` class anywhere near it; it snaps exactly like the handle does,
including on a focus change (new zone, new cadence, new x — all at once, deliberately visible per
the contract).

**Clamped without overflow.** The label's own `left` is a percentage on `[0,1]`, so it never sits
outside the track's box, but its *text* can — a right-aligned time near the far edge would clip
off the container. It re-anchors via `transform: translateX(...)`: centred (`-50%`) in the
middle, flush-left (`0%`) within the first 10% of the track, flush-right (`-100%`) within the
last 10%. That 10% figure (`LABEL_EDGE_ANCHOR_FRACTION` in `scrub-track.tsx`) is a **guess**,
untested against a real narrow footer — it may need to be wider or narrower once Brad can see it
overlap (or not) with the track's own edges.

**Cheap by construction, not by special-casing.** The label's value
(`formatISODateStringAsZonedTime(slotForInstant(cursor, focusedCountry), zone, DEFAULT_LOCALE)`)
is plain string formatting — no DOM measurement, no ref, no effect — computed inline in the same
render that already moves the handle on every pointer event. It adds one more small computation
to a render that was already happening at pointer rate; it does not introduce a new one.

**Where it sits relative to the strip's five-layer hierarchy:** it is not a sixth ranked layer —
it's text riding *above* the strip's own box (`-top-5`), not a mark drawn *on* the strip. In paint
order it sits between layer 4 (the handle) and layer 5 (NOW), so if the cursor and NOW ever
coincide, NOW's white line still paints on top and stays legible; the reading and NOW's own small
"now" label could still visually crowd each other in that same case since both are text near the
same spot — flagged below, not fixed, since it needs eyes on a real screen to know if it matters.

**The row.** `otherCountries` in `cursor-readout.tsx` already filtered the focused country out
(Track N) — checked, and it still holds unchanged. So the focused country now appears exactly
once, at the handle, and the demoted UTC value and the other enabled countries' `+15m`-style
slots stay exactly where Track N put them in the row.

## 2. The strip's five layers

`scrub-track.tsx`'s track went from ~28px (a single 3px line plus a handle) to a 40px strip with
five layers, drawn in this order (later DOM siblings paint over earlier ones — no `z-index`
anywhere, so **paint order is the hierarchy**):

1. **Daylight shading** (softest, bottom) — `bg-ocf-yellow/[0.06]` bands, from
   `useCursorRange`'s new `daylight` field. **Guess**: the opacity (6%) and the yellow tint
   (rather than white) are mine; it needs to be visible enough to read as "day" against the
   black footer without competing with anything above it.
2. **Past/future contrast** — unchanged in substance from before this track: one 3px line,
   brighter (`white/30`) left of NOW, dim (`white/10`) the full width underneath. Not a second
   fill, exactly as asked.
3. **Midnight hairlines** — `lib/time/ticks.ts`'s new `midnightInstants(startMs, endMs, zone)`,
   a 1px `white/20` line spanning most of the strip's height. It reuses the exact day-walking
   code `tickInstants` already used (extracted into a shared `walkDays`), so it is guaranteed to
   land on the same instants as `TrackTicks`' own midnight labels — pinned by a test that asserts
   `midnightInstants` equals the hour-0 subset of `tickInstants(..., "midday-midnight")`.
4. **The handle** — unchanged yellow bar, now 24px tall inside the 40px strip.
5. **NOW** (strongest, top, drawn last) — a full-height 1px pure-white line with a bold white
   label, replacing the old gray tick+label. This is the one thing I deliberately made *stronger*
   than the handle to satisfy the stated hierarchy: full track height plus solid white against
   the handle's saturated-but-partial-height yellow bar. **Guess**: whether NOW should outrank
   the handle by height, color, or both is Brad's to react to — I went with both because a single
   channel felt too subtle to survive four other layers underneath it.

All the colors/opacities/heights above are guesses tuned by eye reading the JSX, not against the
running app — Brad should treat every value in this section as a dial, not a decision.

## What "daylight" is, precisely

`components/shell/scrub-scale.ts`'s new `deriveDaylightWindows(values)`: a run of consecutive
points with `powerMw > 0` becomes one window from the *previous* point's `timeUtc` (points label
period-end, so that previous point is where the positive period actually started) to the last
positive point's own `timeUtc`. A `null` or non-positive value breaks the run rather than
bridging it — a gap in the data reads as "nothing known here," never as an assumed continuation.
No astronomical calculation, no separate request: it runs over the same `values` array
`use-cursor-range.ts` already reads to build `range`, inside the same `useMemo` keyed on
`forecast.data`, so a drag never recomputes it — only new forecast data does.

`useCursorRange()`'s return type changed shape: `CursorRange | null` is now
`{ range: CursorRange; daylight: DaylightWindow[] } | null`. Both test mocks
(`scrub-track.test.tsx`, `cursor-readout.test.tsx`) were updated for the new shape.

## What I left out, and why

- **The delta-view "no delta can exist" shading right of NOW** (the brief's optional, lowest
  priority item). Skipped. The strip is already at five layers against a stated four-layer budget
  ("NOW, handle, hairlines, past/future, daylight"); a sixth encoding — even one gated to
  `comparison !== null` — is exactly the kind of addition the brief warned would turn it to mud.
  If Brad wants it, the natural spot is a very subtle diagonal-hatch or reduced-opacity mask over
  the future half specifically in delta mode, sitting between layers 1 and 2 in strength — but I
  did not want to add a fourth still-life to a strip explicitly built to avoid that.
- ~~Re-deriving the readout's tether.~~ **Built** — see the revised §1 above. The first pass of
  this doc wrongly treated Track N's fixed position as sufficient; it was not, and Brad said so.

## Traps avoided

- **No position state added.** The handle is still `dragInstant ?? selectedISOTime`; the new
  layers derive purely from `scale`, `zone`, and `daylight` — none of them read `dragInstant` or
  `cursor`, so nothing added recomputes during a drag beyond what `cursorFraction` already did.
- **No offset arithmetic.** `midnightInstants` reuses `tickInstants`'s day-walking (`.set({hour})`
  per calendar day in the target zone), and `deriveDaylightWindows` never touches a timezone at
  all — it works entirely in the UTC instants the series already carries.
- **Daylight/midnight computed via `useMemo` keyed on stable inputs** (`scale`, `daylight`,
  `zone`), never on `dragInstant` — verified by reading the dependency arrays, not just asserting
  render counts.

## Tests

**+11, additions only**, baseline 1147/51 → **1159/51**. Unchanged by the tether revision: moving
the reading into `scrub-track.tsx` and removing it from `cursor-readout.tsx` is a pure rendering
move with no new pure arithmetic — `slotForInstant`/`formatISODateStringAsZonedTime` are already
pinned where they're defined, and `cursorFraction`/`cursor` already drive the handle under
existing tests. `cursor-readout.test.tsx`'s "focused country not shown twice" assertions
(`getAllByText("GB")` length 1) still pass unmodified — the count didn't change, only where the
one match comes from — which is itself evidence the row-level de-duplication still holds.

- `components/shell/scrub-scale.test.ts` (+7): a single daylight run windowed correctly; a day
  with no daylight at all (empty result); a run still open at the series' end; a gap of `null`
  values breaking one run into two rather than bridging it; fewer than two points producing no
  window; past/future fraction ordering around NOW; NOW outside the window clamping the same way
  any other instant does.
- `lib/time/ticks.test.ts` (+4): `midnightInstants` agrees with the midnight half of
  `tickInstants`'s own `"midday-midnight"` density; reads local (BST) midnight, not UTC; survives
  the same October DST transition `tickInstants` is pinned against; an inverted/empty range
  yields nothing.

No visual/weight test, per the brief — the hierarchy, and now the tethered label's exact position,
are Brad's to judge by eye. Pointer-rate label tracking specifically has no oracle here for the
same reason the drag model's frame-rate handle motion didn't in Track H: jsdom's zero-width
`getBoundingClientRect` makes a synthetic drag exercise the fallback path, not the real
conversion.

## Verification (from `apps/nowcasting-app`)

- `yarn tsc --noEmit` — clean, only the known pre-existing `jest.globalSetup.ts(14,1) TS1208`.
- `npx next lint` — 0 errors; warnings unchanged from baseline, none in any file this track
  touched.
- `npx jest` — **1159 passed / 51 suites**, unchanged by the tether revision (relocation, not new
  logic).
- `next build` not run, per the brief.

## For Brad to react to

- Is the 40px strip height right, or does it eat too much footer for what it buys?
- The daylight tint: yellow-at-6%, or should it be a neutral white wash instead — yellow doubles
  as the handle's own color, which may or may not be a problem at this opacity.
- Does NOW actually read as the strongest mark against the handle now, or does the yellow handle
  still win the eye on a real screen?
- Whether the midnight hairlines are visible enough at `white/20` against the black footer, or
  lost entirely once daylight shading and the past/future line are also present.
- Whether the skipped delta "no-delta" region is worth a follow-up track, given it's the thing
  the brief says "would have saved a real debugging session."
- **New, from the tether:** the 10% edge-anchor threshold (`LABEL_EDGE_ANCHOR_FRACTION`) — does
  the label re-anchor at the right point, or does it clip/overflow before that, or re-anchor too
  early and look like it's avoiding the edge unnecessarily?
- **New, from the tether:** the label sits `-top-5` above the strip, inside the footer's existing
  `py-2` — check it isn't clipped or crowding the row above it on a real screen; I could not
  verify this without eyes on the running app.
- **New, from the tether:** when the cursor sits at or very near NOW, the tethered label and
  NOW's own small "now" text both occupy the same small vertical band and may crowd each other —
  not fixed, since resolving it well needs to be judged against the real thing.
