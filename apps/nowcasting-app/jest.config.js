/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  globals: {
    TZ: "UTC"
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