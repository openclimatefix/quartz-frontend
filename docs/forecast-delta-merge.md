# Merging the forecast and delta maps — and what Delta v2 needs to know

**Start here.** Written 2026-08-15 at the end of a session, to be picked up cold. Nothing below is
in flight; the tree is committed and green (1213 tests / 54 suites, typecheck clean).

The immediate job is a refactor. The second half is context for Delta v2 (contract OPEN 9) that
came out of the same investigation and would otherwise be lost.

---

## Part 1 — the merge

### The problem

`pages/index.tsx:108` swaps `<DeltaMap>` for `<PvLatestMap>` on `comparison`. Each owns its own
`<Map>`, which constructs a `new mapboxgl.Map`. So selecting a comparison tears down the GL
context, the sources, the geometry and the satellite tiles, and builds a new map — the flash Brad
described.

The camera reset that came with it **is already fixed** (commit `d1dd82d`): the framing effect's
guard was a `useRef` that died with the component, so the fresh instance refit to country bounds
and threw away the user's pan. It is module state now. The flash remains.

### Why it is cheaper than it looks

The two components already agree on everything structural:

| | value |
|---|---|
| data hook | both call `useEnabledCountryMapData` |
| source id | both `PV_SOURCE_ID` (`"latestPV"`) |
| layer ids | both `latestPV-forecast`, `-borders`, `-select-borders` |
| paint updates | both already `setPaintProperty` on those same layers |

They are not two maps. They are one map with two paint configurations, split across two components
by history. `deltaMap.tsx` is 228 lines; `pvLatestMap.tsx` is 543.

### Intent vs accident

Brad's question was which differences are deliberate. Contract §2 already says delta "differs by
*what the map's fill encodes*" — sequential becomes diverging — which makes everything else
accident by definition. That holds up against the code:

**Genuinely intentional — keep:**

- ~~**Fixed `fill-opacity: 0.7` on delta.** Delta encodes sign *and* magnitude in hue via
  `deltaBucket`, so opacity is free.~~ **Overturned 2026-08-16.** Opacity was not free: hue
  distinguishes buckets but does not *rank* them at a glance, so a flat 0.7 painted a 5% miss as
  solidly as a 35% one and the map read as uniformly alarmed. Delta now spends opacity on
  magnitude too (`DELTA_BUCKET_OPACITIES`), same as the forecast map. Do not restore the flat
  value — see the delta colour scale section below.
- **"Capacity" as a unit.** Installed capacity has no delta. Genuinely inapplicable.

**Accident — port them, they cost almost nothing once the component is one:**

- **Clouds.** Arguably *more* valuable on delta than on forecast: delta is forecast error and cloud
  is its dominant driver. The most-requested map feature in the research corpus (FB-020, David
  Lenaghan, NESO) is literally *"attribute a change in forecast to a thickening or thinning of the
  cloud cover in a particular area"* — a delta-shaped question, currently only answerable on the
  view that cannot answer it.
- **Constraints overlay** (`boundary-data` + labels). Nothing forecast-specific about it, and
  "constraints overlay is focused-country-only" is already an open item in §6 of the followup doc.
- **The PV layer toggle** (`showPvLayer`). Toggles the fill; on delta it would toggle the delta
  fill.
- **Aggregation level.** `deltaMap`'s comment says "the delta view is single-region-level only",
  but the *reason* it gives is that `pages/index.tsx` forces finest anyway. That is a description of
  current behaviour dressed as a rule. **`rollUpRegionValues` already accumulates `delta` and
  `hasDelta` across group members and buckets the result** — a DNO-level delta is computed today
  and simply never offered.
- **`activeUnit` is vestigial on delta.** `pages/index.tsx` passes `activeUnit` and `setActiveUnit`
  to `DeltaMap`, whose props type declares both, and the component destructures only `className`.
  Passed and dropped on the floor.

### Shape of the work

