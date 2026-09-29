# Spike: a histogram strip in place of the delta buckets

Parked 2026-09-28, launch week. Not started; nothing is mocked. Read this before touching the
bucket chips or `selectedBuckets`.

## Why

The nine delta buckets (NEG4…POS4, edges ±25/50/75/100 MW, or `DELTA_PERCENTAGE_EDGES` in
percentage mode) were an arbitrary split from v0. Since the ramp work (`678adf4f`, `7c28a214`)
they no longer colour anything: the map fill, the legend, the table rows and the chart's delta
bars all read the continuous ramp in `lib/domain/delta-ramp.ts`. What the buckets still do:

1. **Show the spread**: the count on each chip.
2. **Filter by how extreme a region is**: toggling chips filters the table (`selectedBuckets`).

Both jobs are done through edges that have no meaning of their own. Going from nine to seven
was considered and dropped: it would churn the chips, the filter and their tests for a step
this spike would undo, and it changes nothing on the map.

## The idea

One control that does both jobs on the scale everything else already uses:

- **A strip along the ramp**: the same blue → neutral → orange gradient the dock legend draws,
  with one mark per region at that region's delta. Dots (a strip plot) at GB's ~338 GSPs,
  maybe binned into small bars if dots crowd. The spread is then read where the colour is
  explained, and a region's position and its map colour are the same fact.
- **Two drag handles** set a band, "within ±X", and the band is the filter. Regions inside it
  dim in the table and, optionally, on the map. The default is nothing filtered.
- **Counts either side** of the band ("41 below · 12 above") keep the one number the chips
  were good for.
- Units follow the unit toggle, and the strip's ends are the ramp's saturation (per country and
  tier in MW, see below), so the strip, the legend and the fill cannot disagree.

## What it would replace

- `components/charts/delta-view/delta-buckets-ui.tsx`: the chip row.
- `selectedBuckets` in global state, plus the bucket assignment in `use-gsp-deltas.ts`,
  `helpers/utils.ts` and `helpers/data.ts`, if nothing else reads it. Check the national chart's
  delta bars (`remix-line.tsx`, `use-format-chart-data.tsx`) and the sites view first, since
  they touch `DELTA_BUCKET` too.
- Possibly the legend's own gradient bar in delta mode: the strip is a legend with data on it.
  Having both is two accounts of one scale.

## Depends on

The per-country MW delta scale (in progress on `spike/ocf-reskin` as of 2026-09-28). MW
saturation is derived per country and tier from `mapBands` (GB region 100, GB grouped 1000,
NL 800, DE 3000). The strip's MW ends must come from the same helper, never a constant.

## Open questions

- Where it lives: in place of the chip row above the table, or in the dock with the legend.
  The dock is nearer the map it would filter.
- Whether dimming reaches the map, or stays a table filter. Dimming the map is stronger, but it
  is a second encoding on a fill that already carries opacity for magnitude.
- Several countries on the map with different MW scales: the strip shows the focused country
  only, as the legend does. Percentage mode can show them all on one axis.
- Touch: handles on a narrow strip need a generous hit area.

## A cheaper fallback

A single "|delta| above ___" threshold with a count. It filters by how extreme a region is
but shows no spread. Worth it only if the strip proves too fiddly.

## Related possibility: forecast revision as a comparison of its own

Added 2026-09-28. Not decided, just a possibility.

Until then the national delta chart drew two quantities in one bar series. Where actuals
existed it drew actual − forecast. Everywhere else (the future, and recent periods not yet
reported) it fell back to latest forecast − N-hour forecast, a *forecast revision*. They
shared colours, axis and label, and the map only ever drew the first, so the chart and map
disagreed about "delta" after now. The fallback was removed (`getDelta` in
`components/charts/use-format-chart-data.tsx`): bars now appear only where there is an actual.

The revision is still worth having ("the forecast has come down since this morning"), and the
map-mode model already has room for more than one comparison. The possibility:

- Add **"Forecast revision"** (latest vs the N-hour-ahead forecast) as a second comparison
  beside "Actual vs forecast". Each draws one quantity, over past and future alike, on both map
  and chart. The ramp, legend and table all apply unchanged; only the two operands differ.
- The legend caption would name the operands, as "Actual − Forecast" does now:
  "Latest − 4h forecast".
- N follows the existing N-hour setting.

Open questions: whether the map should draw revisions (every region has a forecast, so it
never goes blank the way actuals do near now); how it relates to the chart's existing N-hour
line; and whether one comparison row can hold both without Delta getting more prominent than
it has earned.
