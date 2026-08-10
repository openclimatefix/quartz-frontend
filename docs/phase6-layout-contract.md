# Phase 6 — the layout contract

> **Status: settled, ready to build.** The model below was agreed with Brad across the 2026-08-10
> design conversation and three rounds of an interactive prototype
> (`docs/prototypes/phase6-chrome.html`, throwaway). What remains OPEN is listed at the end and
> none of it blocks starting.

Companion to `adaptive-eu-ui.md`, `phase4-contract.md` and `phase5-contract.md`. Phase 5's progress
notes end with "the dashboard layout conversation is owed, and Brad wants it ASAP, before Germany."
This is that conversation, written down.

---

## Why this comes before Germany

Two reasons, the second of which only emerged during the conversation:

1. **Germany adds a country; it does not change layout.** Doing the layout first avoids
   restructuring around a third country's presence. (This was the original argument.)
2. **The country seam itself is changing.** `useCurrentCountry()` currently answers two different
   questions with one value, and this phase splits it (see "Enabled and focused" below). Adding
   Germany against the current seam and then splitting it means doing Germany twice.

Germany is also blocked upstream regardless: no forecasts on the API and no config yet. Brad can
mock it when we get there. The window is free.

---

## What Phase 6 is

The dashboard's arrangement is an artefact of organic growth. All three maps are mounted at once
inside `#map-container`, all three charts inside `SideLayout`, and views are toggled with a `hidden`
class (`pages/index.tsx:112-148`). That shape has three costs, all measured:

- **Every view's data runs all the time.** `useSitesViewData` is called unconditionally at page
  level with `isPaused: () => false` (`components/hooks/useSitesViewData.ts:52`). Opening the
  Forecast view still fetches the full sites list, a site forecast and a site actuals call.
- **`use-map-chrome.tsx` is pure compensation.** All three of its effects exist only because maps
  are hidden-but-alive — resize a map whose canvas reports 400px, resize on dashboard-mode change,
  and re-centre the *inactive* maps on a country switch so they do not show the previous country.
- **A view cannot be a component.** It spans both halves of the layout, so per-view containers are
  impossible as the plan wrote them (`docs/phase4-track-g-notes.md` §1).

But the reason to do it is not tidiness. It is that **this is the last place the app is still
GB-shaped**: three views are hardcoded in `components/layout/header/index.tsx:120-141`, shown for
every country, with no notion in `CountryConfig` of what a country actually offers. That is what
produced the `startsWith("nl_")` filter in `useSitesViewData.ts:60-67` — a country branch in code,
with a splice-while-iterating bug, existing solely because NL is offered a view it has no data for.

---

## The model — DECIDED

### 1. Enabled and focused are two things

`useCurrentCountry()` answers two questions with one value. It splits:

- **`enabled`** — a *set*. Which countries draw on the map. Header control becomes a multi-select
  toggle rather than a switch, filtered by the entitlement claim.
- **`focused`** — *one*. Which country owns the national chart, the capacity figure, the level
  selector, and the number/date formatting (`timezone`, `locale`).

**Selection sets focus.** Clicking a region focuses its country. This makes "multi-region selection
is same-country only" structurally impossible to violate rather than a rule to police.

**Every enabled country's regions are clickable, and clicking one switches focus to it** — one
gesture, no inert map. The cost is that the chart changes country under the user, so the change must
be signalled: a country chip in the chart header that visibly moves from the old country to the new.
The outgoing country's region selection is cleared, per the rule above.

### 2. There are not three views

Delta is a *mode*, not a peer view — it was kept separate for time reasons, not design ones (Brad).
It shares the country, the regions, the time axis and the level control with Forecast, and
`pages/index.tsx:76-78` even force-snaps the level when entering it.

The real axis is **A versus B**, and it is already latent in the config: `nationalChartSeries` is a
curated forecast list and `useGenerationSources(scope)` supplies observers from the manifest (GB
two, NL one). The comparable set is those crossed. Today's "forecast vs generation" and "forecast vs
N-hour forecast" are two presets over one mechanism — which is Delta v2. Forecast is the preset with
no B.

Country differences then fall out with no config and no branch: NL gets fewer presets because it has
one observer.

**Solar Sites is not a country view at all, and moves to its own page.** It is tenancy-scoped: the
`/sites` list returns whatever sites the logged-in user owns, so its gate is "does this user own
sites", never country. It also has a different backend (v0), different geometry (points, not
regions), its own zoom bands, and no country semantics.

Every arrangement we tried was managing that mismatch rather than removing it — and with comparison
now living on the map, sites would inherit a control whose options do not apply to it. So it becomes
its own route.