Move delta's paint and popup into `pvLatestMap` behind a `comparison` branch, gate the cloud and
satellite machinery, delete `deltaMap.tsx`. Estimate: a focused couple of hours.

**Watch for:**

- `pvLatestMap` carries satellite tiles, a TIF LRU cache and a prefetch loop. In delta mode these
  must be genuinely *idle*, not merely invisible — a fetch loop running behind the delta view would
  be a silent regression. (Unless clouds are ported at the same time, in which case it should run.)
- The loading/failure gates differ slightly. Both were fixed on 2026-08-10 to gate on `hasValues`;
  reconcile them rather than dropping one.
- `CountryCoverageBanner` and `MAP_TITLE_DELTA` are delta-side details to carry across.
- Only two test files mention `deltaMap` (`use-enabled-country-map-data.test.tsx`,
  `map-value-join.test.ts`) and neither is a component test for it, so the test surface is small.
- **The popup.** Forecast shows capacity / actual / forecast; delta shows the difference. On one
  map the honest answer is probably one popup carrying all of it, rather than two that each hide
  half. That is a small design decision, not a mechanical port.
  **Partly settled already** (2026-08-16): both popups now name the observer, and both read it
  from the same per-country `observerLabelByCountry` off the fan-out — so merging them is a
  matter of choosing which figures to show, not of reconciling two different ideas of what the
  "actual" is.

---

## Part 2 — how delta actually works today (Delta v2 prep)

Recorded because it is not written down anywhere and the next person will assume it is simpler
than it is.

### ⚠️ The chart and the map compute *different deltas* under the same name

This is the most important thing in this document.

| | A side (forecast) | B side (actual) |
|---|---|---|
| **Chart** (`getDelta`, `use-format-chart-data.tsx:92`) | `PAST_FORECAST` — the forecast *as it was made*, not the current one | `GENERATION_UPDATED` if present, else `GENERATION`, else falls back to `FORECAST − N_HOUR_FORECAST` |
| **Map** (`buildRegionValues`, `helpers/data.ts`) | the **current** forecast series | the country registry's `mapObserver` — `pvlive_in_day`, i.e. *PV Live Estimated*, for GB |

So the chart answers "how wrong was the forecast we published at the time, against the best actual
we now have", and the map answers "how far is today's forecast from the in-day estimate". Those are
different questions. Neither is obviously wrong; they should not silently share a name.

Brad described the intended default as *"forecast against most up-to-date actual, which is
sometimes PV Live Updated, sometimes PV Live Estimated (a hybrid case)"* — that is the **chart's**
behaviour. The map does not do it.

### The observers, by their real names

`GET /GB/solar/generation-sources` returns, in this order:

| `name` | label |
|---|---|
| `pvlive_in_day` | **PV Live Estimated** |
| `pvlive_day_after` | **PV Live Updated** |

The map used to take `[0]` — "first in the manifest" doing load-bearing work that nobody chose.
NL has one observer (`ned_nl`), which is why it never bit.

**Fixed 2026-08-16, as far as it can be fixed without v2.** `components/map/map-observer.ts` is
now the single decision point: `resolveMapObserver` reads `mapObserver` from the country
registry (GB `pvlive_in_day`, NL `ned_nl`) and falls back to `[0]` only when the configured name
is absent from the manifest — where the alternative is a 400 and a blank map. Same observer as
before for both countries, so **no pixel moved**; what changed is that something chose it, and
that the choice is now on screen:

- the forecast popup's heading is `PV Live Estimated / Forecast`, not `Actual / Forecast`
- the delta popup carries a `PV Live Estimated − forecast` caption
- the delta legend's caption reads `MW · PV Live Estimated − forecast`

