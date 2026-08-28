# Bringing the chart legend back

**Status:** options for review, nothing built. Written 2026-08-17 from Brad's ask — *"the most
efficient, unobtrusive way … something that doesn't need to be there when I don't need it, but
starts off there so I know what things are."*

---

## Where it went, and why that was half right

Track G deleted `ChartLegend` and folded it into the display rail's series toggles
(`display-panel.tsx:96-100`). The reasoning was sound: the old legend *was* the toggles — same
`visibleLines` state, same `iconClasses` swatches — so keeping both was one control drawn twice.

What it missed is that the legend was doing **two jobs**, and only one of them moved:

| job | where it lives now | when you need it |
|---|---|---|
| **setting** — turn this series off | display rail | occasionally, deliberately |
| **reading** — which line is Met Office-only? | display rail | constantly, passively |

The rail is closed by default (`dashboard-shell.tsx:50`) and dashboard mode collapses it to
nothing permanently (contract §6, second hard constraint). So the *reading* job now lives behind
a click, and on a control-room wall behind a click nobody can make. Already logged as open in
`phase6-followup-outstanding.md` §3.

Contract §6 splits controls into "what you are looking at" (persistent) and "how it is drawn"
(collapsible). A legend is neither — it is not a control at all, it is a **key**. That is the gap
the rule left, and it is why this needs a decision rather than just moving the component back.

## The constraint that shapes everything: nine entries

GB charts **nine** legend entries — Current, 4 Hour, ECMWF-only, Met Office-only, Satellite-only,
PV Live Estimated, PV Live Updated, Seasonal mean, Seasonal quantiles. NL charts four. Any
always-visible design has to survive nine without becoming the thing it is trying not to be.

**But `visibleLines` defaults to five** (`globalState.tsx:214`), and it shrinks as you switch lines
off. A legend that names *only what is currently drawn* is five entries for GB out of the box, and
two or three for someone who has pared the chart down — exactly the user who least wants chrome.

That is the lever. **Every option below names drawn series only.** A legend listing lines that
aren't on screen is a control panel wearing a legend's clothes, which is the mistake that got us
here.

> **Mockup scenario, used throughout:** GB focused, forecast view (no comparison), cursor at
> Tue 12:00, default series on — Current, 4 Hour, PV Live Estimated, PV Live Updated, Seasonal
> mean. Five entries. This is what a new user actually sees.

---

## Option A — a strip in the chart header

One row of swatch+label chips, in the chart's own header, under the title and figures.

```
┌─ chart ────────────────────────────────────────────────┐
│ GB NL  National      8.4 / 9.1 GW  ⏱12:00   9.1 GW ⏱12:30│
│ ▬ Current  ▬ 4 Hour  ▬▬ PV Live Est  ▬ PV Live Upd  ▬ Seasonal │
├────────────────────────────────────────────────────────┤
│                        ╱▔▔╲                             │
```

**For:** always there, no interaction to learn, no state to remember, dies with the chart in
dashboard mode only if we want it to. Reads as part of the instrument.
**Against:** costs a permanent row of chart height (~18px), and at nine entries on a narrow chart
it wraps to two rows — worst case exactly when the plot area is smallest.

## Option B — a collapsible tray on the chart's bottom edge

Same content, but as a tray that collapses to a single `▸ Key` chip in the corner. Collapsed state
persists in a cookie alongside `visibleLines` and `pLevels`.

```
 expanded                              collapsed
┌────────────────────────┐            ┌────────────────────────┐
│         ╱▔▔╲           │            │         ╱▔▔╲           │
│      ╱▔╯    ╰▔╲        │            │      ╱▔╯    ╰▔╲        │
├────────────────────────┤            │                        │
│ ▾ Key                  │            │                  ▸ Key │
│ ▬ Current  ▬ 4 Hour    │            └────────────────────────┘
│ ▬▬ PV Live Est  ▬ Upd  │
└────────────────────────┘
```

**For:** literally answers the ask — there until dismissed, then gone to a 40px chip.
**Against:** a second collapsible thing on a screen that already has a collapsible rail and a
resizable chart. Three disclosure mechanisms is a lot of vocabulary for one screen.

## Option C — direct labels on the lines

No legend. Each series is named at its right-hand end, in the series colour, on the plot itself.

```
│      ╱▔▔╲                              ── Current
│   ╱▔╯    ╰─────────────────────────    ── PV Live Est
│ ╱                                      ── Seasonal
```

**For:** the strongest answer in dataviz terms — abolishes the lookup rather than housing it, costs
zero chrome, and scales *down* automatically since a hidden line has no label.
**Against:** the real work is collision avoidance. GB's lines converge hard overnight (everything
at zero) and the right edge is the forecast horizon where the spread is widest but the confidence
bands are too. Needs nudging logic and a rule for what to drop when labels collide. Also fights the
existing hover tooltip for the same pixels.

## Option D — expanded first, then it gets out of the way

