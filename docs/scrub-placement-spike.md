# Scrub placement: in the chart, or in the shell?

Dan asked whether the time slider could live inside the chart card rather than docked to the
bottom of the window. This is the spike that answers it by building it, plus the case for
leaving it where it is.

**How to see it.** `?scrub=chart` on the dashboard URL; without the flag nothing changes. The
flag is `components/shell/use-scrub-placement.ts` and every edit behind it is additive, so the
spike deletes cleanly whichever way the call goes.

Under the flag the footer is gone entirely and its three parts have moved:

| | before | after |
|---|---|---|
| scrub track + play | full-bleed footer, bottom of the window | inside the chart card, between the plot well and the legend, inset to the plot's x-axis |
| zone stack (date, UTC, per-country periods) | left of the track in the footer | its own card at the **bottom** of the map control dock, diagonally opposite the chart |

Files: `chart-scrubber.tsx` and `zone-stack.tsx` are new; `remix-line.tsx` publishes the plot
insets; `pv-remix-chart.tsx` and `delta-view-chart.tsx` each gain one conditional mount.

## The alignment works, and it took two fixes to get there

**The chart hands the track its domain.** The first attempt let the track keep deriving its own
window from `useCursorRange`, on the reasoning that it runs the same query the chart runs, so
the ends had to agree. They did not, and the track visibly reached back past the axis above it:
the chart plots a *merge* of that forecast with generation and drops every point whose value is
null (`use-format-chart-data.tsx`'s `fromTimeSeries`), so its first plotted key is not the
forecast series' first value. `plotted-domain.ts` reads the **earliest and latest** key of what the chart
actually plots and hands it to `ScrubTrack` as a `range` override — one derivation instead of
two, so the ends are the same fact rather than the same intention.

Earliest and latest, not first and last: reading position 0 left the track about eight hours
short at the start in GB, and that is what surfaced the finding below. The shell footer keeps the
hook, since a footer that outlives the chart swap cannot take its domain from whichever chart
happens to be mounted.

The scale between those ends is linear in time on the track and *by index* on the chart —
recharts plots the national chart on a category axis. Those agree while the plotted points are
evenly spaced, which they are at a single cadence, and would drift in the middle if a gap opened
in the merged series. Worth knowing before trusting it to the pixel.

**And the chart had to say where its plot area is.** Recharts will not report where its plot area starts once laid
out, so the track has to reconstruct it, and both halves of that sum were implicit: the left
margin was a literal in the `margin` prop and the Y axis width was recharts' undeclared 60px
default. `remix-line.tsx` now names both (`CHART_Y_AXIS_WIDTH_PX`, `CHART_MARGIN_LEFT_PX`,
summed as `PLOT_INSET_LEFT_PX`) and the `YAxis` reads its width from the constant instead of
inheriting it — so changing a margin moves the track with the axis rather than away from it.

The play button ended up in the Y-axis gutter, which is the one piece of luck in the layout:
the space reserved for the axis labels is exactly the space a transport control wants, and was
otherwise empty.

**Two places the alignment is approximate, both left visible rather than papered over:**

1. **Delta view's right edge is out by ~45px.** It mounts a second `YAxis` on the right and
   shrinks its own right margin to fit. Correcting for it would mean the scrubber knowing which
   chart it is under, which is the shape of thing Phase 6 has been removing.
2. **Zoom breaks it.** `RemixLine`'s zoom narrows the plotted domain while the track keeps
   drawing the full window, so a zoomed chart lines up with a track that no longer shares its
   scale — ticks agreeing by position and disagreeing by value, which is worse than not lining
   up. The fix is for the track to draw the zoom window as a band on itself; that is a design
   question, not a measurement.

## It fits. That is not the question.

The row goes in without a fight, because the chart card is already a flex column and the footer
is already one row. Nothing had to be redesigned or dropped to make it sit there.

What it costs is width, and the width is not the chart's to give.

## The min width, and where the number comes from (measured before the zone stack moved out)

Left to right, the row is: the zone stack's fixed cells (20px country code + 6px gap + 72px
period span = 98px), the play button (28px), two 12px gaps, the track's own `min-w-[140px]`,
and 16px of card padding either side. **322px** — one pixel over the chart's existing floor of
`MIN_CHART_WIDTH_PX` (320).

