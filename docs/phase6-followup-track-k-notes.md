# Phase 6 follow-up, Track K — the map's colour bands become configuration

The map's MW and capacity opacity bands were GB's, applied to every country. Track F made the
map draw every enabled country at once, so NL's provinces were banded on GB's GSP scale — and a
province producing 1.3 GW, a perfectly normal midday value, landed in the same saturated top
band as everything else. NL rendered as one flat colour and read as "producing almost nothing".

Percentage mode was never affected: a fraction of a region's own capacity is genuinely
country-agnostic, which is why the bug had a hiding place.

The same mechanism would have caught Germany, which is meant to land as configuration only. It
now does: DE supplies five numbers (and either five more or an explicit `null`) in
`config/countries.ts` and nothing else changes.

## The config shape

`CountryConfig` gains one required field:

```ts
mapBands: {
  region:  readonly [number, number, number, number, number];  // one API-served region
  grouped: readonly [number, number, number, number, number] | null;  // a client-side rollup
};
```

Three decisions worth stating.

**A tuple, not `number[]`.** The band count is fixed by `BAND_OPACITIES` — six opacities, five
boundaries — and the legend draws one pill per band. A country that supplied four or six would
produce a map and a legend that quietly disagreed about which band a value is in, which is the
exact failure class this whole field exists to remove. The type refuses it rather than a test
catching it later.

