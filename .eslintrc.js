// Converted from .eslintrc.json so the exhaustive-deps backlog below can carry its
// reasoning. ESLint rejects unknown keys inside `overrides`, so a JSON config has
// nowhere to put a comment.
module.exports = {
  extends: ["next/core-web-vitals", "prettier"],
  plugins: ["prettier"],
  parser: "@babel/eslint-parser",
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      babelrc: false,
      configFile: false
    },
    presets: ["next/babel"]
  },
  rules: {
    "@next/next/no-img-element": "off",
    "prettier/prettier": "error",

    // Missing hook dependencies have already cost us a real bug: the chart formatting
    // memo in use-format-chart-data.tsx omits four of its inputs, so chart lines
    // silently keep stale values instead of updating. next/core-web-vitals ships this
    // rule as a warning, and 24 warnings is indistinguishable from none.
    "react-hooks/exhaustive-deps": "error"
  },
  overrides: [
    {
      // Pre-existing violations, held at "warn" so the rule can be an error everywhere
      // else. This list is a backlog that only ever shrinks — never add to it.
      //
      // These are deliberately not fixed in the same change that turns the rule on.
      // Adding a missing dependency is not a cosmetic edit: it changes how often an
      // effect or memo re-runs, and on a map or a polling chart that can mean an
      // infinite render loop or a request storm. Doing that across twelve files before
      // the characterisation tests exist would trade a known lint warning for an unknown
      // runtime fault.
      //
      // Most of these files — pages/index.tsx, the map components, use-format-chart-data
      // — are rewritten during the v1 migration, so their entries disappear with the
      // rewrite rather than needing a separate fix. Anything still listed when the
      // migration lands should be fixed individually, with a test.
      files: [
        "apps/nowcasting-app/components/charts/remix-line.tsx",
        "apps/nowcasting-app/components/charts/solar-site-view/solar-site-chart.tsx",
        "apps/nowcasting-app/components/charts/use-format-chart-data.tsx",
        "apps/nowcasting-app/components/hooks/use-hot-key-control-chart.tsx",
        "apps/nowcasting-app/components/hooks/use-time-now.tsx",
        "apps/nowcasting-app/components/hooks/useAggregateSitesDataForTimestamp.tsx",
        "apps/nowcasting-app/components/layout/header/profile-dropdown.tsx",
        "apps/nowcasting-app/components/map/map.tsx",
        "apps/nowcasting-app/components/map/pvLatestMap.tsx",
        "apps/nowcasting-app/components/map/use-update-map-state-on-click.ts",
        "apps/nowcasting-app/components/play-button/index.tsx",
        "apps/nowcasting-app/pages/index.tsx"
      ],
      rules: {
        "react-hooks/exhaustive-deps": "warn"
      }
    }
  ]
};
