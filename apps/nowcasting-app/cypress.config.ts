import { defineConfig } from "cypress";
// Populate process.env with values from .env file
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });
dotenv.config();

export default defineConfig({
  env: {
    auth0_username: process.env.NEXT_PUBLIC_AUTH0_USERNAME,
    auth0_password: process.env.NEXT_PUBLIC_AUTH0_PASSWORD,
    auth0_domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN,
    auth0_audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
    auth0_scope: process.env.NEXT_PUBLIC_AUTH0_SCOPE,
    auth0_client_id: process.env.NEXT_PUBLIC_AUTH0_CLIENTID,
    auth0_client_secret: process.env.AUTH0_CLIENT_SECRET,
    baseUrl: process.env.AUTH0_BASE_URL
  },
  chromeWebSecurity: false,
  // ...rest of the Cypress project config
  // Cypress Cloud projectId - must be set via CYPRESS_PROJECT_ID environment variable
  // TODO: Maintainers need to add this to GitHub Secrets
  projectId: process.env.CYPRESS_PROJECT_ID || "PLACEHOLDER_CYPRESS_PROJECT_ID",

  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    }
  }
});
