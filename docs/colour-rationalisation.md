# Colour rationalisation — nowcasting-app

Status: **implemented and committed.** Started 2026-08-26; committed 2026-08-28 as nine
commits on `spike/ocf-reskin`, which is a strict fast-forward of `epic/adaptive-eu-ui` (nine
ahead, nothing behind) and is not pushed. 1282 tests pass, typecheck and lint clean.

Brad is designing by eye against a running dev server and iterating; this document is the
state of play, not a finished spec.

**Direction, 2026-08-28.** The app is heading for a unified OCF Europe dashboard, so the OCF
colours stay. Returning to Quartz branding is kept as a change of values — see *Quartz mode*
below — instead of a second branch to maintain. The epic branch has no role tokens at all
(its components name `bg-ocf-yellow`, `text-black`), so there was never a non-colour subset to
extract: the behavioural work is expressed through the token layer.

**Direction, 2026-09-01 — option (a) is off; orange retires to the logo.** Design meeting
outcome: brand orange no longer means "interactive", and may not appear in the dashboard at
all. It survives on the logomark, and even that is a candidate for a hover-only treatment.
The interactive colour is Grey 1 ("oat", `#FFFBF5`) — the website's paper — and the states
that orange used to separate are now separated in one neutral hue. See *Neutral interactive
states* below. This supersedes the option (a) recommendation in the decision record, which is
kept for the reasoning, not the answer.

## Neutral interactive states

A single neutral has to do what a hue was doing, so the states run on two channels instead of
one:

| state | foreground | ground |
| --- | --- | --- |
| rest | oat (`--interactive`) | whatever surface it sits on |
| hover | white (`--interactive-hover`) | lifts one step, `surface-raised` |
| selected | `--content-on-accent` (dark) | inverts to an oat fill, `bg-selected` |
| disabled | `--content-muted` | unchanged |

Two things that fall out of it:

- **Rest is oat, not white, on purpose.** `--content` is pure white, so a control resting at
  white would be the same value as body text and carry no signal. One step down at rest is
  what leaves hover somewhere to go.
- **Selection inverts rather than stepping.** `CONTROL_BUTTON_ACTIVE` was `surface-raised`
  plus a hairline — one tone step above the idle buttons. Once the accent went neutral that
  step was the *whole* of selection, and a step in a ramp whose neighbours are steps in the
  same ramp does not pick a button out of a row of four. The selected button is oat with dark
  lettering, and carries no ring: an oat hairline around an oat ground draws nothing.
- **`--selected` is one token doing both jobs** — the ground of a selected button, and the
  foreground where selection has no ground to fill (the current nav item, the focused country
  code). Same oat, whichever side of the contrast it is on.
- **`--selected-edge-alpha` went from 0 to 1.** The edge was orange with its alpha turned off,
  which left the nav item's underline invisible. A neutral edge is not loud enough to need
  dimming, so it is on.
- **Multi-select does not invert.** The Clouds/PV switches keep `surface-raised` plus a lamp.
  Filling on selection is a single-select idea, and `docs/phase6-track-a-notes.md` is explicit
  that the two controls must not look alike.

Light mode runs the same scheme from the other end of the ramp: ink-4 at rest, ink-1 on hover,
and the ground still lifts. Oat cannot cross over — it is the paper there.

Still orange, and deliberately: the logomark, and `--ocf-brand-orange` itself, which stays at
the true brand `#FF4901` in the brand layer whatever the roles above it do. `--status-warn` is
Visualisation Orange and always was a different colour for a different job.

## Read this first if you are picking it up

1. **The token layer is the API.** Components name roles (`bg-surface-panel`, `text-content`,
   `text-solar`) and never a hex or a ramp step. `styles/tokens.css` is the only place raw
   values live. Do not reintroduce palette classes. This rule is also what keeps *Quartz
   mode* a four-file job.
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

**Done since the 2026-08-27 handoff**