**The direction is `generationMw - forecastMw`** (`helpers/data.ts`), i.e. **positive means the
actual came in above the forecast** — an under-forecast. Both captions were written the other way
round on 2026-08-16 and corrected the same day, which is the argument for stating the subtraction
rather than "forecast vs actual": "vs" does not fix a direction, and the cold-to-hot ramp cannot
fix it either, so the sign was unreadable from anywhere on screen.

The label travels out of the values pipeline with the observer (`MapRegionValues.observerLabel`
→ `CountryStatus` → `observerLabelByCountry`), keyed per country, so the name on screen cannot
drift from the stream the numbers came from and GB/NL in one frame each name their own.

This deliberately does **not** make the map show "the best actual at this slot". That is v2's
requirement 1 below, and the reasoning for leaving it: switching to a hybrid silently would have
turned a wrong-but-consistent map into a right-but-unaccountable one, since nothing on screen
could have told the user which stream a given slot resolved to. Naming it first is what makes
the hybrid checkable when it lands. Note also that on the map — one timestep, not a series — the
hybrid must resolve **per frame, not per region**, or a single frame paints some regions against
Updated and others against Estimated and is not comparable with itself.

### What Delta v2 needs to support (Brad, 2026-08-15)

1. **An explicit B side, not just the hybrid default.** Keep "most up-to-date actual" as the
   default, but let a user pin *just* Estimated or *just* Updated. The hybrid is right for a
   glance and wrong for analysis, because the series changes definition partway along its own
   x-axis.
2. **Honest gaps.** When the chosen B side has no value at a timestep, show a gap rather than
   substituting the other stream or drawing zero. This is the same three-state discipline the map
   already keeps (`value` / `no-data` / `unpublished`) applied to the comparison.
3. **N-hour forecast through time, on the map.** The chart already has the mechanism
   (`PAST_FORECAST`, and `N_HOUR_PAST_FORECAST` on sites); the map has no spatial version of
   forecast-vs-earlier-forecast at all. This is RS-8 in the feedback matrix — "where were the
   largest revisions, and when" — asked for by NESO, the control room and Axle independently.
4. **PV Live streams against each other.** Estimated vs Updated as an A/B pair, with no forecast
   involved. **Specifically requested**: David Lenaghan (NESO), Feb 2025 — *"delta between PVlive
   estimate and updated"*, and *"also historically"*. In the matrix as FB-024's neighbour in the
   same session.

All four fall out of the same generalisation: delta stops being "forecast vs generation" and
becomes **any A against any B**, where A and B are each one of {current forecast, forecast as of
N hours ago, PV Live Estimated, PV Live Updated}. `COMPARISON_PRESETS` is already shaped for
this — it is a list, and `null` is a legal member meaning "no B side".

Naming note: the option is now labelled **"Delta"** rather than "Generation" (commit `b56993c`).
With a second preset, two options both called "Delta" collide — the answer is either a suffix
("Delta vs Updated", "Delta vs 4h") or one Delta option with its B side chosen in a second
control. That decision belongs to v2.

### The delta colour scale

Current buckets are `DELTA_BUCKET` in `constant.ts`, painted from `theme.colors["ocf-delta"]`:

```
100 #9AA1F9   200 #9EC8FA   300 #70859D   400 #4F5D66
500 #6C6C6C (neutral)
600 #67643B   700 #9F973A   800 #FCED4F   900 #F19F38
```

The *structure* is already cold → neutral → hot, which is right. The execution is not: periwinkle
to sky-blue to slate on the cold side, olive to yellow to orange on the hot side, and lightness is
not monotonic (800 `#FCED4F` is far brighter than 900 `#F19F38`, so the most extreme positive
bucket reads as *less* extreme than the one below it).

There is direct user evidence: Cobblestone, Jul 2024 (FB-045) — *"the colour scheme on the platform
can be worked with as the delta screen with the purple and yellow lines are not very intuitive
right off the bat"*.

