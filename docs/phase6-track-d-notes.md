# Phase 6, Track D — the dashboard shell

Wave 2, run alongside Track C. Implements `phase6-layout-contract.md` §3 (the map is the ground,
the chart floats), §4 (time is chrome), §6 (controls split by what they do), and §2's consequence:
there are not three views, so the three-view nav is gone.

## What the seam is

Two of them, and they are different kinds of thing.

**The layout seam** is a shape, not an API. `components/shell/dashboard-shell.tsx` is three rows
and one overlay set:

```
 header             navigation — what you are looking at (§6)
 stage              the map, full bleed
   └ chrome inset   everything that floats: the chart, the map control dock
   └ display rail   how it is drawn (§6), over the map's right edge
 cursor readout     the shared cursor, shell chrome rather than chart-internal (§4)
```

The **chrome inset** is the whole answer to §6's first hard constraint. The rail and the floating
chart compete for edge space; rather than letting them overlap and sorting it out afterwards, the
inset's right edge *is* the rail's left edge. A floating pane has no way to reach the rail's
column, so "the chart cannot be dragged behind the rail" is a property of where it is mounted, not
a rule something enforces — and it still holds when the drag override lands (OPEN 5), because the
drag will be bounded by the same box. Neither the chart nor the dock takes a rail-width prop.

§6's second constraint falls out of one `&&`: `railOpen = displayPanelOpen && !dashboardMode`.
Dashboard mode collapses the rail to nothing by derivation, so there is no state to fall out of
step.

**The comparison seam** is state. `comparison: ComparisonSelection` in `globalState`, `null` for
the plain forecast and a preset id otherwise, written only through `setComparison`:

```ts
import { setComparison } from "components/helpers/globalState";
import { COMPARISON_PRESETS, comparisonTitle } from "components/helpers/comparison";
```

`setComparison` also writes `view`, which is why it is a function rather than a plain
`setGlobalState`. `view` stopped being what the dashboard switches on, but a dozen components
still read it — `remix-line`'s axis, `StatusBanner`, the CSV modal, both charts' cursor-reset
effects — and migrating them is Wave 4's cleanup. Keeping the pair in step in one place means no
consumer has to know which is authoritative in the meantime. `pages/sites.tsx` declares
`VIEWS.SOLAR_SITES` on mount for the same reason; nothing else writes `view`.

## Where Track E plugs in

**`components/shell/map-encoding-controls.tsx` is yours. Replace its contents.**

`map-control-dock.tsx` is the shell's half and stays: it positions the cluster bottom-right inside
the chrome inset (so it never collides with the rail), fixes its column width — which is what lets
the floating chart cap its own width and guarantee it can never cover the cluster — and
establishes a positioning context so contents lay out in normal flow.

What is in `map-encoding-controls.tsx` today, and what each part is for:

| Piece | Status |
| --- | --- |
| "Colour by" segmented control (`Forecast` / `Generation`) → `setComparison` | **Provisional.** The minimum that keeps the delta view reachable once the nav switcher went; a mode nobody can enter is not something Brad can judge live. Redesign freely. |
| `MeasuringUnit` | Moved here from `pvLatestMap`'s overlay, per §5. The delta map gains a unit control it never had. Its `isLoading` gate was the map's fetch state, which the dock does not have and should not learn — it is passed `false`. |
| `ColorGuideBar` / `DeltaColorGuideBar`, swapped on `comparison` | Mounted, contents untouched. **This is the pair you merge into one control that selects the encoding and then explains it.** |

The guide bars had to move rather than waiting for you: both anchored themselves to the map's
bottom-left corner (`absolute bottom-12 left-0 ml-12`), which is where the floating chart now
sits, so leaving them would have shipped a guide hidden behind the chart. The only edit in either
file is that class string, and there is a comment in each saying so. Everything about the bands,
colours and copy is as you found it.

Also worth knowing before you add to the cluster: §6a says the corner is near its limit at ~244px
and three controls deep. The dock is 260px. One more control and it wants to be a popover.

## What changed in behaviour

**One map and one chart are mounted, chosen by `comparison`.** The `hidden`-class toggling is
gone, and with it two of `use-map-chrome`'s three effects: there is no hidden-but-alive map to
have missed a resize, and no inactive map to have missed a country change (`map.tsx` moves its own
camera on `focusedCountry`). What survives is the dashboard-mode resize — the one chrome change
that can alter the map's box without the map hearing about it. The cost of the swap is that
Mapbox re-initialises when a comparison is toggled; the viewport is country-keyed state, so it
comes back where the user left it.

**The nav carries navigation only.** Forecast and Solar Sites are now *routes* (`/` and `/sites`),
marked current from the router rather than from a `view` prop, so `Header` no longer takes
`view`/`setView` at all. Delta is not in the nav — it is the comparison preset. `/sites` had no
way in from the UI at all before this; it does now.

**The chart floats, and its default size follows the mode.** Plain forecast 46% × 62% of the
inset, a comparison 34% × 46% — a comparison asks *where* the difference is, so it gives the map
the room (§3). The expand handle inherited from `SideLayout` is the override, and the only one
this phase ships. Below `lg` the chart takes the full inset width, as `SideLayout` did, but the
check is a live `matchMedia` rather than one read on mount.