**Minimal for now** (Brad): move it, do not redesign it. It is being rebuilt when the sites v1
migration lands, and that is the moment to give it proper chrome. What this phase gets from the move
is the thing that matters — its data stops loading on the forecast view.

### 3. The map is the ground; the chart is a floating readout

The map is a spatial cross-section of the chart at the cursor instant; the two are one instrument
presented as two panes. Brad's read is the same — "map feels secondary cross-section" — and there is
prior evidence it works: a UKPN-specific UI with a chart over a map visible around the edges tested
well with users.

So: **full-bleed map, chart floating over it.** The 50/50 split goes. It was already vestigial — the
responsive widths are commented out in both `pages/index.tsx:101` and `components/side-layout/index.tsx`,
hardcoded to `"50%"`, and a half-width panel showing GB, NL and Germany at once would be mostly sea.

**The mode sets the default split, the user can override.** Spatial error hunting wants map; watching
today's curve wants chart. The mode already knows which; a drag handle is the override, not the
primary mechanism. Limits on the override are OPEN.

### 4. Time is chrome, not chart-internal

With history beyond v0's ~3 days, time stops being one slider and becomes **a range** (what am I
looking at) and **a cursor** (what is the map showing). The cursor is shared with the map — it is
the thing that makes the two one instrument — so the control belongs to the shell.

**The cursor is a UTC instant; presentation is per-country.** One truth, ambiguity displayed rather
than hidden: label in the focused country's local time, and show the others alongside when more than
one is enabled ("GB 16:00 · NL 17:00"). This also survives DST transitions landing on different
dates in different countries.

**Timestamps label the END of their period, and the cursor therefore rounds UP.** A GB slot labelled
16:00 covers 15:30–16:00; an NL slot labelled 16:15 covers 16:00–16:15. So a cursor at 16:15 UTC sits
inside GB's **16:30** period, not its 16:00 one:

```
cursor ------> 16:15 UTC
  GB  30-min   16:30 slot  (covers 16:00-16:30)  = 17:30 BST
  NL  15-min   16:15 slot  (covers 16:00-16:15)  = 18:15 CEST
```

The resolution rule is **ceiling to the country's next published slot**, never "nearest". Nearest is
what anyone reaches for by default and it is wrong by up to half a period, in a way that still looks
plausible on screen.

> **The invariant is stated in user-facing copy but not in the code that will implement it.**
> `ChartInfo.tsx:25-26` — the `i` tooltip in the legend — says "datetimes show the end of the
> settlement period. For example, 17:00 refers to solar generation between 16:30 to 17:00." Nothing
> in `components/helpers/data.ts`, `hooks/data/` or the fixtures README repeats it. It has not bitten
> yet only because the slider steps through `times_utc` exactly, so no rounding happens today. A
> continuous cursor is what makes it live — write it down at the resolution helper, next to the code
> that depends on it.
>
> **And it may not be universal.** `ChartInfo.tsx:5-7` flags its own copy as GB-specific in
> substance — "settlement periods and PV_Live are not concepts every country has" — deferred to a
> later phase as a wording job. But if the cursor rule depends on period-end labelling, that is no
> longer only wording: **whether NL (and Germany) also label period-end is a correctness question for
> the resolution helper**, and it needs an answer before the continuous cursor ships. If it varies,
> it is another registry field alongside cadence and timezone. Added to OPEN below.

**The cursor steps on the finest enabled country's grid** — not continuous, and not the coarsest.
With NL enabled that is 15 minutes, so NL is always exact and GB rounds up to its 30-minute slot;
with only GB enabled the grid is 30 minutes and GB is exact. Nothing loses resolution, every cursor
position is a real published instant for at least one country, and the readout names the grain.
Enabling or disabling a country changes the grid, so the cursor re-snaps.

A fully continuous cursor was prototyped and rejected (Brad): it puts the cursor on an instant that
is real for nobody.

**Click-to-set-time on the chart stays** (Brad). `remix-line.tsx:372,383` passes `activeLabel`
through to `setSelectedISOTime` (`pv-remix-chart.tsx:201`), and it is the interaction that *proves*
the shared-cursor model — click the chart, the map repaints. Moving the cursor into chrome must not
cost it: the chart click writes to the shared cursor like any other input, snapping to the same
finest-enabled grid.