**Two tiers, because a country can be shown at two magnitudes.** `region` is one region as the
API serves it (a GB GSP, an NL province); `grouped` is a client-side rollup of many of them
(GB's DNO and NG-zone levels). Track F made grouped-ness a per-feature flag precisely because
two countries can sit at different tiers in one frame, so a country needs both.

**`grouped: null` is the answer for a country without groupings, and it is load-bearing.** NL
has no `derivedRegionTypes`, so no NL feature can ever carry the `grouped` flag — the flag comes
from `AggregationLevel.derived`, and the levels are derived from this same registry. The honest
value is "there is no such thing here", written down. Falling back to `region` would have worked
and taught the next country nothing; falling through to GB's is the bug we just fixed. In the
expression, a country with `grouped: null` emits no `case` at all, so it is *structurally*
incapable of picking up another country's grouped numbers — not merely unlikely to.

## NL's numbers, and how they were derived

```
region:  [400, 1200, 2000, 2800, 3600]     grouped: null
```

**GB's region bands times eight**, which is the ratio between the two countries' largest single
regions. Sources are the recorded fixtures, not estimates:

| | GB | NL |
|---|---|---|
| sub-national regions | 338 GSPs | 12 provinces |
| installed capacity | 22,588 MW | 25,098 MW |
| largest region, capacity | 654 MW | 4,437 MW (Noord-Brabant) |
| smallest region, capacity | — | 943 MW (Zeeland) |
| 99th percentile capacity | 507 MW | — |
| peak output / capacity, recorded day | — | ~0.80 |
| largest region, recorded peak output | — | 3,654 MW |

(`lib/api/v1/__fixtures__/gb-regions-gsp.json`, `nl-regions-province.json`,
`nl-province-forecasts-period.json`. The NL forecast fixture holds five of the twelve provinces;
capacities for all twelve come from the regions fixture and the 0.80 ratio from the five.)

The chain: the largest NL province peaks near 3.6 GW → `3600 / 450 = 8` → scale the whole GB
shape by 8, keeping its proportions. So the top band saturates the biggest province at midday
exactly as GB's 450 saturates its biggest GSPs, and the twelve provinces' midday values spread
across bands two to five instead of piling into one:

```
zeeland 753 MW -> band 2    drenthe 1,313 -> band 3    noord-brabant 3,654 -> band 6
```

**The claim is the ratio, not five hand-picked numbers.** If NL's installed base grows, rescale
from the largest province's peak the same way. That is written in the config comment too, so the
next person to touch it knows what they are re-deriving.

Worth noticing on its own: NL's 12 provinces hold *more* installed capacity than GB's 338 GSPs.
A province is a DNO-sized object, not a GSP-sized one — which is why the flat map was the
inevitable outcome and not bad luck.

**GB's numbers are unchanged**, so the GB map looks exactly as it did. The config comment now
records where they came from (99th-percentile GSP at 507 MW, largest at 654; grouped is exactly
ten times region) so they are as re-derivable as NL's.

## One source for the numbers

There were two hand-kept copies: `feature-state.ts` built the Mapbox `step` expressions, and
`color-guide-bar.tsx` printed the same five numbers again as four hardcoded JSX lists. They
agreed only because someone kept them in step.

Now:

```
config/countries.ts  mapBands           the numbers, per country, per tier
        |
        +-- feature-state.ts  mapBandsFor(country, grouped)   the single lookup
                |                       |
                +-- bandExpression()    +-- bandLabels()
                        step 400 0.2…       ["0-400", "400-1.2k", … "3.6k+"]
                        (the map)          (the legend)
```

Formatting stays presentation — `formatBand` is what prints `1500` as `"1.5k"`, matching what
the grouped GB row has always shown. But the *numbers* have one home, and `bandLabels` takes the
same array `bandExpression` steps over. They cannot describe different bands.

The percentage row went the same way: it is `bandLabels` over
`NORMALIZED_THRESHOLDS.map(f => f * 100)`, so `"0-10" … "70+"` is now derived from the
thresholds the expression actually steps at rather than retyped. Same six labels as before.

## How the expression picks

```
["match", ["get", "country"],
  "GB", ["case", ["==", ["feature-state", "grouped"], true], step(GB grouped), step(GB region)],
  "NL", step(NL region),
  1]
```

**The country comes from a feature property, not feature state.** `stampCountryFeatures`
already writes `properties.country` on every feature (Track F), it never changes while the
feature exists, and reading it costs nothing per cursor tick. `grouped` genuinely does change —
the user switches level — and stays in feature state where Track F put it. No new feature-state
key, no change to `country-features.ts` or `use-enabled-country-map-data.tsx`.

**Still one layer.** The alternative — a fill layer per country, each with its own paint
expression — would make the count of countries visible to the click handler, the select-borders
filter and `map.tsx`'s satellite `beforeId` search. Adding arms to an expression is free;
adding a layer is not.

**The `match` fallback is opacity 1, deliberately.** It should be unreachable: the source is fed
by `stampCountryFeatures` and the fan-out draws `useEnabledCountries()`, which is enabled ∩
*configured*. Full opacity means that if it ever is reached, the map is conspicuously and
uniformly wrong. The failure being fixed here was a country rendering as "almost nothing" and
nobody noticing for a while, so the fallback must not be able to look like a quiet, believable
answer.

## The legend also stopped being GB-shaped

`color-guide-bar.tsx` chose its bands with `currentLevel?.regionType === "gsp"` — GB's region
type, by name. Two consequences, both now gone:

- NL's `province` level matched neither that branch nor the `derived` one, so with NL focused
  in MW or capacity mode the legend drew **no bands at all**, only the "no data" pill — while
  the map painted NL's polygons on GB's scale. Nothing on screen said so.
- The four lists were the second copy of the thresholds.

The rule is now on kind, not name: any level below national (`level > 0`) gets bands, from
`mapBandsFor(focusedCountry, currentLevel.derived)`. National level still shows no bands, as
before — one polygon per country has no useful band scale.

The legend explains the **focused** country's bands, as Track F left it, and still says so
("NL bands") when more than one country is enabled. That attribution matters more now than when
Track F added it: with per-country bands, "NL bands" names numbers GB's polygons in the same
frame are genuinely not drawn on. Track F's reasoning against a row per enabled country still
holds and is unchanged.

## Capacity mode

Unchanged relationship: capacity reuses the MW thresholds, per country. Installed capacity and
instantaneous output are both megawatts of the same region, and NL's capacities (943–4,437 MW)
span the new bands sensibly — Zeeland in band 2, Noord-Brabant saturating the top. Nothing here
looked wrong enough to change while also changing the scales.

## What Germany will need to supply

One `mapBands` block in its `COUNTRY_CONFIG` entry, and nothing else:

- `region` — five ascending MW thresholds for whatever sub-national region type the API serves
  (TSO zones, Bundesländer, …). Derive them the same way: largest region's *peak output* sets
  the top threshold, then scale the `[1, 3, 5, 7, 9] × T/9` shape GB and NL both use.
- `grouped` — five more if DE gets `derivedRegionTypes`, or `null` if it does not.

The field is required, so the type will not let DE be added without an answer. `tsc` is the
check that GB's numbers cannot be inherited by accident again.

## Verification

From `apps/nowcasting-app` (running these from the repo root picks up the wrong config):

- `yarn tsc --noEmit` — clean bar the known pre-existing `jest.globalSetup.ts(14,1) TS1208`.
- `npx next lint` — **16 warnings, 0 errors**, matching baseline.
- `npx jest` — **1131 passed, 49 suites**. Baseline was 1095 / 46: +7 tests in this track's new
  `components/map/color-guide-bar.test.tsx` (1 suite), +9 in `map-value-join.test.ts`, and the
  remaining 2 suites are Track L's concurrent work in the same tree, not this diff.
- `next build` — green. (The first attempt died in "Collecting page data" on
  `Cannot find module './chunks/vendor-chunks/next.js'`, a stale-`.next` race with a concurrent
  build in the same directory; the compile itself had already succeeded, and a re-run was clean
  end to end.)

### What the tests pin

This is silent-plausible territory — a wrong band is a plausible-looking map, not an error — so
the expressions are evaluated against feature states rather than inspected.

In `map-value-join.test.ts` (the evaluator gained `get` and `match`, and every existing MW case
now stamps a country, which is what the real source does):

- the same 1,300 MW lands in GB's top band and NL's middle band;
- NL's three recorded province peaks land in three different bands, and a genuine zero is still
  the faintest band rather than nothing;
- a grouped GB feature and a plain NL feature in one frame get their own country's thresholds
  (3,000 MW → 0.6 for a GB DNO, 0.8 for an NL province);
- `mapBandsFor("NL", true)` is `undefined`, and a `grouped` flag that somehow reached an NL
  feature still gets NL's region bands, not GB's 4.5 GW ceiling;
- an unstamped feature gets the conspicuous fallback;
- capacity mode uses the same per-country scale as MW;
- **for every country and every tier**, the label numbers parsed back out of `bandLabels` equal
  the thresholds, and a value on each threshold is in the band the label above it names while a
  value one below is in the band before. The parse is written independently of the formatter, so
  a wrong formatter fails too.

In the new `color-guide-bar.test.tsx`: GB draws the six pills it always drew (GSP and derived),
NL draws NL's where it used to draw none, capacity matches MW, percentage is identical for both
countries, national draws none, and the country attribution appears with two countries enabled.

## What Brad should check by eye

1. **NL in MW mode, provinces, at midday.** The point of the whole change: twelve provinces in
   visibly different shades, Noord-Brabant darkest, Zeeland faintest. If it still looks flat,
   the numbers are wrong, not the mechanism.
2. **NL and GB both enabled, GB on DNO, cursor at midday.** Both countries should read as
   "producing", neither uniformly dark nor uniformly faint. This is the frame the per-feature
   country/`grouped` selection exists for.
3. **GB alone, GSP and DNO/zone, MW and capacity.** Should be pixel-identical to before — GB's
   numbers did not change.
4. **The legend with NL focused.** It now shows six pills where it showed none; check the
   numbers read sensibly next to what the map is doing, and that "NL bands" appears when GB is
   also enabled.
5. **Sanity-check NL's five numbers against what NL actually does at peak.** The ×8 derivation
   is from a single recorded day's fixture; if NL routinely peaks well above or below 3.6 GW in
   its biggest province, rescale from that.

## One thing found and not fixed

`tailwind.config.js` safelists `bg-ocf-yellow/5, /10, /20 … /100`, but the first band renders
`bg-ocf-yellow/3` — which is not in the safelist and not a class Tailwind generates. The
faintest pill in the legend therefore has no fill at all. Pre-existing, unrelated to this track,
and in a file this track does not own, so it is reported rather than changed: the fix is either
adding `bg-ocf-yellow/3` to the safelist or moving that band to `/5`. Note the *map* is correct
— 0.03 goes straight into the paint expression; only the legend pill is unpainted.