The legend for these was slimmed to a single row on 2026-08-16 (`DeltaBands`) — nine equal
`flex-1` cells at `text-2xs`, down from ~three wrapped rows of `text-sm` pills, with the signs
hoisted to a single `−` and `+` flanking the row and the magnitudes left bare inside it. That
last part is what made it fit comfortably rather than barely: the cells are equal-width, so the
widest one sizes all nine, and `+100` was costing every cell ~6px it did not need. It stays
**discrete** rather than becoming a gradient like the percentage ramp, for two reasons: the paint
expression is a `step` over nine buckets, so a smooth ramp would describe a map that does not
exist; and a gradient would make the non-monotonic lightness below visible as a bulge. If v2
fixes the palette, converting this to a `PercentRamp`-shaped continuous bar becomes a real
option — Brad's preference order was one line first, ramp as the fallback.

**Brad's steer for now:** a standard cold-to-hot diverging range with a neutral greyish middle. He
may supply a specific scheme when v2 starts; until then assume that shape and keep the neutral
genuinely neutral, so "no meaningful difference" reads as absence rather than as a colour.

**The ±80-vs-±100 question (§4 of `phase6-followup-outstanding.md`) is answered and closed:
neither.** Measured 2026-08-16 over every daytime region-slot of 14–16 Aug, both countries, live
API:

| against the ±25…±100 MW edges | neutral bucket | outer buckets |
|---|---|---|
| GB, 338 GSPs (n=22,525) | **96%** | 0.4% |
| NL, 12 provinces (n=1,570) | 20% | **45.5%** |

GB's delta map is 96% grey because 200 of 338 GSPs have less installed capacity than the ±25 MW
first edge — they cannot leave neutral by any physically possible error. NL pins nearly half its
slots to the extremes. Dan's instinct that ±100 is wrong is right; ±80 is the same mistake at a
different value, because no fixed megawatt scale survives a 48× capacity spread within GB, let
alone across two countries.

Median |delta| as a share of capacity is **3.2% for GB and 5.1% for NL** — close enough that one
percentage scale serves both. Shipped 2026-08-16 as the percentage half of the unit toggle; the
megawatt edges are untouched and still selected by MW mode.

**Settled at ±5/10/20/35%** (`DELTA_PERCENTAGE_EDGES`) — GB 63% neutral / 1.0% outer, NL 49% /
4.8%. The first cut was ±2/5/10/20%, fitted to keep all nine buckets busy, and that is the wrong
target: Brad on seeing it live — *"we're showing a little too much deviation ... it's a regional
forecast of weather, so there's going to be some swing ... I don't want to feel like it's more
extreme than it either is, or needs to be visually."* A regional solar forecast has an
irreducible noise floor and colouring it makes ordinary weather look like error.

**The other half of that fix is `DELTA_BUCKET_OPACITIES` (0.35 → 0.85).** Delta drew at a flat
`0.7` on the reasoning recorded in §"Intent vs accident" above — hue carries sign *and* magnitude,
so opacity is free. That reasoning is wrong and this supersedes it: at constant opacity a region
5% off its capacity paints exactly as solidly as one 35% off, so the map reads as uniformly
alarmed and the eye cannot rank anything without going to the legend. Opacity now steps with the
bucket, gently (Brad: "less severe ramp") so the first step still reads as present. The legend
cells carry the same ramp inline, or it would stop describing the map.

**Caveat: three days, one season.** Re-derive before trusting it in winter, and check a third
country against it rather than assuming it on.

---

## Related reading

- `docs/phase6-layout-contract.md` §2 — why delta is not a peer view
- `docs/phase6-followup-outstanding.md` §1, §4, §5c — the stale GB generation cache (still
  reproducing as of 2026-08-15, `cache_updated_utc` ~20h old), the ±80 bucket question, and the
  threshold re-validation
- `docs/feedback/FEEDBACK-MATRIX.md` (untracked) — RS-5 satellite overlay, RS-8 revisions,
  FB-024/FB-045 the delta quotes above
