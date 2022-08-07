const { defineConfig } = require("cypress");
const { initPlugin } = require("cypress-plugin-snapshots/plugin");

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      initPlugin(on, config);
      return config;
      // implement node event listeners here
    },
    baseUrl: process.env.BASE_URL || "http://localhost:3002",
    nodeVersion: "system",
    watchForFileChanges: false,
    defaultCommandTimeout: 10000,
    retries: 1,
    video: false,
    videoUploadOnPasses: false,
    viewportWidth: 1000,
    viewportHeight: 660,
    env: {
      "cypress-plugin-snapshots": {
        autoCleanUp: true,
        imageConfig: {
          createDiffImage: true, // Should a "diff image" be created, can be disabled for performance
          threshold: 0.01, // Amount in pixels or percentage before snapshot image is invalid
          thresholdType: "percent", // Can be either "pixel" or "percent"
        },
      },
    },
  },
});