So at the chart's current minimum, the axis gets 140px to draw two days across. `selectAxisTicks`
handles that gracefully by design: it walks its density ladder and drops to `midnight-only`, so
the axis reads `00:00 … 00:00` and nothing else. The control still works; it stops telling you
where you are.

For the axis to hold `midday-midnight` across a two-day window it needs roughly 55px per gap,
which puts the honest floor at **460px** — the value the spike enforces
(`SCRUB_IN_CHART_MIN_WIDTH_PX`). That is **140px of chart width bought by a control that is not
the chart's**, and it turns the chart's resize floor into something set elsewhere: drag the
chart narrow and it now stops early, for a reason that is invisible from the chart.

**Moving the zone stack out fixes most of this.** Without it the row is the play button, two
gaps and the track: ~200px of hard minimum, comfortably under the chart's existing 320px floor,
so the chart's resize floor is its own again. The `SCRUB_IN_CHART_MIN_WIDTH_PX` = 460 floor is
still applied, but now it buys axis legibility rather than making room for a readout — at 320px
the plot area is ~230px and the axis still drops to `midnight-only`.

The height cost drops the same way: from ~48px (four-line stack) to ~34px (strip plus one row
of tick labels), taken from the plot at every chart size in every mode.

## Why the cursor is shell chrome, not chart chrome

Five of these still stand against the in-chart placement. **Moving the zone stack to the dock
answers the third**, and it is worth noticing that it answers it *by taking the global part of
the footer somewhere else global* — which is the shape of the whole argument.

1. **The map reads the cursor too.** Scrubbing repaints the map — that is the whole "one
   instrument, two panes" idea. A control that drives both panes sitting inside one of them
   says the wrong thing about what it does: it reads as an x-axis control for the plot, and
   users will not expect the map to move.

2. **The chart is swapped; the cursor is not.** `pages/index.tsx` mounts either `PvRemixChart`
   or `DeltaViewChart` depending on comparison state. The cursor survives that swap because it
   is mounted a level up. Put it in the card and its lifetime becomes the card's — the same
   class of bug the arrow-key hotkeys had before they moved up to the shell (they worked in
   forecast view and did nothing in delta view).

3. ~~**The row is multi-country, and the chart is one country at a time.**~~ Answered: the
   multi-country half is the zone stack, and it is now a dock card rather than something the
   chart has to house. What is left in the card — track and playback — is genuinely about the
   focused country's axis.

4. **It is where a media player's transport bar is.** Full-bleed, bottom edge, playback at the
   left. It is the one piece of chrome in the app that is about *when*, and it is docked at the
   edge that means "applies to everything above me". Folding it into a card demotes it to a
   card control.

5. **The chart is draggable and resizable; the cursor should not be.** A user who shrinks the
   chart to see more map has not asked for a shorter time axis. Under the spike they get one.

## What Dan is right about

The one thing the current placement does not do well is make the *link* obvious: the footer's
track and the chart's x-axis are the same time domain drawn twice, at different widths, in
different places, and nothing draws that connection. That is a real gap, and it is worth fixing
— but the fix is to tie the two together visually (a shared hover, the chart's visible window
shown as a band on the track), not to move the control into one pane.

## Screenshots to take

Same window size throughout, so the set is comparable:

- `/?scrub=chart` at the default chart width — track under the axis, play in the Y-axis gutter,
  zone stack bottom-right.
- `/?scrub=chart` with the chart dragged as narrow as it goes — the card stops at 460px, and
  the axis is down to midnight ticks.
- `/?scrub=chart` in comparison (delta) view — the right-edge mismatch, and the track sitting
  above the bucket table.
- `/` at the default width, for the before.

## Open, if this direction is taken further

