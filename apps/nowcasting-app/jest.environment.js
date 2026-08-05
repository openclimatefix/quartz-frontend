const JSDOMEnvironment = require("jest-environment-jsdom").default;

/**
 * jsdom, but resolving packages the way Node does.
 *
 * Two conflicting requirements meet here:
 *
 *  - MSW v2 must resolve to its *node* build. Under stock jsdom, jest applies the
 *    `browser` export condition, which hands back MSW's browser bundle — a file that
 *    ships ESM under a `.js` extension, so the suite dies on "Cannot use import
 *    statement outside a module" from inside node_modules.
 *
 *  - `@sentry/nextjs` (imported transitively by components/helpers/utils.ts, which most
 *    suites touch) declares `edge`, `browser`, `node` and `import` export conditions but
 *    no `default`. Blanking the conditions out — the usual MSW workaround of
 *    `customExportConditions: [""]` — therefore leaves nothing to match and Sentry stops
 *    resolving entirely.
 *
 * Asking for node conditions explicitly satisfies both: MSW gets its node build, Sentry
 * matches on `node`. Doing it in a custom environment rather than global
 * `testEnvironmentOptions` keeps the choice attached to the environment that needs it.
 */
class NowcastingTestEnvironment extends JSDOMEnvironment {
  exportConditions() {
    return ["node", "require", "default"];
  }
}

module.exports = NowcastingTestEnvironment;
