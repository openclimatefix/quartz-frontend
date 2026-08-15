# Phase 6 followup — what is outstanding

Written 2026-08-13, at the end of a long live-pass session. Everything below is either something
Brad raised and parked, something an agent flagged and did not fix, or something I proposed that he
has not answered. Nothing here is in flight; the tree is committed and green.

**State of the branch:** `epic/adaptive-eu-ui`, unpushed. Jest **1173 passed / 52 suites**,
`next lint` 16 warnings / 0 errors, `yarn tsc --noEmit` clean except the known pre-existing
`jest.globalSetup.ts(14,1) TS1208`. `next build` green — but note that **concurrent `next build`
runs produce false failures**; three separate agents misreported build state this session by
racing each other over `.next`. Tests and typecheck are reliable under concurrency; builds are not.

---

## 0. Start here next session

**Merge the forecast and delta maps into one** — see `docs/forecast-delta-merge.md`, written
2026-08-15 to be picked up cold. It carries the plan, an intent-vs-accident classification of every
difference between the two components, and a Delta v2 prep section recording how delta actually
works today (notably: **the chart and the map compute different deltas under the same name**).

The camera-reset half of that problem is already fixed (`d1dd82d`); the remount flash is what
remains.

## 1. Blocking something else

**The pre-warm cache is stale, API-side.** *(Still reproducing 2026-08-15: GB per-GSP
`generation/period` returned zero slots with `cache_updated_utc` ~20 hours old, while GB forecast
and both NL endpoints were fresh within the hour. Brad refreshed the cache and it did not take. It
is specifically that one cache.)* GB's per-GSP `generation/period` came back with
`cache_updated_utc` roughly seven hours old, so no GB region had a computable delta at a recent
cursor and the delta map drew GB uncoloured while NL filled normally. Scrubbing back ~2 hours made
GB appear. **The client is behaving correctly** — the join, the normalisers, the observer parameter
and the per-country region types were all verified along the way. Brad: "back to the issue with the
pre-warm cache not updating properly... we'll need to look at that soon."

**Germany.** Unblocked now that MW bands are per-country config (followup Track K). It should be one
`COUNTRY_CONFIG` entry plus geo assets plus an Auth0 role. Track K's notes list exactly what a new
country must supply.

**The narrow (`<lg`) stage needs designing, not patching.** Raised 2026-08-14, while moving the
floating chart from the bottom edge of the stage to the top. Wide layouts are fine — the chart caps
its width short of the map control dock and grows downward. Narrow is not: the chart is full width
at its seed height, so the map it is a readout *of* is left as a strip, and Brad's read is that
this "covers far too much for the map" and "needs specific rules and relationships with other
elements (and user controls) to work on smaller screens." That is a stage design — how chart, map
control dock and display rail give way to each other, and what the user gets to drive it with —
not an anchor tweak. **In the meantime** `floating-chart.tsx` keeps the *bottom* anchor below `lg`,
which does nothing except stop the chart covering the top-right control dock; it is labelled in
that file as a holding position. Do not build on it.

## 2. Decisions Brad has not made

- **Does `/sites` get a footer?** It came up twice today. It has no scrub track, no `now`, no
  tethered reading — just a play button (Track P kept it there deliberately rather than deleting a
  feature). Separately, Track J left its time axis on its own numeric branch: 6-hourly ticks
  always, no narrow fallback, and anchored to the *viewer's* zone rather than the country's. If
  `/sites` gains a footer, do both together.
- **Footer direction 3**, explicitly parked ("come back to 3"): collapse the readout to one clock,
  with the other countries behind a compact lag marker (`NL +1h`) rather than full times. The zone
  stack shipped instead, which is the always-visible option.
- **The delta strip's "no delta right of NOW" band.** Track O skipped it to protect the layer
  hierarchy — a fifth ground layer would have muddied the strip. It is the one layer that would
  have shortened the debugging session in §1.
- **Should Clouds default *on*?** `showCloudLayer: false` predates this work entirely (it comes
  from the original satellite commit). Brad called clouds a flagship feature; the control is now
  always visible, but the layer still starts off.

## 3. Flagged by agents, not fixed

- **`MAP_CONTROL_HEIGHT_RESERVE_PX` is still a constant (350)**, sized for the map panel
  *expanded*, while it is collapsed by default. Track L narrowed *when* it applies (only when the
  chart's width actually overlaps the dock's column, which is what unblocked the 90% seed) but
  could not measure the dock's live height without editing a file it did not own. A
  `ResizeObserver` publishing the dock's height would tighten it.
- **The colour key disappears when the display rail is collapsed.** Track G moved the chart's
  legend into the rail's series toggles; with the rail shut, nothing on screen names the line
  colours.