- **The surface ladder moved down one step**: floor ink-1 (Black 2), recess ink-2, floating
  panel ink-3, lifted/popover ink-4 (Black 1). Popovers had to become the topmost layer, and
  going down keeps each layer one ink step from its neighbour while keeping the dashboard
  dark. Only `tokens.css` changed — no component knew.
- **The header stopped being a surface**, and the Forecast/Solar Sites nav went with it.
  `/sites` still routes; it is reached by URL. The scrub bar joined the control vocabulary as
  a Black 1 band, so header, dock, chart and footer share one depth language.
- **Wells are flat.** `WELL = "flat"` drops the inset shadow; the tone step and the
  `border-edge` hairline carry the recess. `"lit"` is still there if the modelled version is
  wanted back.
- **`COMMERCIAL` is the live palette.** Solar is `#F6C155`. `VISUALISATION` sits beside it and
  the switch is one constant, `PALETTE`.
- **The electric Data palette is in the config** as `data-*` (`data-blue`, `data-purple`, …),
  for the single-source series it was reserved for.
- **The chart has a legend again** — `components/charts/chart-legend.tsx`, mounted below both
  charts whether or not the regional one is open. Inert, drawn-series-only, no toggles.
  Option A from `docs/chart-legend-options.md`.
- **Axes are Matter Semi Mono at 10px** in the footer's tick format, naming the day only when
  it changes. The second axis row went and the plot took the height.
- **The chart cursor became a control**: orange, drawn as the same object as the scrub handle,
  and draggable. It reads Recharts' `activeLabel` instead of inverting a scale — the axis is
  categorical, so there is none — which snaps it to settlement periods for free. Its label
  group stops pointer events at source, because Recharts binds mousedown/move/up on the chart
  itself and no handler ordering wins against that.
- **Multi-select buttons carry a grayscale on/off lamp**, the header country toggle's device
  at the same 10px with a 2px ring, matched to the single-select tray's edge weight.
  `CONTROL_LAMP_BUSY` and the footer's live dot share a `beat` keyframe that fades to 5%,
  where Tailwind's `animate-pulse` stops at 50% and reads as a wobble.
- **Mapbox chrome** is black with orange glyphs, and the attribution has no card at all.
- **The footer names the selected date** (`formatISODateStringAsZonedDate`), which the new
  shell had dropped. The timezone-lock idea from the same conversation is parked — Brad: "I'm
  not sold on it yet so not investing build time." Whenever it is built: a locked zone must be
  a display transform over the instant, never a change to how a country resolves its own
  settlement period (GB labels period-end, NL period-start).
- **The plot has its own role tokens** (`--plot-base`, `--plot-band-a`, `--plot-band-b`), so
  light mode can give it paper instead of borrowing a surface role that is one value in light.

**Provisional — Brad has said these may move**

- The series palette. `COMMERCIAL` is in use and `VISUALISATION` is one constant away. Neither
  changes the open problem below: the family gives five hues for seven series either way.
- Selection style. Orange is out (2026-09-01); selection is now a neutral fill plus an oat
  edge, whose loudness is still one knob, `--selected-edge-alpha`.
- The chart's nesting, now card ink-3 with the plot well at ink-2.

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

## Quartz mode — flipping the branding back

Quartz branding can be restored without unpicking anything above, because the token layer
makes the brand a set of values instead of a property of components. Four files:

- `styles/tokens.css` — `--ocf-brand-orange` and `--ocf-brand-orange-light`. Everything
  interactive follows from those two, `--selected-edge` included.
- `tailwind.config.js` — a `QUARTZ` entry beside `VISUALISATION`/`COMMERCIAL`, and `PALETTE`
  pointed at it.
- `pages/_app.tsx` and `pages/_document.tsx` — Inter and Source Code Pro back from Google
  Fonts. Point `--font-matter-semi-mono` at Source Code Pro and the mono axes survive intact.
- `components/layout/header/index.tsx` — `QUARTZSOLAR_LOGO_ICON.svg`.

