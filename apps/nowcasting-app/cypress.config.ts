import { defineConfig } from "cypress";
import fs from "node:fs";
import path from "node:path";

// Populate process.env with values from .env file
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });
dotenv.config();

const { addMatchImageSnapshotPlugin } = require("@simonsmith/cypress-image-snapshot/plugin");
const { generateSessionCookie } = require("@auth0/nextjs-auth0/testing");
const { API_V1_PREFIX, API_PREFIX, SITES_API_PREFIX } = require("./constant");

export default defineConfig({
  viewportWidth: 1280,
  viewportHeight: 720,
  video: false,
  defaultCommandTimeout: 10_000,
  pageLoadTimeout: 30_000,
  screenshotOnRunFailure: false,
  blockHosts: ["*.sentry.io", "*.googletagmanager.com", "*.licdn.com", "events.mapbox.com"],
  env: {
    apis: [
      { label: "v1", base: API_V1_PREFIX },
      { label: "v0", base: API_PREFIX },
      { label: "sites", base: SITES_API_PREFIX }
    ]
  },
  e2e: {
    baseUrl: "http://localhost:3002",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    setupNodeEvents(on) {
      addMatchImageSnapshotPlugin(on);

      on("task", {
        // The fixture files on disk, so the mock can tell which requests have one.
        listFixtures() {
          const dir = path.join(__dirname, "cypress/fixtures");
          return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
        },

        mintSessionCookie(user: object) {
          return generateSessionCookie(
            {
              user,
              accessToken: "e2e-token",
              accessTokenExpiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60
            },
            { secret: process.env.AUTH0_SECRET }
          );
        }
      });
    }
  }
});
