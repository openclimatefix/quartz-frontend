const defaultTheme = require("tailwindcss/defaultTheme");
const plugin = require("tailwindcss/plugin");

/* ---- The palettes. ---------------------------------------------------------
 * VISUALISATION and COMMERCIAL are the same five hues — every pair sits within 2° of the other on the hue
 * wheel — so this is a straight swap, not a re-hue.
 *
 *   VISUALISATION  Guidelines p6. "Natural and soft, to contrast with our electric
 *                  brand colour." Designed for editorial pages.
 *   COMMERCIAL     Experimental. The same five hues carrying ~15–25 more points of
 *                  saturation and ~10 fewer of lightness, for a dense dashboard where
 *                  the soft set has to separate seven series and does not have the
 *                  legs. Brad's five values; the `light` members are derived from them
 *                  by the rule the brand's own light partners follow (+20 points of
 *                  HSL lightness, hue and saturation held), and `skyStrong` by the
 *                  inverse (−13) since wind-strong was already that relationship.
 *
 * Flip PALETTE to compare. Nothing downstream names a family — `solar`, `series` and
 * `wind` all read `DATA`, so both themes and every consumer (classes, Recharts,
 * Mapbox) move together.
 */
const VISUALISATION = {
  blue: "#4675C1",
  blueLight: "#9CB6E1",
  sky: "#65B0C9",
  skyLight: "#A3D6E0",
  skyStrong: "#3D8FAB",
  teal: "#58B0A9",
  tealLight: "#9ED1CD",
  yellow: "#FFD480",
  yellowLight: "#FFE9BC",
  orange: "#FAA056",
  orangeLight: "#FFDABC"
};

const COMMERCIAL = {
  blue: "#2561D0",
  blueLight: "#759DE6", // derived
  sky: "#2B95BF",
  skyLight: "#71C0DF", // derived
  skyStrong: "#1F6B89", // derived
  teal: "#1C9C93",
  tealLight: "#41DDD2", // derived
  yellow: "#F6C155",
  yellowLight: "#FBE4B6", // derived
  orange: "#F47B25",
  orangeLight: "#F9B686" // derived
};

/** "vis" | "commercial" — the one knob. */
const PALETTE = "vis";
const DATA = PALETTE === "commercial" ? COMMERCIAL : VISUALISATION;

/* ---- The Data family (Guidelines p7–p8). -----------------------------------
 * "Electric contrasting colours for easy visual separation." A different family from the
 * two above, not a third option for PALETTE: it has no yellow and no teal, so it cannot
 * stand in for the vis set wholesale. It is a set to reach *into* for a series the vis
 * hues cannot separate — which is the open problem in `docs/colour-rationalisation.md`,
 * where Met Office and satellite currently share the blue family and read as related.
 *
 * The brand's own rule, quoted: "Each electric colour has a corresponding lighter shade to
 * create mono-coloured comparative graphs." So `*Light` is the forecast half of a pair, the
 * same way `solar.light` is. Blue Light and Sky Light are the same two values the
 * Visualisation family uses — the guidelines list them under both.
 *
 * `orange` is here because it is the brand's, not because it is available: brand orange
 * means "you can act on this" everywhere in this dashboard, and a series wearing it would
 * make that ambiguous. Off limits as a data colour unless that rule changes.
 *
 * Exposed as `data-*` classes and `theme.extend.colors.data` for the JS reads.
 */
const ELECTRIC = {
  blue: "#306BFF",
  blueLight: "#9CB6E1",
  sky: "#10C5F7",
  skyLight: "#A3D6E0",
  orange: "#FF4901",
  orangeLight: "#FF8F73",
  purple: "#B701FF",
  purpleLight: "#EFC8FF",
  green: "#17E58F",
  greenLight: "#B8F5DB"
};

/* ---- The well. -------------------------------------------------------------
 * A recess, on the chart plot area (`pv-remix-chart`, `gsp-pv-remix-chart`) and the map
 * control row (`CONTROL_ROW`). Three call sites, all `shadow-well`.
 *
 * "lit" is the modelled version. The header well is *lighter* than the card it sits in, so
 * a hairline ring read as an outline drawn on top rather than as a cut into the surface —
 * a light edge all the way round is what a raised panel looks like, not a sunken one. So
 * depth comes from the light instead: a dark inner edge along the top where the lip casts
 * into the recess, and a faint bright edge along the bottom where the far wall catches it.
 *
 * "flat" drops it. The two chart wells keep their `border-edge` hairline and the tone step,
 * so they still read as a separate plane; `CONTROL_ROW` has no border and would be carried
 * by its tone step alone.
 */