- **Two dead files**: `components/charts/LegendTooltipContent.tsx` and `LegendTooltop.tsx` became
  unreferenced when `ChartLegend` was deleted.
- **The camera reads chrome by `aria-label`.** `map.tsx` finds `[aria-label="Chart"]` and
  `[aria-label="Map controls"]` to work out what covers the map when framing countries. Renaming
  either label silently stops the camera accounting for it. Commented at both ends; still a
  coupling the type system cannot see.

## 4. Tuning, from the mock

Values chosen by eye late in the session and worth a second look in daylight: daylight shading at
`14%` yellow (it was 6%, which was invisible — a jump of more than 2×, so overshoot is plausible),
the strip at 40px, the tethered tag's edge re-anchor threshold at 10%, and whether `now` reads
correctly now that it hides itself while live.

## 5. A sweep worth doing

**GB-shaped assumptions in `components/charts/`.** Four separate bugs today were the same shape,
and each failed silently rather than loudly:

| Assumption | Where it bit |
| --- | --- |
| `"gsp"` as *the* region type | selected-region chart, delta hook — 400s for NL |
| `gsp_id` as *the* region identity | delta table dropped all 12 NL provinces |
| `pvlive_in_day` as the observer default | map values, delta hook, loading indicator — 400s for NL |

The map layer was swept during Phase 6 Track F; the chart layer never was. A deliberate pass over
`components/charts/` for those three would likely find what is left before a user does.

## 5b. Verify before building on it — GB market auction times and BST

**Not now. Do it before anything is built against market deadlines, and do not lose it.**

Raised 2026-08-15 while adding the GB intraday market clock to the user-research work (see
`docs/feedback/FEEDBACK-MATRIX.md` §6b, untracked). EPEX's Focus GB diagram labels every GB auction
time "GMT", which invites storing them as fixed UTC constants. That reading is wrong, and wrong in
the direction that fails silently for seven months of the year.

**What is already established:** SDAC's gate closure is anchored to **12:00 CET**, not to a UTC
instant — 11:00 GMT in winter, 11:00 BST in summer (12:00 CEST = 10:00 UTC). The UK and EU change
clocks simultaneously at 01:00 UTC on the same dates (Directive 2000/84/EC), so the GB↔CET offset
is a constant hour and a CET-anchored deadline sits at a **constant UK local time**. EPEX's "GMT"
label is a winter snapshot. Store as `Europe/London`, convert at use.

**What is not established, and is the actual check:** that reasoning is proven for SDAC only. The
GB-only auctions — EPEX 30-min intraday 08:00 and 17:30, EPEX 60-min day-ahead 09:20, EPEX 30-min
day-ahead 15:30 — and N2EX's 09:50 have no published DST statement either way. The constant offset
means CET-anchoring and UK-local-anchoring give an identical answer; only UTC-anchoring would
differ.

**The check, when someone gets to it:** pull a published auction result timestamp from July and one
from January and compare. Five minutes against real data, and it settles it definitively. Worth
doing because this repo has form here — audit B2 was date helpers rounding in the viewer's local
zone before converting to UTC, and the jest suite silently ran in machine-local time until
`globalSetup` pinned it.

**Trigger:** any feature that displays, counts down to, or aligns anything with a market deadline.
Until then it changes nothing.

## 5c. Re-validate the map thresholds once there is more than a week of data

**Not blocking. Re-run when a season's worth of history is reachable.**

Raised 2026-08-15 while re-placing the `%`-of-capacity bands. The proposed set
(`[3, 10, 20, 30, 40, 50, 70]`, eight bands) beats the current `[10, 20, 35, 50, 70]` on every day
tested — but that is **six days, four of them in a single August week**, plus one December day
built from snapshots. "Robust across six days" is not "robust".

**What is safe to rely on** (structural, sample-independent):
- MW-as-fill correlates 0.93–1.00 with installed capacity at every daylight hour. That is a fact
  about the capacity distribution, not about a day's weather.
- Only the *first* threshold is load-bearing. Moving it from 3 to 5 doubles the December
  bottom-band share (14% → 26%); everything above it can be rounded freely with no measurable cost.
- Spatial spread is a property of the **weather regime, not the country** — NL's twelve provinces
  spanned 2pp one day and 55pp the next.

**What needs more data:** the threshold values themselves, and whether eight bands still earns its
extra steps outside August. December's median is 6% of capacity against August's 35%, so the shape
of the distribution moves enormously across the year and two seasons is a thin basis.

**Why it did not get done now:** the dev API's retention is short — `period` returned nothing before
roughly 13 Aug, and the December day had to be assembled from 26 individual `snapshot` calls at
5 req/s (`scratchpad/pull-day-snapshots.mjs` does this and resumes after a token expiry).

