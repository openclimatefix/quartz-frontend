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

## 1. Blocking something else

**The pre-warm cache is stale, API-side.** GB's per-GSP `generation/period` came back with
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