The neutral ramps stay put. They are OCF's two blacks with the gaps interpolated, but they
read as ordinary dark greys and the depth ladder is built on their even steps, so swapping
them costs the panel stack and buys nothing.

**Five things the flip will not do by itself.**

1. **The orange/yellow separation has to be re-decided.** Less urgent since 2026-09-01 — the
   interactive colour is a neutral, so nothing in the chrome is competing with a series hue at
   all, and a Quartz flip that keeps it neutral inherits that. It only comes back if Quartz
   yellow is made interactive again: make yellow interactive and
   the chart cursor is the same hue as the solar series — the ambiguity the orange decision
   removed. Quartz's own palette offers a way out: `ocf-orange` `#FF9736` is defined and used
   by nothing on `epic/adaptive-eu-ui`, so it is free to claim as the accent, and it keeps the
   hue separation while staying Quartz-native.
2. **Font metrics are baked into numbers.** The chart cursor's pill is a hard
   `<rect width="40">` sized to Matter's digits, and the dock's 116px column and the axis tick
   spacing were judged by eye against the same face. Source Code Pro has different advance
   widths, so all three want re-checking.
3. **The Mapbox zoom glyphs cannot follow a token.** They are data-URI SVGs in `globals.css`
   with the interactive colour written into the fill (`#FFFBF5` since 2026-09-01), because
   Mapbox's own stylesheet is injected after
   ours and wins on `currentColor`. Two literals, and nothing will report them missed.
4. **Series assignments are a judgement, not a mapping.** `PALETTE` flips in one line, but
   which series took which hue was decided by eye against the commercial set, and those
   choices do not automatically read right in another family.
5. **The cost stays this low only while everything names roles.** Items 2 and 3 are both
   places where something escaped the token layer. A raw hex inside a component is the thing
   to catch in review — each one turns a four-file flip into a hunt.

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
- **The Mapbox zoom glyphs are literal `#FFFBF5`** (oat, hand-copied from `--interactive`)
  and cannot follow the theme — Quartz mode,
  item 3. They are the only colour in the app outside the token layer by necessity.
- **`--surface-sunken` has no consumers.** It sits on the floor because the ink ramp has
  bottomed out below `inner`, the way paper runs out below Grey 3 in the light block. If
  something needs that step, extend the ramp instead of inventing a value.
- **Dead code awaiting a decision**: `components/charts/LegendTooltipContent.tsx` and
  `components/LegendTooltop.tsx` have no callers, and neither has `prettyPrintDayLabelWithDate`
  in `utils.ts` (which is still tested). `ForecastHeaderGSP` declares a `children` prop it
  never renders.

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

**Recommendation at the time: (a)** — superseded 2026-09-01, see the top of this document.
Orange turned out to be too loud for the job at dashboard density; the reasoning below is why
it was not (b) or (c), which still stands. Once the Data palette is reserved for standalone comparisons, orange
has no job left inside the dashboard except "you can act on this" — so give it that job
exclusively and it becomes the most useful colour in the app. (c) only pays off if in-app charts
regularly carry a third-party series; if that becomes common, revisit. Mocked in
`docs/mocks/colour-orange-yellow-options.html`.

One honest wrinkle in (a): the chart cursor. It is orange in the mock because you drag it, but
it is also a mark on the data. **Resolved 2026-08-28 for the control reading**, and then made
true by making it draggable, so the colour describes what the thing does. The chart pill and
the footer scrub handle were unified into one appearance at the same time — dark body, a
`--interactive` border and lettering, with a dot on the `beat` keyframe — and both are
draggable, so the rule does not depend on which one you happen to grab. The colour under all
three went oat on 2026-09-01; the unification is what mattered and it is unaffected.

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

The first pass, 2026-08-26/27. All of it is in commits 1–2 of the nine (`feat(theme)` and
`refactor(ui)`); *Where it got to* covers what followed.

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
