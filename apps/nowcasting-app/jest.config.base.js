/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",

  // One environment for everything: jsdom with Node's export conditions. See
  // jest.environment.js for why the conditions have to be overridden.
  //
  // A per-file `/** @jest-environment jsdom */` docblock would have kept the faster
  // `node` default for the pure-function suites, but the docblock takes a module name or
  // a path relative to the test file — it does not expand <rootDir> — so every suite
  // would carry a different ../../.. prefix to reach this environment. The dominant cost
  // in this project is ts-jest building a full TypeScript program per worker (~3.4GB),
  // next to which jsdom's overhead is noise, so a single environment is the better
  // trade.
  testEnvironment: "<rootDir>/jest.environment.js",

  // Pins the process timezone to UTC before workers fork. See jest.globalSetup.ts.
  globalSetup: "<rootDir>/jest.globalSetup.ts",

  // Before the test framework: Fetch API globals jsdom does not provide but MSW needs.
  setupFiles: ["<rootDir>/jest.polyfills.ts"],

  // Per-worker setup: DOM matchers for the jsdom suites.
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  // The app's tsconfig sets `jsx: "preserve"`, which is right for Next — the bundler
  // does the JSX transform. ts-jest has no bundler behind it, so under that setting it
  // emits raw JSX and the test file dies on `Unexpected token '<'`. Override to
  // `react-jsx` for tests only, leaving the app build untouched.
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx" } }]
  },

  // ts-jest builds a full TypeScript program per worker, and this project's is
  // expensive: ~97 root files plus the transitive .d.ts closure of next, react,
  // mapbox-gl, recharts and friends. A single worker running the suite peaks
  // around 3.4GB — survivable alone, fatal in parallel. Jest defaults to
  // `cpus - 1` (9 here), so `yarn test` tried to hold well over 10GB at once and
  // took the machine down with it. Two workers keeps the 4 suites quick while
  // staying nowhere near the RAM ceiling.
  maxWorkers: 2,

  // Belt and braces: recycle a worker that creeps past this, so memory can't
  // accumulate across suites within one long-lived worker.
  workerIdleMemoryLimit: "2GB",

  // Keep the haste map crawl off build output and fixtures. `data/` alone is
  // 133MB of GeoJSON and `.next/` is ~1.7GB — none of it is imported by a test,
  // and none of it needs stat'ing on every run.
  modulePathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/.yarn/",
    "<rootDir>/.bit/",
    "<rootDir>/dist/",
    "<rootDir>/coverage/",
    "<rootDir>/temp/",
    "<rootDir>/data/",
    "<rootDir>/cypress-examples/"
  ],

  // Cypress specs run separately (`yarn test:cypress`) under a different runner;
  // without this, jest's default testMatch would try to collect them.
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/cypress/", "<rootDir>/cypress-examples/"]
};