- **Zoom.** Named above; the track needs to show the zoom window or the alignment is a lie.
- **`/sites`.** It has its own chart and its own play button and does not use this shell.
- **The narrow layout.** Below `lg` the chart is full width and bottom-anchored; the scrubber
  goes with it, which is probably fine but is untested.
- Unrelated, spotted while reading: `remix-line.tsx` has two `console.log`s at module scope
  (`chartData`, `DELTA`) firing on every render. Left alone — not this spike's diff.

## Finding: `chartData` may not be in chronological order

`useFormatChartData` builds a `Record` keyed on the timestamp and returns
`Object.values(chartMap)` — **insertion order, never sorted**. It inserts the generation series
first, then the primary forecast, then the comparison models, then the n-hour series.

Generation covers less history than the forecast does. So the array opens at generation's first
point, and the forecast's earlier points — being keys nothing has written yet — are appended
*after* everything generation contributed rather than sorted in front of it. Reading
`chartData[0]` as the chart's start was therefore reading the start of the observed data, which
is what left the track eight hours short.

**It was also resetting the cursor to "now" mid-drag.** `pv-remix-chart.tsx` guards against a
cursor pointing at nothing outside the chart's range, and it read the same two array positions:

```js
const first = chartData[0].formattedDate;                     // generation's first point
const last  = chartData[chartData.length - 1].formattedDate;
if (selectedTime < first || selectedTime > last) setSelectedISOTime(getCursorNow());
```

Once the track spanned the chart's *true* domain, the leftmost several hours of it were
reachable — and every one of them tested as below `first`, so the guard fired, wrote "now", and
the drag wrote the extreme back. That fight is the stutter, and the reason it ended at "now"
rather than at the extreme. The guard now uses `plottedKeyRange`, the same earliest/latest pass.
The comment already above that effect describes an earlier round of the same fight from a
different direction, which is a reasonable sign the array positions were never the right thing
to read.

**The consequence is not confined to the track.** The national chart's x-axis is a recharts
*category* axis, which plots strictly in array order. If those early forecast points really are
sitting at the end of the array, the chart is drawing them at its far right, out of sequence —
and the near-vertical segment at the very left edge of the plot is the kind of artefact that
would produce. It also means the axis is index-spaced over data that is not time-ordered, so
distances along it are not proportional to time.

Not fixed here. Sorting `chartData` changes what the chart draws, which is a change to look at
on its own rather than one to slip into a spike — and it wants checking against the delta view
and the GSP chart, which share the formatter. `isChronological` is exported alongside
`plottedDomain` for whoever picks it up. Worth confirming against live data first: if generation
and forecast happen to start at the same instant for a given country, the array is ordered by
luck and the bug is dormant rather than absent.

## Two fixes that outlive the spike

Both were pre-existing and both would have bitten the next layout change either way.

**Mapbox never resized itself.** The map was leaving a footer's worth of bare ground along the
bottom edge, because Mapbox sizes its canvas once at init and has no way to know its container
moved. Removing the footer grew the stage and the canvas stayed put.

The immediate trigger was mine — `useScrubPlacement` read the flag in a `useEffect`, so every
load rendered the footer once and then unmounted it, and a flag that changes the layout cannot
arrive a frame late. It reads during render now (`useSyncExternalStore`; the page is
`ClientOnly`, so there is no server render to disagree with).

But the underlying gap was already there, and it was being papered over by two guesses:
`resize()` calls on `load` and on `dataloading`, each gated on the canvas being *exactly* 800 or
400 pixels wide. They fired when a mid-init canvas happened to hit one of those numbers and did
nothing at any other size, which is why the symptom came and went. Both are replaced by a
`ResizeObserver` on the element Mapbox renders into, coalesced to one resize per frame so a
chart drag does not re-layout the map on every pointer frame. Any future chrome that changes the
stage's size — the narrow layout, a banner, dashboard mode — is now covered.

**The chart's plot insets were implicit.** Named constants in `remix-line.tsx`, with `YAxis`
reading its width from one instead of inheriting recharts' undeclared default.
