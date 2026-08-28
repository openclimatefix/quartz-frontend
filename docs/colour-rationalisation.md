# Colour rationalisation — nowcasting-app

Status: **implemented, in progress, uncommitted.** Started 2026-08-26, handed off 2026-08-27.
66 files changed, plus `styles/tokens.css`, `components/helpers/colour.ts`, `components/dev/`
and `fonts/` as new files. 1281 tests pass, typecheck clean, app compiles. Nothing committed.

Brad is designing by eye against a running dev server and iterating; this document is the
state of play, not a finished spec.

## Read this first if you are picking it up

1. **The token layer is the API.** Components name roles (`bg-surface-panel`, `text-content`,
   `text-solar`) and never a hex or a ramp step. `styles/tokens.css` is the only place raw
   values live. Do not reintroduce palette classes.
2. **Three kinds of colour, and they behave differently.** Roles are themed CSS variables.
   Data colours (`solar`, `wind`, `series`, `plot`) are literal hex in `tailwind.config.js`
   because Mapbox and Recharts read them as values at runtime and must not drift between
   themes. Reading a *role* from `tailwind.config` in JS gives you the raw template
   `rgb(var(--x) / <alpha-value>)`, which is invalid CSS and fails silently — use
   `useTokens` from `components/helpers/colour.ts` instead.
3. **Design decisions are Brad's.** Offer options, mock them, let him judge. Several things
   below are provisional and he has said so.
4. **A temporary theme toggle** sits bottom-left (`components/dev/theme-toggle.tsx`, mounted
   in `_app.tsx`). Delete it when the palette settles.

## Where it got to

**Done and stable**

- Fonts: MatterXH / MatterSemiMono / Pangram Sans self-hosted in `fonts/`, declared in
  `_app.tsx`, Google Fonts request removed. Weights capped at 500 — Matter has no face above
  Medium and 78 call sites were faux-bolding.
- The role layer, with dark default and a `.theme-light` block.
- 338 colour class usages migrated, plus 198 Tailwind-default classes (`text-white`,
  `bg-black`, `border-white/10`) that the first pass missed and which were why light mode
  looked half-applied.
- `config/`, `lib/` and `hooks/` added to Tailwind's `content` globs. They were never scanned,
  so the per-country series legend swatches in `config/countries.ts` had **never** rendered a
  colour. Pre-existing, confirmed against HEAD.
- Neutral ramps (`--ocf-ink-0..6`, `--ocf-paper-0..4`) interpolated along the brand's own line.
  Both brand blacks sit at exactly H=180 (cool) and the greys at H=24–36 (warm) — the palette
  is a temperature gradient, not one neutral. The ramps reproduce the brand values exactly at
  ink-1/ink-4 and paper-1/2/4; the rest are the derived in-between steps.
- `useTokens` — resolves role tokens for Mapbox/Recharts and re-reads on theme change via a
  MutationObserver on `<html>`. This is the mechanism light mode needs for the chart.

**Provisional — Brad has said these may move**

- Solar `#FFD480` and wind `#65B0C9` (Visualisation family). May become a bespoke saturated
  "commercial" palette; see the open problem below.
- Selection style, and how much orange survives. Currently: neutral fill plus an orange edge
  whose loudness is one knob, `--selected-edge-alpha`.
- The chart's three-step nesting (card ink-4, header ink-3, plot well ink-2).

## Settled rules