> **`get30MinNow` is the ceiling rule already, with GB's cadence hardcoded.**
> `globalState.tsx:27` rounds *up* to the next 30-minute slot — so the rule this contract picks is
> not a new invention, it is what the code already does at one fixed cadence. It seeds
> `selectedISOTime` and `timeNow` (`globalState.tsx:133-134`) and has consumers in
> `pv-remix-chart.tsx`, `delta-view-chart.tsx`, `use-format-chart-data.tsx` and
> `use-format-chart-data-sites.tsx`. On NL it lands the cursor up to 15 minutes off the grid NL
> actually publishes on. **Generalising it to the enabled set's finest cadence is the single change
> that makes the shared cursor correct**, and it is a rename-and-parameterise, not a rewrite.

**The time range is unchanged for Europe v1.** No range picker, no date picker — the window we
already show. The 7-day cap and the wider-history question move to a later phase along with the
forecast-accuracy product they belong to. What this phase delivers is the cursor becoming shared
chrome, not the range becoming configurable.

### 5. Comparison is a map concept, and lives with the colour guide

Turning comparison on changes the map's **entire encoding** — sequential fill (output magnitude,
one hue light→dark) becomes diverging (difference, two hues around a neutral midpoint). It changes
the chart by **one series**.

That asymmetry is the whole argument. **The chart never needed a mode**: forecast and generation sit
on the same axes quite happily, and a series toggle already does that. Comparison is a mode *only
because the map has one fill per region and cannot show both at once.*

So comparison is not a display setting and not a chart control. It is the answer to "what does the
colour mean?" — which is the colour guide's own subject. `color-guide-bar.tsx` and
`delta-color-guide-bar.tsx` stop being two components that get swapped and become **one control that
selects the encoding and then explains it**, in the map's existing overlay cluster alongside
`measuringUnit.tsx`.

The unit toggle stays in that cluster for the same reason. The chart header keeps a passive echo
("Forecast vs generation") so the state is legible where the numbers are, but the map cluster is
authoritative.

This also keeps the what/how rule below intact: comparison is map chrome, not display settings, so
the display panel stays collapsible without ever hiding navigation.

### 6. Controls split by what they do

Options have outgrown their homes and are currently scattered across the header, a modal, the chart
legend and map overlays by historical accident. The organising rule:

- **What you are looking at** — country toggles, focus, time, level, comparison. This is navigation.
  Persistent chrome, always visible, because it is the state you must read to know what you are
  seeing.
- **How it is drawn** — unit, legend visibility, p-levels, layers, opacity. This is display.
  Collapsible sidebar.

Two hard constraints:

- **The sidebar competes with the floating chart for edge space.** The chart must know the rail
  exists and cannot be dragged behind it. Decide before building, or it becomes `z-index` archaeology.
- **Dashboard mode must collapse the sidebar to nothing.** A control-room wall wants data and no
  chrome, and it is the one mode where nobody can reach over and collapse it by hand.

### 7. The chart is one country at a time

Enabling countries is a *map* concern. The chart always shows the focused country.

- **GB is the default focus**; the last selected country sticks (persisted, like `visibleLines`).
- **Changing focus clears the region selection.** The inverse of "selection sets focus" — a
  selection cannot outlive the country it belongs to.
- A country switcher may sit in the **chart header** as well as in the top nav, if that reads better
  in practice. To be judged on the built thing.

**Multi-country overlay was tried on the `feat/NL-toggle` branch and was tricky** (Brad). It is not
ruled out forever, but it is out of scope here and it has a specific blocker to solve first:

> **Series identity is carried by colour.** `nationalChartSeries[].legend.iconClasses` and the
> strokes in `remix-line.tsx` mean GB's forecast line and NL's forecast line are the same colour.
> Overlaying needs a second visual channel for country — line style is the obvious candidate
> (colour = series, dash pattern = country), but solid/dashed/dotted degrades past two or three
> countries. Unit is *not* the blocker: `globalState.tsx:132` already defaults `activeUnit` to
> `percentage`, so countries are comparable by default.

### 8. Personas test the design; they do not structure it

Four audiences, with different drivers (Brad): control-room forecast makers/validators, control-room
lights-on operators, traders (a solid number, with a hint of how sure), and meteorologists/analysts
(why is this happening, is it sensible).

**Do not build a mode per persona.** Their differences are defaults, not structure — which split,
which lines, which horizon, which level. Persist them. `visibleLines` and dashboard mode are already
cookie-persisted; that is the right instinct applied to two settings instead of the set. Personas are
for testing the result, not for designing it.

---

## Measured facts — do not re-derive

Taken 2026-08-10 on `epic/adaptive-eu-ui` @ `96a4614` plus the map-error fixes.

