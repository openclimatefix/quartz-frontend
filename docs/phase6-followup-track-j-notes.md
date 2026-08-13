# Phase 6 followup, Track J — one tick rule for two time axes

Brad's brief, verbatim: fix the chart's x axis ticks and the scrubber's ticks to only show
6-hourly increments when there is room, and midnight/midday only when there is not. Two
surfaces, one rule — so the substance of this track is the rule itself, not either component.

## The rule, and where it lives

`lib/time/ticks.ts` (new, alongside `cursor.ts`) is the one place "enough space" is decided.
Two exports:

- **`tickInstants(startMs, endMs, zone, density)`** — the calendar walk. For each whole day the
  range touches, it constructs the labelled local hours (`[0, 6, 12, 18]` for `"six-hourly"`,
  `[0, 12]` for `"midday-midnight"`) directly with Luxon's `.set({ hour })`, one day at a time,
  rather than repeatedly adding a fixed duration from a start point. That distinction is the
  whole reason this isn't three lines of `Array.from`: a day is not always 24 real hours (GB and
  NL both observe DST), and adding a fixed 6-hour duration across the transition drifts every
  later tick off the clock hour — wrong on exactly the two days a year it matters, and correct
  every other day, which is the same silent-plausible shape `lib/time/cursor.ts`'s module doc
  warns about. Constructing each hour independently sidesteps that entirely.
- **`selectAxisTicks({ startMs, endMs, zone, widthPx, previousDensity })`** — the space decision.
  It computes the pixel gap a 6-hourly tick set would have (`widthPx / (tickCount - 1)`) and
  runs it through a Schmitt trigger: coming from `"six-hourly"`, space has to drop **below 44px**
  before it demotes to `"midday-midnight"`; coming from `"midday-midnight"`, space has to climb
  **to 60px or more** before it promotes back. The 16px gap between the two thresholds is the
  hysteresis band — a resize sitting near the boundary cannot flip the density every frame,
  because it would have to cross the whole band, not a rounding error, to do so. First render
  (`previousDensity: null`) uses the wide threshold, so an unmeasured width — which reads as
  0px before the first layout pass — starts narrow rather than flashing a dense label set with
  nowhere to put it.

Both callers hold the chosen density in a `useRef` between renders and pass it back in as
`previousDensity`, which is what makes the hysteresis persist across resizes rather than
resetting every time `widthPx` changes.

Tested in `lib/time/ticks.test.ts`: the plain 6-hourly and midnight/midday tick lists, that
ticks are local-zone (a BST midnight is 23:00 UTC the day before — asserted explicitly), a day
crossing GB's October DST transition (every emitted tick still lands on a clock-hour boundary,
none drift), the empty/inverted range, and the boundary itself — narrowing past 44px, widening
back to just below 60px (must **not** flip, proving the hysteresis band actually holds), then
past 60px (must flip).

## Where width comes from

Both `components/charts/remix-line.tsx` and `components/shell/scrub-track.tsx` measure their
own container with a `ResizeObserver` on a wrapping div, guarded by
`typeof ResizeObserver === "undefined"` (jsdom has none, so the guard is what keeps the existing
test suites running without a polyfill — width just stays 0 there, which resolves to
`"midday-midnight"` and doesn't touch any existing assertion, since neither suite checked tick
label text before this). This was the explicit ask over `window.innerWidth`: the floating chart
resizes with `CHART_SPLIT`, the display rail's open/close reflows the inset, and dashboard mode
changes both — none of which move the browser window.

## What reaches which chart

`RemixLine` is shared by the national chart, the GSP sub-chart, and the delta chart, all of
which render the **category** x axis (`isSitesChart` false) — that branch is what changed.
Previously it used a hardcoded `interval={11}`, which is "show every 12th tick" and only means
6 hours if the data cadence is 30 minutes; it silently meant something different for a 15-minute
country and was never conditioned on that, just quietly wrong for NL. It's now `categoryTicks`
— the selected instants translated back into the `formattedDate` strings Recharts' category axis
requires (which always exist, since GB and NL both sit on whole-hour UTC offsets, so a local
day/6-hour boundary always lands on the data's cadence grid) — with `interval={0}` so nothing
downsamples them further, falling back to the old `interval={11}` only if no tick could be
resolved (e.g. before the first data fetch).

`components/charts/solar-site-view/solar-site-chart.tsx` renders `RemixLine` too, but with
`isSitesChart` true, which takes the **numeric** axis branch — a separate, pre-existing
`ticks`/`domain` pair built from fixed hourly offsets around "now" (`-24` to `+60` in steps of
6). That branch already shows 6-hourly ticks unconditionally and was left alone: it doesn't
share the category branch's cadence bug, and touching its "now" arithmetic (which is in the
viewer's local time, not the country's zone — a real but separate pre-existing wrinkle) risked
the domain-span constraint ("no change to what the axes span") for a rule the sites chart
already mostly satisfies. **Flagging for Brad**: the sites chart never falls back to
midnight/midday no matter how narrow it gets, and its 6-hour boundaries are anchored to the
viewer's clock rather than the country's — worth a follow-up track if it's visibly wrong in
practice, but out of scope here.

The scrubber's `TrackTicks` (`components/shell/scrub-track.tsx`) replaces its old fixed
`TICK_COUNT = 5` evenly-spaced marks (which weren't clock-aligned at all — just fractions of the
window) with `selectAxisTicks` over `scale.startMs`/`scale.endMs`, i.e. `useCursorRange()`'s
window, which is a different range from the chart's and passed in as such — the helper takes
both surfaces' ranges as plain numbers and assumes nothing about where they came from.

## Verification

From `apps/nowcasting-app`:

- `yarn tsc --noEmit` — clean, bar the pre-existing `jest.globalSetup.ts(14,1) TS1208`.
- `npx next lint` — **16 warnings / 0 errors**, matching baseline exactly (no new warnings from
  either changed file).
- `npx jest` — **1095 passed / 46 suites** (baseline 1085/45 + the 10 new `lib/time/ticks.test.ts`
  cases). `components/shell/scrub-track.test.tsx` and `scrub-scale.test.ts` both still pass
  unchanged — neither asserted on tick label text, so the rewrite didn't need to touch them.
- `next build` — compiles successfully, static pages generate; no `sentry-cli` failure observed
  in this run.

## What to check by eye

- The national/GSP/delta chart at a normal floating-chart width: 00:00/06:00/12:00/18:00 labels,
  evenly spaced, no overlap.
- Narrow the floating chart (`CHART_SPLIT` toward the map, or open the display rail) until it's
  tight: labels should collapse to just midnight and midday, and should not flicker between the
  two densities while dragging the resize handle slowly through the boundary.
- Switch the focused country to NL (or enable both GB and NL) and confirm the chart's ticks land
  on Dutch local midnight/6am/noon/6pm, not GB's or UTC's — should be visibly off by an hour
  outside CEST/BST-aligned months if this is wrong, since NL is UTC+1/+2 and GB is UTC+0/+1.
- The scrub track under the footer: same 6-hourly/midnight-midday behaviour as the display rail
  opens and closes.
- A day GB or NL crosses a DST boundary (nearest real one: 25 Oct 2026, GB clocks back) — ticks
  should still read on the clock hour either side of the transition, not drift by an hour.