- **Orange is interactive, and nothing else.** It never appears as a data series. The electric
  Data palette is for *standalone comparison* charts (our forecast vs a third party's), not for
  the dashboard's own series.
- **Internal ("Additional") brand colours are off limits** for anything customer-facing. Main
  Data colours are allowed. Visualisation family is the default reach.
- **Orange is muted at rest and only lights on hover** — including the logo, via a grayscale
  filter rather than a second asset.
- **Selection is carried by weight, not hue.** Unselected must never look heavier than selected;
  that inversion was the original bug.
- **Single-select and multi-select must not look alike.** Single-select is a well with the
  chosen one lifted out (`CONTROL_ROW`); multi-select is independent outlined switches
  (`CONTROL_ROW_MULTI`). See `docs/phase6-track-a-notes.md`.
- **Data colours are never themed.** They encode values.

## The open problem

**The visualisation palette does not have enough hues for this chart.** It gives five, two of
which are committed to solar and wind. The chart needs to separate Current, N-hour, ECMWF,
Met Office, satellite, seasonal and the actual — so Met Office and satellite currently share
the blue family and read as related when they are not, and Met Office's old chartreuse
`#B9D532` had a distinct identity the brand has no equivalent for.

Brad's own framing: *"keep the yellow and we might need to saturate later when this is all
balanced."* Escape hatches, in his stated order of preference: main Data colours
(`#306BFF`, `#10C5F7`, `#B701FF`, `#17E58F`), then a bespoke saturated palette for this app
that keeps the brand feel but makes the relationships work.

Light mode makes the same point from the other side: the soft visualisation colours nearly
vanish on oat, because they were designed for editorial pages, not a dense dashboard.

## Known gaps

- **Light mode is unfinished.** The map is a Mapbox style JSON that needs a second style URL
  for light. The chart is partly done — `CartesianGrid` now follows the tokens via `useTokens`;
  the series colours and the axis/label colours do not yet.
- **`ocf-delta`** — 91 references, ring-fenced. A real divergent scale that needs designing,
  not renaming. Brad: "we'll circle back to."
- **The header country toggle** is a multi-select wearing a bonded pill, which by the rule
  above reads as single-select. It is differentiated by its per-country lamp instead. Looks
  deliberate — there is a design comment and a test — but it is the one place the two shapes
  still overlap.
- **`ChartCountryPicker` is unmounted, not deleted.** With it gone the only way to change which
  country the chart reads is clicking the map. Fine for now, by Brad's call.
- **Retired palettes are commented, not deleted**, in `tailwind.config.js`. Delete once settled.
- **`wind` (`#65B0C9`) has no consumers yet** — reserved deliberately, since wind is not in the
  app. Likewise `font-number` (Pangram Sans): the face is loaded and the brand's numeral font,
  but nothing uses it. Neither is dead; both are waiting.
- `font-serif` has zero uses and Source Code Pro is no longer loaded; `serif` is still in the
  config.

## Watch out for

- **Brad edits the same files between turns.** Re-read before editing; assert on the current
  string rather than a remembered one. A wired `CartesianGrid` was silently reverted by a save
  once already.
- **The map's opacity ramp is load-bearing.** `safelist` generates `bg-solar/3` … `/100`, and
  the `/3` band distinguishes "published a real zero" from "published nothing"
  (`BAND_OPACITIES` in `feature-state.ts`).
- **Fixed heights hide behind type changes.** `h-10 dash:h-14` held the chart header open
  regardless of content; slimming the type did nothing until it was found. The regional header
  has its own equivalent at `forecast-header-gsp.tsx:34`.
- **Blanket `fillOpacity` in Recharts** composites colours against what is behind them, so the
  value you set is not the value you see. Put alpha in the colour.

---

# Reference

The rest of this document is the working-out: why the config was a mess, what the brand
guidelines actually say, and the decision record. It does not change turn to turn.

## Why the config needed this

`tailwind.config.js` has stopped being a palette and become a bag of identifiers. Numeric
shade slots no longer mean lightness, so nobody can predict what a class will look like
without opening the config:

```
ocf-gray:  50/100/200/300 → all #FFFFFF        four names, one colour
           700 #ACACAC · 800 #292B2B · 900 #747474
           non-monotonic — 800 is the darkest, 900 is mid, 700 is light
ocf-black: 600/700/800/900 → all #000000       four names, one colour
ocf-delta: 100 #9AA1F9 · 200 #9EC8FA · 800 #FCED4F · 900 #F19F38
           not a ramp at all — a categorical chart set wearing ramp clothing
```

`text-ocf-gray-300` is the single most-used colour class in the app (29 uses) and it is
plain white.

Scale of the change: **338 colour class usages, 80 distinct**, across `components/` and
`pages/`.

## What the brand guidelines actually say

From `~/Projects/OCF Design/Brand Guidelines 2025.pdf`. The important discovery is that the
brand defines **three palettes with three different jobs**, and the app currently draws from
one undifferentiated pool.

### 1. Brand / UI (p4)

| Name | Hex |
|---|---|
| Brand Orange | `#FF4901` |
| Brand Orange Light | `#FF8F73` |
| Black 1 | `#292B2B` |
| Black 2 | `#0C0D0D` |
| White | `#FFFFFF` |
| Grey 1 | `#FFFBF5` |
| Grey 2 | `#F0ECE8` |
| Grey 3 *(doc labels this "Grey 2" twice — typo)* | `#D9D0CA` |

Brad's uncommitted edits already match this exactly: `ocf-primary #FF4901` = Brand Orange,
`ocf-gray-800 #292B2B` = Black 1, `ocf-black #0C0D0D` = Black 2.

### 2. Visualisation (p6) — "natural and soft to contrast with our electric brand colour"

Explicitly inspired by the troposphere, cool sky blue → warm sunlight. This is the **map and
weather** family.

| Name | Hex | Light |
|---|---|---|
| Blue | `#4675C1` | `#9CB6E1` |
| Sky Blue | `#65B0C9` | `#A3D6E0` |
| Teal | `#58B0A9` | `#9ED1CD` |
| Yellow | `#FFD480` | `#FFE9BC` |
| Orange | `#FAA056` | `#FFDABC` |

### 3. Data (p7–p8) — "electric contrasting colours for easy visual separation"

The **chart** family. Critical rule, quoted: *"Each electric colour has a corresponding
lighter shade to create mono-coloured comparative graphs."*

| Name | Hex | Light partner |
|---|---|---|
| Data Blue | `#306BFF` | `#9CB6E1` |
| Data Sky | `#10C5F7` | `#A3D6E0` |
| Brand Orange | `#FF4901` | `#FF8F73` |
| Data Purple | `#B701FF` | `#EFC8FF` |
| Data Green | `#17E58F` | `#B8F5DB` |

Additional, marked **internal use only** (p5, p8) — which this dashboard qualifies as:
Data Black `#292B2B`, Data Burnt Orange `#BF4F04`, Data Amber `#FC9700`,
Data Magenta `#FF17EC`, Data Deep Teal `#009C75`.

> Two errors in the PDF, corrected here by sampling the rendered page:
> Data Magenta is printed as `#FC9700` (a copy of Data Amber) — the true value is `#FF17EC`.
> The last light swatch is labelled "Data Purple Light #EFC8FF" twice — the second is
> Data Green Light `#B8F5DB`.

### What the brand does *not* give us

**There is no dark neutral ramp.** Only Black 1 and Black 2 at the dark end, and three warm
light greys at the other. A dark dashboard needs roughly four steps between `#0C0D0D` and
`#FFFFFF`. We have to derive them, and they should be **warm-tinted** to sit with the warm
light greys rather than pure neutral — otherwise dark and light modes will not look like the
same product.

## Decision record — orange vs yellow

Brad's instinct — orange for neutral/interactive chrome, yellow reserved for Solar — matches
how the guidelines are structured (electric brand colour for brand moments, soft natural
colours for visualisation). But there is a genuine collision to resolve before we build:

**`#FF4901` is simultaneously Brand Orange (the interactive colour) and Data Brand Orange
(a chart series colour).** If orange means "you can click this" in the chrome and also
"this is a data series" in a chart on the same screen, the meaning is ambiguous. Options:

- **(a) Orange is interactive only.** Charts never use `#FF4901`; series draw from Data
  Blue / Sky / Purple / Green / Amber. Cleanest rule, costs us the strongest data colour.
- **(b) Orange is data only.** Interactive elements stay yellow, as today. Safest, but wastes
  the brand refresh.
- **(c) Split by surface.** Orange is interactive in chrome (header, buttons, controls) and a
  series colour inside chart canvases, on the grounds that a chart is a bounded context.
  Most expressive, highest risk of confusing people — and hardest to hold the line on later.

**Recommendation: (a).** Once the Data palette is reserved for standalone comparisons, orange
has no job left inside the dashboard except "you can act on this" — so give it that job
exclusively and it becomes the most useful colour in the app. (c) only pays off if in-app charts
regularly carry a third-party series; if that becomes common, revisit. Mocked in
`docs/mocks/colour-orange-yellow-options.html`.

One honest wrinkle in (a): the chart cursor. It is orange in the mock because you drag it, but
it is also a mark on the data. Either accept it as a control, or make it neutral white — worth
deciding by eye.

Related, smaller: Solar is currently `#FFD053`; brand Visualisation Yellow is `#FFD480`.
Close but visibly lighter and less saturated. Adopting the brand value is a real, if subtle,
change to every solar-coloured thing in the app.

## Proposed structure

Three layers, each with one job. Tailwind never sees a hex.

```
styles/tokens-brand.css   raw brand values, named as the guidelines name them. Never
                          referenced by a component. Changes only when the brand changes.

styles/tokens-theme.css   role assignments. Dark is the default; the light block is the
                          whole of "light mode" when we want it.

styles/tokens-data.css    series and scale colours. NOT themed — these encode values and
                          must not drift between modes.
```

Sketch of the role layer:

```css
:root, .theme-dark {
  --surface-base:   #0C0D0D;   /* Black 2 — page */
  --surface-panel:  #292B2B;   /* Black 1 — cards, sidebar */
  --surface-raised: derived;   /* hover, popovers — needs deriving, see gap above */
  --border-subtle:  rgb(255 255 255 / 12%);

  --text-primary:   #FFFFFF;
  --text-secondary: derived;
  --text-muted:     derived;
  --text-on-accent: #0C0D0D;

  --interactive:    #FF4901;   /* pending the orange/yellow decision */
  --interactive-hover: #FF8F73;
}
```

And the data layer, kept deliberately apart:

```css
:root {
  --data-solar:          #FFD480;
  --data-solar-light:    #FFE9BC;   /* the forecast half of the pair */
  --data-wind:           #65B0C9;   /* or Data Sky #10C5F7 for charts — TBD */
  --data-wind-light:     #A3D6E0;
}
```

**The forecast/actual pattern falls straight out of the brand's own rule.** "Mono-coloured
comparative graphs" — solid for actual, light partner for forecast, same hue. That is exactly
the comparison this app exists to show, and it means solar-forecast vs solar-actual reads as
one family instead of two arbitrary colours.

## What was done

All of the below is in the working tree, uncommitted.

- **Font weights capped at 500.** Matter XH has no face above Medium; 78 call sites were
  faux-bolding. hairline/thin raised from 100/200 to 300 for the same reason.
- **`styles/tokens.css`** — brand values, then roles, dark default plus a `.theme-light`
  block. Values are space-separated RGB channels so `/opacity` works on every role; the
  config wraps them as `rgb(var(--x) / <alpha-value>)`.
- **Tailwind role colours** — `surface{,-panel,-raised,-sunken,-inset}`,
  `content{,-secondary,-muted,-on-accent}`, `interactive{,-hover,-subtle}`,
  `status-{ok,warn,alert}`, `edge{,-strong}`, plus unthemed `solar` / `wind`.
- **338 call sites migrated** across 53 files, plus `globals.css`.
- **Retired** (commented, not deleted): `amber`, `ocf-yellow`, `ocf-gray`, `mapbox-black`,
  `ocf-black`, `ocf-primary`, `ocf-green`, `ocf-sites`, `ocf-dusty-orange`, `ocf-blue`.

### The yellow split

The one part a find-and-replace would have got wrong. Old `ocf-yellow` was doing two jobs;
each usage was classified by intent:

- → **`interactive`** (orange): nav hover, country picker pill, CSV modal buttons, map control
  active state, play button and speed selector, resize handle, focus rings, the auth/404/logout
  page buttons, `.btn` and `.btn-outline`.
- → **`solar`** (`#FFD480`): everything in `solar-site-view/`, the GSP and forecast headers,
  `color-guide-bar`, `pvLatestMap`, `sitesLegend`, `display-panel`, and the map fill in
  `feature-state.ts`.

`bg-amber-400` was `#FFD053` — a duplicate of the old solar yellow, so it became `solar` too.

### Deliberately left alone

- **`ocf-delta`** — 91 references, a real divergent scale. Needs designing, not renaming.
- **The chart's model-provenance series** — `ocf-teal`, `metOffice`, `ocf-orange`, the
  `seasonal` literal. `remix-line.tsx` maps ECMWF, Met Office, PVNet intraday/day-ahead,
  satellite-only and N-hour to distinct colours. Renaming those would have meant inventing
  meanings I do not have. `ocf-orange` `#FF9736` is close enough to brand orange `#FF4901`
  to be worth a look during that pass.
- Only `solar` was rethreaded through the JS reads, so the chart, the map fill and the UI now
  agree on one solar colour.
- **The map style and the chart interior.** Mapbox renders from its own style JSON and the plot
  greys in `remix-line.tsx` are inline hex (`#545454`, `#6C6C6C`, `#ffdfd1`). Neither follows a
  CSS variable, so light mode leaves both dark. Mapbox needs a second style URL; Recharts needs
  its colours read at runtime rather than imported.

### Incidental findings

- Two dead classes with no utility prefix — `className="ocf-gray-400 text-xs"` in
  `search-table.tsx` and `solar-site-tables.tsx`. They never rendered. Now `text-content`,
  which is a **visible change**: those `%` labels previously inherited their colour.
- One dead class from a typo — `hover:bd-ocf-yellow-500` in `deprecated-domain-notice.tsx`.
  `bd-` is not a Tailwind prefix. Removed.
- `country-toggle.test.tsx` was **already failing** before this work: an uncommitted edit had
  moved the OK lamp from yellow to `ocf-green` without updating the assertion. The test now
  expects `bg-status-ok`, matching the component.
- `font-serif` has zero uses and Source Code Pro is no longer loaded. `serif` is still in the
  config; worth dropping.

## Things that must not be broken

- **The map's opacity ramp.** `safelist` generates `bg-ocf-yellow/3` … `/100`, and the `/3`
  band is load-bearing — it distinguishes "published a real zero" from "published nothing"
  (see the comment in `tailwind.config.js` and `BAND_OPACITIES` in `feature-state.ts`). If
  solar yellow changes value, that ramp changes with it; the safelist entries must follow the
  rename.
- **`ocf-delta`.** It is the delta chart's divergent scale, 91 references. It needs a
  purpose-built sequential/diverging scale, not a rename — worth treating as its own piece of
  work rather than folding into the sweep.
- Data colours must not be themed. See above.