**Forecast cadences differ per country.** GB GSP publishes on a **30-minute** step; NL province on a
**15-minute** step (`lib/api/v1/__fixtures__/gb-gsp-forecasts-period.json`,
`nl-province-forecasts-period.json`). A shared cursor at NL's 16:15 has no GB slot. Cadence is
therefore a per-country fact and wants to be a registry field alongside `timezone`, not an
assumption baked into the slider.

**Region hierarchy stays selectable.** The map is most useful at maximum granularity and that is what
people mostly use; DNO/zone levels are added value, relevant when relevant (Brad). Do **not** make the
level purely zoom-derived. Default to finest, keep it selectable.

**Comparison models are public-facing** and are used. Delta v2 may be more so.

**`coverage` has no consumer.** `useMapRegionValues` returns `{ published, expected, isPartial }`
(`components/map/use-map-region-values.ts:179`) and nothing in the app reads it. `snapshotCoverage`'s
own doc comment says it exists so a view can say "127 of 336 published rather than silently drawing
209 holes". Partial coverage is currently silent. Where it surfaces is OPEN, and it is a good early
test of the new chrome — "the map is 94% populated" has nowhere to live today.

**Two map failure-surfacing bugs were fixed on 2026-08-10**, found when a dev-API 503 rendered as
"boundaries drawn, no fill, no message":

- `pvLatestMap` and `deltaMap` gated their failure state on `error && !featureStates.size`. Feature
  states are built from the *region list*, so `/regions` succeeding populates all of them whether or
  not any forecast value arrives — the guard was false in exactly the case it existed for. Both now
  gate on `hasValues` (`coverage.published > 0`). `deltaMap`'s loading arm had the same flaw
  independently.
- `sitesMap` guarded on `sitesErrors?.length`, but `sitesErrors` is an object keyed by fetch, so
  `.length` was always `undefined` and its failure state could never render. The prop was typed
  `any`, which is what let it compile.

`FailedStateMap` replacing the whole map with grey text is still wrong — geometry loading fine is
real information — but that is presentation and belongs to this phase, not to a bug fix.

---

## Non-goals

- **Forecast accuracy over time.** A different product with different granularity and a genuine
  presentation question about showing our own error rate deliberately rather than accidentally.
  Explicitly out.
- **Market structure in the time axis** (settlement periods, gate closure). Not known strongly
  enough to act on. Rationalising the layout should *make space* for it as a next step and a user
  feedback opportunity, not pre-build it.
- **Germany.** Follows this phase, as config.
- **The −122 MW coverage gap, the DNO 15-way double-count, the stale NG-zone grouping file.** Data
  problems, carried forward from `phase5-progress.md` §Open.

---

## OPEN — the talking points, in the order they block things

1. ~~What the chart shows when several countries are enabled.~~ **CLOSED** — one country at a time,
   see "The chart is one country at a time" above.
2. ~~Cursor snapping across differing cadences.~~ **CLOSED** — continuous cursor, ceiling to each
   country's next published slot. See "Time is chrome" above, including the end-of-period invariant.
3. ~~Does focus follow a map click across countries, and how is it signalled?~~ **CLOSED — and it
   was already closed when this list was written.** "Selection sets focus" under §1 above decides
   it: every enabled country's regions are clickable, clicking one switches focus to it, and the
   change is signalled by the country chip moving in the chart header. This entry survived the edit
   that closed it, and cost Track A a wrong deferral before it was spotted (2026-08-10). The
   remaining work is the chip's *animation*, which is presentation, not a decision.
4. ~~The modes, and their default splits.~~ **CLOSED** — there are no modes in the nav. Comparison
   moved to the map cluster and Sites moved to its own route, so the nav carries the country toggles
   and account only. The chart's default split is set by whether a comparison is active (comparison
   shrinks the chart, giving the map more room); the user can still override.
4a. **Does every country label timestamps as period-end?** GB does (`ChartInfo.tsx:25`, following
   PV_Live). If NL or Germany differ, the cursor's ceiling rule is per-country and becomes a registry
   field. *Blocks: the resolution helper — a wrong assumption here is off by a whole period and looks
   plausible on screen.*
   **UNBLOCKED, not answered** (Track B, 2026-08-10). It *is* a registry field —
   `CountryConfig.slotLabelling` — and `slotForInstant` floors rather than ceilings when it says
   `period-start`, so the resolution helper no longer assumes. NL is set to `period-end` because
   that is what the old single-cadence code did everywhere, i.e. the no-change answer, **not
   because anyone confirmed NED publishes period-end.** Still needs the fact; confirming it is a
   one-word edit. See `phase6-track-b-notes.md`.