const WELL = "flat"; // "lit" | "flat"
const WELL_SHADOW =
  WELL === "flat"
    ? "none"
    : "inset 0 1px 2px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(255,251,245,0.06)";

module.exports = {
  theme: {
    // Matter XH ships Light/Regular/Medium only, so anything above 500 was being
    // synthesised by the browser — smeared strokes and wrong letterfit across the
    // ~78 call sites that ask for semibold or heavier. Everything above 500 is
    // capped at 500 so it resolves to the real Medium face. The brand guidelines
    // never set type above Medium either, so this matches the house style.
    fontWeight: {
      hairline: 300,
      "extra-light": 300,
      thin: 300,
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 500,
      bold: 500,
      extrabold: 500,
      "extra-bold": 500,
      black: 500
    },
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "2rem",
        lg: "4rem",
        xl: "5rem",
        "2xl": "6rem"
      }
    },
    screens: {
      sm: "640px",
      // => @media (min-width: 640px) { ... }

      md: "768px",
      // => @media (min-width: 768px) { ... }

      lg: "1024px",
      // => @media (min-width: 1024px) { ... }

      xl: "1280px",
      // => @media (min-width: 1280px) { ... }

      "2xl": "1536px",
      // => @media (min-width: 1536px) { ... }
      "3xl": "1750px",
      "4xl": "1900px"
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-matter-xh)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-matter-semi-mono)", ...defaultTheme.fontFamily.mono],
        serif: ["Source Code Pro", ...defaultTheme.fontFamily.serif],
        // Pangram Sans is the brand's numeral face — `font-number` on figures.
        number: ["var(--font-pangram-sans)", ...defaultTheme.fontFamily.sans]
      },
      boxShadow: {
        // See WELL_SHADOW at the top of this file — one knob, three call sites.
        well: WELL_SHADOW
      },
      fontSize: {
        "2xs": "0.625rem"
      },
      keyframes: {
        /* Tailwind's own `pulse` only dips to 50% opacity, which on a 6px dot reads as a
         * slight shimmer rather than a beat. This goes almost all the way out, so the dot
         * plainly blinks. */
        beat: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.05" }
        }
      },
      animation: {
        beat: "beat 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite"
      },
      colors: {
        /* ---- Role colours. See `styles/tokens.css`. Components use only these. ----
         * These resolve to CSS variables, so they follow the theme. Anything read by
         * Mapbox or Recharts through `theme.extend.colors` must NOT live here — those
         * need a literal hex, and are under `solar` / `wind` / `ocf-delta` below.
         */
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          panel: "rgb(var(--surface-panel) / <alpha-value>)",
          inner: "rgb(var(--surface-inner) / <alpha-value>)",
          raised: "rgb(var(--surface-raised) / <alpha-value>)",
          sunken: "rgb(var(--surface-sunken) / <alpha-value>)",
          inset: "rgb(var(--surface-inset) / <alpha-value>)"
        },
        content: {
          DEFAULT: "rgb(var(--content) / <alpha-value>)",
          secondary: "rgb(var(--content-secondary) / <alpha-value>)",
          muted: "rgb(var(--content-muted) / <alpha-value>)",
          "on-accent": "rgb(var(--content-on-accent) / <alpha-value>)"
        },
        interactive: {
          DEFAULT: "rgb(var(--interactive) / <alpha-value>)",
          hover: "rgb(var(--interactive-hover) / <alpha-value>)"
        },
        selected: {
          DEFAULT: "rgb(var(--selected) / <alpha-value>)",
          edge: "rgb(var(--selected-edge) / var(--selected-edge-alpha))"
        },
        status: {
          ok: "rgb(var(--status-ok) / <alpha-value>)",
          warn: "rgb(var(--status-warn) / <alpha-value>)",
          alert: "rgb(var(--status-alert) / <alpha-value>)"
        },
        // Hairlines carry their own alpha — a border token is only ever a wash over
        // whatever surface it sits on, so the opacity is part of the role.
        edge: {
          DEFAULT: "rgb(var(--border-subtle) / 0.11)",
          strong: "rgb(var(--border-strong) / 0.22)"
        },

        /* ---- RETIRED below. Migrated to roles above; kept commented for one
         * release so a missed reference is obvious rather than silently falling
         * back to a Tailwind default. Delete after the reskin settles.
         * Still live and deliberately untouched: ocf-delta (the divergent scale,
         * 88 references, needs designing rather than renaming), ocf-teal (PVNet
         * intraday) and ocf-orange (map constraint lines, sites map). The rest of
         * the model-provenance series moved to `series` below.
         */

        /* ---- Data. Literal hex, unthemed, read at runtime by Mapbox/Recharts. ----
         * Visualisation Yellow / Sky Blue (Guidelines p6). The `light` member of each
         * pair is the forecast half — the brand's own "mono-coloured comparative graph"
         * rule, which is exactly forecast-vs-actual.
         */
        solar: {
          DEFAULT: DATA.yellow,
          light: DATA.yellowLight
        },

        /* ---- Plot internals. Themed roles — see `--plot-*` in `styles/tokens.css`. ----
         * `bg-plot-base` is the plot floor. The two bands are the day/night alternation and
         * are read at runtime by Recharts through `useTokens`, not through these classes;
         * they are here so the well and its banding stay named in one place.
         */
        plot: {
          base: "rgb(var(--plot-base) / <alpha-value>)",
          band: "rgb(var(--plot-band-a) / <alpha-value>)",
          stroke: "rgb(var(--content) / <alpha-value>)"
        },

        /* ---- Model provenance. Which *source* a forecast line came from. ----
         * All Visualisation family (Guidelines p6) — these are weather models, and the
         * visualisation palette is the brand's weather palette. The internal "Additional"
         * set is off limits for anything customer-facing, so the five vis hues are the
         * whole budget: yellow is OCF's own forecast, orange is the N-hour, and the rest
         * carry third-party sources.
         *
         * Known tension: metOffice and satellite are the same blue family, so they read as
         * related when they are not. There is no sixth vis hue, and sky blue is spoken for
         * by wind. Resolving it means saturating the palette — see the doc.
         */
        series: {
          ecmwf: ELECTRIC.blue, // Teal         (was ocf-teal-500 #70C2B6)
          metOffice: ELECTRIC.green, // Blue         (was #B9D532)
          satellite: ELECTRIC.sky, // Blue Light   (was solar-light, which now means actual)
          nHour: DATA.orange, // Orange       (was ocf-orange #FF9736)
          seasonal: DATA.orangeLight // Orange Light (was the bare literal #ffdfd1)
        },
        /* The electric Data family, unthemed like every other data colour. Named by hue
         * rather than by job, because nothing has claimed one yet — assign a series to
         * `data.purple` in `remix-line`, do not rename this to `series.metOffice`. */
        data: {
          blue: ELECTRIC.blue,
          "blue-light": ELECTRIC.blueLight,
          sky: ELECTRIC.sky,
          "sky-light": ELECTRIC.skyLight,
          orange: ELECTRIC.orange,
          "orange-light": ELECTRIC.orangeLight,
          purple: ELECTRIC.purple,
          "purple-light": ELECTRIC.purpleLight,
          green: ELECTRIC.green,
          "green-light": ELECTRIC.greenLight
        },

        wind: {
          DEFAULT: DATA.sky,
          light: DATA.skyLight,
          strong: DATA.skyStrong
        },

        // amber: {
        // DEFAULT: "#FFD053",
        // 50: "#FFFFFF",
        // 100: "#FFFDF6",
        // 200: "#FFF1CD",
        // 300: "#FFE6A5",
        // // 400: "#FFDB7C",
        // 400: "#FFD053",
        // 600: "#FFC11B",
        // 700: "#E2A400",
        // 800: "#AA7B00",
        // 900: "#725300"
        // },
        // "ocf-primary": {
        // DEFAULT: "#FF4901"
        // },
        // "ocf-yellow": {
        // DEFAULT: "#FFD053",
        // 50: "#FFFFFF",
        // 100: "#FFFDF6",
        // 200: "#FFF1CD",
        // 300: "#FFE6A5",
        // 400: "#FFDB7C",
        // 500: "#FFD053",
        // 600: "#FFC11B",
        // 700: "#E2A400",
        // 800: "#AA7B00",
        // 900: "#725300"
        // },
        // "ocf-dusty-orange": {
        // DEFAULT: "#FFAC5F",
        // 50: "#FFFFFF",
        // 100: "#FFFFFF",
        // 200: "#FFEBD9",
        // 300: "#FFD6B1",
        // 400: "#FFC188",
        // 500: "#FFAC5F",
        // 600: "#FF8F27",
        // 700: "#EE7200",
        // 800: "#B65700",
        // 900: "#7E3C00"
        // },
        // DEFAULT is the brand colour, others are guesstimated shades
        "ocf-orange": {
          DEFAULT: "#FF9736",
          50: "#fff1eb",
          100: "#ffe1d1",
          200: "#ffd5b8",
          300: "#FEBF83",
          400: "#FFC188",
          500: "#ffac69",
          600: "#FF9736",
          700: "#e67c19",
          800: "#e67802",
          900: "#7d4500"
        },
        // "ocf-gray": {
        // DEFAULT: "#E4E4E4",
        // 50: "#FFFFFF",
        // 100: "#FFFFFF",
        // 200: "#FFFFFF",
        // 300: "#FFFFFF",
        // 400: "#F8F8F8",
        // 500: "#E4E4E4",
        // 600: "#C8C8C8",
        // 700: "#ACACAC",
        // 800: "#909090",
        // 900: "#747474"
        // },
        // "mapbox-black": {
        // DEFAULT: "#191a1a",
        // 300: "#A9A9A9",
        // 400: "#8c8c8c",
        // 500: "#292B2B",
        // 600: "#545454",
        // 700: "#343332",
        // 900: "#191a1a"
        // },
        // "ocf-black": {
        // DEFAULT: "#0C0D0D",
        // 50: "#80735A",
        // 100: "#746851",
        // 200: "#5C5340",
        // 300: "#443D30",
        // 400: "#2C281F",
        // 500: "#14120E",
        // 600: "#000000",
        // 700: "#000000",
        // 800: "#000000",
        // 900: "#000000"
        // },
        // "ocf-blue": {
        // DEFAULT: "#48B0DF",
        // 50: "#E4F3FA",
        // 100: "#D3ECF7",
        // 200: "#B0DDF1",
        // 300: "#8DCEEB",
        // 400: "#6BBFE5",
        // 500: "#48B0DF",
        // 600: "#2497CB",
        // 700: "#1B749C",
        // 800: "#13506C",
        // 900: "#0B2D3C"
        // },
        // "ocf-green": {
        // DEFAULT: "#63BCAF",
        // 50: "#E3F3F1",
        // 100: "#D5EDEA",
        // 200: "#B9E1DB",
        // 300: "#9CD5CC",
        // 400: "#80C8BE",
        // 500: "#63BCAF",
        // 600: "#45A294",
        // 700: "#357A70",
        // 800: "#24534C",
        // 900: "#132C28"
        // },
        "ocf-teal": {
          DEFAULT: "#7BCDF3",
          50: "#F1F9F8",
          100: "#E2F3F0",
          200: "#C6E7E2",
          300: "#A9DAD3",
          400: "#8DCEC5",
          500: "#70C2B6",
          600: "#4BAFA0",
          700: "#3A887C",
          800: "#296158",
          900: "#183934"
        },
        "ocf-delta": {
          DEFAULT: "#6C6C6C",
          100: "#9AA1F9",
          200: "#9EC8FA",
          300: "#70859D",
          400: "#4F5D66",
          500: "#6C6C6C",
          600: "#67643B",
          700: "#9F973A",
          800: "#FCED4F",
          900: "#F19F38",
          950: "#646464"
        }
        // "ocf-sites": {
        // DEFAULT: "#6C6C6C",
        // 100: "#444444"
        // },
      }
    }
  },
  // `config/` carries per-country series legend classes (`config/countries.ts`) and was
  // never scanned, so those swatches have never had a colour. `lib/` and `hooks/` are here
  // for the same reason — a class only exists if Tailwind has seen the literal string.
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./config/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}"
  ],
  safelist: [
    "bg-solar",
    // The legend's faintest band renders at /3, matching `BAND_OPACITIES[0]` (0.03) in
    // `feature-state.ts` — the deliberate "published a real zero" band, which must stay
    // distinguishable from "published nothing". Without this entry the class is never
    // generated and that pill renders with no fill at all, so the legend showed five bands
    // where the map paints six.
    "bg-solar/3",
    "bg-solar/5",
    "bg-solar/10",
    "bg-solar/20",
    "bg-solar/30",
    "bg-solar/40",
    "bg-solar/50",
    "bg-solar/60",
    "bg-solar/70",
    "bg-solar/80",
    "bg-solar/90",
    "bg-solar/100"
  ],
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/container-queries"),
    plugin(function ({ addVariant }) {
      addVariant("dash", ".dashboard-mode &");
    })
  ]
};