**The cursor readout is shell chrome** (§4). It names three different facts: the cursor itself in
UTC, the slot *each enabled country published for it* in that country's local time ("GB 16:00 ·
NL 17:00", with the `+15m` lag where a coarser country resolves later), and the grain, because the
step changes when the enabled set does. All the arithmetic is Track B's — `slotForInstant` per
country plus the registry's zone — and nothing here rounds anything. The cursor's *inputs* have
deliberately not moved: click-to-set-time on the chart, the arrow keys and the play button all
still write `selectedISOTime`, and §4 only asks that they snap to the same grid, which Track B
already made them do.

**Display settings moved to the rail** (§6): confidence bands (out of the settings modal, which
held nothing else and is deleted), constraint boundaries (out of the account menu), and series
visibility. Comparison and unit went the other way, to the map cluster, per §5.

**The chart header echoes the comparison** ("Forecast vs generation" next to "National"), passive
and read-only — the map cluster is authoritative. Reading a difference off a chart whose header
still says "National" is how you misread it.

## Files

New: `components/shell/{dashboard-shell,floating-chart,display-panel,cursor-readout,map-control-dock,map-encoding-controls,expand-button,geometry}`,
`components/helpers/comparison.ts` (+ its test).

Deleted: `components/side-layout/*`, `components/layout/header/settingsModal.tsx`.

Edited: `pages/index.tsx`, `pages/sites.tsx` (chrome only — see below), `pages/{404,logout,expired,auth/denied}.tsx`
(the `Header` props), `components/layout/header/{index,profile-dropdown}.tsx`,
`components/hooks/use-map-chrome.tsx`, `components/helpers/globalState.tsx`,
`components/map/{pvLatestMap,deltaMap}.tsx` (unmounting the moved controls),
`components/map/{color-guide-bar,delta-color-guide-bar}.tsx` (positioning class only),
`components/charts/forecast-header/ui.tsx` (the echo).

`pages/sites.tsx` is Track C's, edited after C landed and at the coordinator's request: it gains
`Layout`, `Header` and `DeprecatedDomainNotice` so the route is not visibly a different app, and
it declares `VIEWS.SOLAR_SITES` — without which the sites chart's time axis would have been laid
out as if it were the dashboard's. Its own layout is untouched (§2: move it, do not redesign it).

## Intentional test changes

**None.** This is worth stating plainly because the brief expected some: no existing test asserted
the three-view layout, the `hidden`-class toggling or `SideLayout`. The suite went 1012/39 →
1017/40 purely by addition — `components/helpers/comparison.test.ts`, five tests pinning that
`comparison` and the `view` it mirrors can never disagree. That pair is the one silent-plausible
failure this track introduces: a `view` of `FORECAST` with a comparison active would draw the
delta map under a chart that resets the cursor whenever the delta series lags.

## Verification

`yarn tsc --noEmit` clean bar the known pre-existing `jest.globalSetup.ts(14,1) TS1208`.
`next lint` 17 warnings, 0 errors — the baseline exactly, none in the touched files.
`next build` green. Full Jest suite **1017 passed / 40 suites**.

(One `next build` run failed on `sentry-cli releases finalize` returning a 503. That is the
release upload, not the compile; the same tree builds green with the upload disabled.)

## For the live pass

Layout is the half no test decides, so most of this is eyeballing:

- **the default splits** — plain forecast, then switch "Colour by" to Generation and watch the
  chart shrink and the map gain room. Is 46/62 → 34/46 the right pair of sizes?
- **a region selected**, which stacks the GSP sub-chart under the national one inside a panel that
  is now 62% of the stage rather than full height. This is the arrangement most likely to feel
  cramped; the expand handle is the escape.
- **the display rail** — open it and check the chart reflows rather than sliding under it, then
  turn on dashboard mode and check the rail goes to nothing.
- **the cursor readout with NL enabled** — GB and NL should show different local times, NL exact
  and GB carrying `+15m` at the quarter hours, and the grain should flip between 15 and 30 minutes
  as NL is toggled.
- **`/sites`** — reachable from the nav, with header and status banner, and its chart's time axis
  still behaving as it did on the old tab.
- **toggling a comparison repeatedly** — the map re-initialises each time now. It should land back
  on the same viewport; watch for a flash or a lost camera position.

## Deferred, and why

- **The footer's scrub track.** The prototype draws one; §4 only asks for the readout, and the
  time *range* is explicitly unchanged for Europe v1. The chart click, the arrow keys and the play
  button remain the cursor's inputs. A real scrub bar is a new interaction, not a move.
- **Drag/resize of the chart** — OPEN 5, explicitly not blocking. The inset already bounds it.
- **The country chip animation** Track A asked for. The picker is in the chart header, which now
  floats; the animation is presentation and wanted a settled shell first.
- **The map fan-out over `useEnabledCountryListings()` and stamping `REGION_COUNTRY_PROPERTY`.**
  Track A's notes name this as Track D's, but it is map-geometry work rather than shell work and
  the shell does not block it. Until it lands, the map still draws one country and the click
  path's cross-country branch cannot fire. **This is the one thing another track will have to
  pick up.**
- **Dashboard mode does not hide the nav.** The prototype collapses it and adds a separate exit
  affordance; without that, hiding the header would strand a user in dashboard mode, since the
  account menu is the only way out. The rail collapsing is the constraint §6 actually states.
- **Two duplicate controls.** The chart legend keeps its own series toggles alongside the rail's —
  it is also the key to the colours, so it cannot simply lose them, and consolidating is chart
  work. And the map corner's `ButtonGroup` still prints the selected time, which the cursor
  readout now says better; both are Wave 4 trims.
- **Rail open/closed is not persisted.** `visibleLines` and dashboard mode are cookie-persisted and
  §8 argues the whole set should be; that is a settings pass, not this one.
