import "./commands";
import "@percy/cypress";
import { addMatchImageSnapshotCommand } from '@simonsmith/cypress-image-snapshot/command';

addMatchImageSnapshotCommand({
  failureThreshold: 0.1,
  failureThresholdType: 'percent',
  customDiffConfig: { threshold: 0.1 },
  capture: 'fullPage',
});

Cypress.on("uncaught:exception", () => {
  return false;
});

beforeEach(() => {
  cy.on("uncaught:exception", () => false);

  // Intercept the Auth0 user session endpoint globally
  cy.intercept("GET", "**/api/auth/me", {
    name: "Mock User",
    email: "mockuser@example.com",
    picture:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"><path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z"/></svg>'
  });

  // Intercept the token retrieval endpoint globally
  cy.intercept("GET", "**/api/get_token", {
    accessToken: "FAKE_TOKEN"
  });

  // Intercept Auth0 logout and clear session cookie
  cy.intercept("GET", "**/api/auth/logout*", (req) => {
    req.reply({
      statusCode: 302,
      headers: {
        location: "/",
        "Set-Cookie": "appSession=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
      }
    });
  });
});