Option A or B, plus: expanded on first visit, auto-collapsing after the first real interaction
(scrub, drag, toggle) or after ~10s. Remembered thereafter.

**For:** the closest reading of *"starts off there so I know what things are"* — teaches once, then
stops charging you for it.
**Against:** chrome that moves on its own is the thing users report as "it disappeared and I don't
know why". Needs the collapsed affordance to be obvious enough that the vanishing act reads as a
feature. Also: auto-collapse on a wall display would collapse for nobody and stay collapsed.

## Option E — just open the rail by default

Zero new code: flip `displayPanelOpen` to start `true`.

**For:** free, today.
**Against:** costs permanent horizontal space, shows all nine entries *as controls* including the
off ones, and is explicitly not what was asked for. Listed because it is the honest baseline every
other option should have to beat.

---

## What I would build

**A, scoped to drawn series, with D's first-run behaviour deferred until we have seen A live.**

The reasoning: A is the only option that adds no new interaction vocabulary to a screen that
already has a rail, a resize drag and a scrub track. At five entries it is one quiet row inside
the instrument it describes, which is where a key belongs — and the nine-entry worst case is a
state the user reached deliberately, by switching lines on, so paying a second row for it is fair.

C is the better idea and I would like to get there eventually, but it is a week of collision
tuning against a chart whose lines pile up at zero for half of every day, and it should not block
having *any* key on screen.

If A's permanent row turns out to annoy you in practice, B is a small change from it — same
component, same content, wrapped in a disclosure.

## Open questions for you

1. **Dashboard mode** — legend on or off? Argument for on: nobody can open the rail on a wall, so
   it is the only key available. Argument for off: a wall display is watched by people who already
   know the lines, and §6 says that mode wants data and no chrome.
2. **Does the legend stay clickable?** If the chips toggle `visibleLines` like `LegendItem` does
   today, it is a control again and we are part-way back to duplicating the rail. If they are inert,
   a user who switches a line off in the rail sees it vanish from the legend, which may read as
   broken. My instinct: inert, with the vanishing being correct and the rail being where you put
   it back.
3. **The delta view** — its chart has a different series set. Same treatment, or does delta's
   simpler chart not need a key?

## While we are here

`components/charts/LegendTooltipContent.tsx` and `components/LegendTooltop.tsx` (sic) have been
unreferenced since `ChartLegend` was deleted — `phase6-followup-outstanding.md` §3. Whichever
option wins, they either get reused or deleted; they should not sit dead through another pass.

---

## Where this got to — 2026-08-18

**Status: still options, nothing built, nothing decided.** No code touched, nothing staged. The
only new artefact is a mockup.

### The mockup

`docs/mocks/chart-legend-options.html` — self-contained, no build step, open it straight from
disk. Draws all five options as the real chart panel: header with country picker and figures, a
two-day solar curve that goes dead flat overnight, "now" line, cursor at Tue 12:00, x-axis.
Colours are lifted from `remix-line.tsx` and `tailwind.config.js`, not invented.

Three toggles at the top apply to every option at once, so they can be compared like for like:
**Nine entries** (the worst case), **Narrow chart**, **Dashboard mode**. B's tray and D's
auto-collapse are live; D collapses itself once on load and has a Replay control.

The scenario is the one stated above — GB, forecast view, cursor Tue 12:00, five default series.

### What drawing them changed

Three things were visible in the mock that the written options above do not say, and they should
carry into whatever gets decided:

1. **Dashboard mode is the sharpest discriminator, and it favours C.** A, B and D all vanish with
   the rail and leave a wall display with no key at all. C keeps its labels, because they are
   plot rather than chrome. That asymmetry is a stronger argument for C than §"What I would
   build" gives it — it partly answers open question 1 by making it moot for one option only.

2. **C's collision problem is at the right edge, not the overnight zeros.** The doc worries about
   lines converging at zero overnight. In the drawing that is harmless: the observers stop at
   "now" and label mid-plot, where they read very well. The pile-up is the *forecast* lines,
   which all end at the right edge at zero on the second evening — at nine entries that is seven
   labels crammed into the bottom-right corner, held apart only by nudging. So the collision
   budget is smaller than feared in one place and larger in another, and it is a right-edge
   problem to solve, not a night-time one.

3. **A's nine-entry wrap costs plot height exactly where there is least of it.** Known in theory;
   worth seeing. At five entries A really is one quiet row and the recommendation holds.

### Still open

- All three questions at the top of this doc are unanswered. The mock draws the chips **inert**,
  per the instinct recorded in question 2, but that is a mock decision and not a ruling.
- The **delta view is not mocked** (question 3). Its series set is smaller, so A costs it
  proportionally more chart height than it costs the national chart — worth drawing before
  deciding whether it gets the same treatment.
- `components/charts/LegendTooltipContent.tsx` and `components/LegendTooltop.tsx` (sic) are still
  dead, as "While we are here" notes. Untouched.