**The check:** pull a spread of days across all four seasons — prod history if it is reachable,
otherwise re-run the snapshot builder each month — and re-run the comparison in
`docs/feedback/FEEDBACK-MATRIX.md` §6b's companion analysis: bands used, largest single band, and
top-band share at peak. **Watch the largest-band figure, not a flat/not-flat count** — an 80%
threshold missed a 58% pile-up during this session and gave a false pass.

**Trigger:** before the thresholds are treated as settled, or at the next seasonal turn, whichever
comes first.

## 5d. An "as at" time control — replay the data as it stood earlier

**Idea, not a decision. Nothing depends on it; raised so it does not get lost.**                                                                                                                     
                                                                                                                                                                                                     
Raised 2026-08-15 (Brad). Today the cursor moves along the *target* axis: it picks which                                                                                                             
half-hour of generation you are looking at, always as described by the **latest** forecast run.                                                                                                      
There is no way to ask the opposite question — *what did we think at 09:00 this morning?* — which                                                                                                    
means the UI can show what happened but not what anyone knew at the time.                                                                                                                            
                                                                                                                                                                                                     
**Why it is worth a thought:**                                                                                                                                                                       
                                                                                                                                                                                                     
- It is the missing half of the revision question the corpus keeps raising. David at NESO reports                                                                                                    
"very large revisions of the forecasts as we progressed through today" and wants deltas against                                                                                                    
the 8h, 4h and 24h-ahead forecasts (`docs/feedback/FEEDBACK-MATRIX.md` RS-8); Archy's "lo-fi                                                                                                       
alert" was Peter messaging him that the forecast had moved overnight. Both are asking to see a                                                                                                     
past state of the forecast, not a past target time.                                                                                                                                                
- It is also how a miss gets defended. "The 11:45 run had it at 3 GW" is a different and more                                                                                                        
useful statement than "it turned out to be 4 GW", and the control room's decisions fix at the                                                                                                      
4-hours-ahead point, so the forecast *as it stood then* is the one they acted on.                                                                                                                  
- The chart already holds the concept — `PAST_FORECAST`, and sites' N-hour-ahead horizon — so                                                                                                        
this is partly surfacing something the data model understands and the UI does not expose.                                                                                                          
                                                                                                                                                                                                     
**What it is not:** not the existing scrubber with a different label. Two independent axes —                                                                                                         
target time and run time — and conflating them is the easiest way to build something that looks                                                                                                      
right and answers neither. Worth being explicit about which one a given control moves.                                                                                                               
                                                                                                                                                                                                     
**Open questions before any design:**                                                                                                                                                                
                                                                                                                                                                                                     
- Does the v1 API serve a forecast *by init time*, or only the latest run per target? If not, this                                                                                                   
is an API ask first and a UI question second.                                                                                                                                                      
- Does it apply to the map, the chart, or both? A per-run map is a much heavier data path than a                                                                                                     
per-run national series.                                                                                                                                                                           
- Does it interact with the country cadence work? GB publishes every 30 minutes, NL every 15, so                                                                                                     
"as at 09:00" resolves to a different run per country.                                                                                                                                             
                                                                                                                                                                                                     
**Trigger:** revisit alongside Delta v2 (contract OPEN 9) — they are the same underlying axis, and                                                                                                   
designing one without the other risks two controls that mean nearly the same thing.

## 6. Older open questions, still open

From the contract: **OPEN 8** region types across countries; **OPEN 9** the full A/B comparison
picker (Delta v2 — Brad's "circle back"); **OPEN 10** the sites zoom bands. **OPEN 7** is partly
answered by the coverage indicator but not for the chart. Also still queued: entitlement moving
into `setEnabledCountries` when the Auth0 `countries` claim ships (which retires the temporary
`NEXT_PUBLIC_DEV_ENTITLE_COUNTRIES` override, commit `117f5aa`); whether `MeasuringUnit` may edit a
non-focused country's aggregation level; the constraints overlay being focused-country-only; and
the hydration errors Brad parked ("4 errors" toast, dev only).

---

## How to work on this, per Brad

**Reason about design before building it, not after.** Twice this session a design decision was
made inside an agent brief and explained afterwards — hiding the Clouds toggle, and the footer
rework. His words: "this is exactly the sort of thing I would want to reason with you *first*,
rather than jumping in at once and having to try to work backwards through your logic and read a
wall of text about decisions made without me."

**Values need to be seen, not argued.** The footer's layering was carefully reasoned and then
rendered at opacities where the reasoning was invisible: "the code might be better than the final
effect". Build the mock, leave it uncommitted, and iterate one change at a time with him driving.