4b. **`ChartInfo` says "The Y axis units are in MW for the National and GSP charts"**
   (`ChartInfo.tsx:28`) while `globalState.tsx:132` defaults `activeUnit` to `percentage`. One of the
   two is stale. Minor, but it is the tooltip users read to interpret the axis.
5. **Floating chart mechanics.** Movable, resizable, dockable? Persisted per user? What are the
   limits on the override — can it be dismissed entirely? Not blocking: ship the mode-set default
   first and add the override once there is something to override.
6. ~~Sidebar contents at launch.~~ **CLOSED enough to start** — layers, confidence bands, series
   toggles. Comparison and unit went to the map cluster. Expect to cut further once it is real.
6a. **The map corner is near its limit.** The cluster is ~244px and three controls deep, and it
   shares the corner with the sites zoom slider and the layer toggles. One more control and it wants
   to be a popover rather than an always-open panel.
7. **Where partial coverage surfaces** — see the orphaned `coverage` above.
8. **Region types across countries.** Brad's read: genericise to share, worst case per-region
   selected. Needs pinning down once the German region types are known.
9. **The full A/B comparison picker (Delta v2).** Deferred deliberately (Brad: "circle back"). The
   map cluster's "Colour by" control is where it grows — presets today, an A-and-B picker later, in
   the same place. No new surface required when it lands.
10. **The sites zoom bands** (`AGGREGATION_LEVELS` and the zoom enums in `constant.ts`). They survived
   Phase 5 as sites-only. Sites is moving to v1 and to a tenancy gate; do the bands survive that?

---

## The build plan

Four waves. The rule is the usual one: a track owns its files outright, and sequencing follows data
dependencies rather than size.

### Wave 1 — the seams (nothing else can start first)

**Track A — the country split.** `useCurrentCountry()` becomes `useEnabledCountries()` (a set) and
`useFocusedCountry()` (one). `CountryToggle` becomes multi-select, filtered by the entitlement claim.
Selection sets focus; focus change clears selection.
*Owns:* `hooks/data/use-current-country*`, the country slices of `components/helpers/globalState.tsx`,
`components/layout/header/country-toggle.tsx`.

**Track B — the time seam.** `cadenceMinutes` into `CountryConfig`. `get30MinNow` generalises to
"ceiling to a given cadence"; a new cursor module resolves the finest enabled grid and each country's
slot. Click-to-set-time keeps working, snapping to the same grid.
*Owns:* `config/countries.ts` (cadence field), a new `lib/time/cursor.ts`, the time helpers in
`components/helpers/utils.ts`.
*Sequenced after A* — it needs the enabled set to compute the finest grid, and both would otherwise
edit `globalState.tsx`.

Both are **Opus**: they define seams every later track codes against, and the time work is the
silent-plausible kind — rounding, cadence, DST — where tests pass and the answer is quietly wrong.

### Wave 2 — structure

**Track C — Sites to its own route.** Move, do not redesign. `useSitesViewData` stops being called on
the dashboard, which kills the unconditional fetch and lets the `nl_` filter go with the view.
*Owns:* a new `pages/sites.tsx`, `components/hooks/useSitesViewData.ts`, `components/map/sitesMap.tsx`,
`components/charts/solar-site-view/*`. **Sonnet** — mechanical, with a clear oracle.

**Track D — the dashboard shell.** Full-bleed map, floating chart, collapsible display panel, time
chrome. Deletes the `hidden`-class toggling and most of `use-map-chrome`.
*Owns:* `pages/index.tsx`, `components/side-layout/*`, `components/layout/layout.tsx`,
`components/hooks/use-map-chrome.tsx`. **Opus** — it defines the layout seam Wave 3 fills.

### Wave 3 — encoding

**Track E — the map control cluster.** `color-guide-bar` + `delta-color-guide-bar` become one control
that selects the encoding and explains it, with `measuringUnit` alongside. Comparison presets drive
both map fill and chart series.
*Owns:* `components/map/color-guide-bar.tsx`, `delta-color-guide-bar.tsx`, `measuringUnit.tsx`, and
the fill expressions in `components/map/feature-state.ts`.
**Sonnet**, following D's seam — with a stall condition, since the visual judgement is Brad's and no
test decides it.

### Wave 4 — cleanup

Delete what the structure made dead: the `VIEWS` enum's dashboard entries, the remaining
`use-map-chrome` effects, `SideLayout`'s vestigial widths. **Sonnet.**

### Not in any track

Germany. It follows this phase as configuration — one registry entry, its geo assets, an Auth0 role.
If it needs anything else, the abstraction is wrong.
