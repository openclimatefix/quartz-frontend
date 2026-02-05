// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import "./commands";

// Ignore WebGL errors from Mapbox
Cypress.on("uncaught:exception", (err, runnable) => {
  // Ignore WebGL errors from Mapbox
  if (
    err.message.includes("Failed to initialize WebGL") ||
    err.message.includes("mapboxgl") ||
    err.message.includes("WebGL")
  ) {
    return false; // Prevent Cypress from failing the test
  }
  // Let other errors fail the test
  return true;
});

// Intercept at the network level
beforeEach(() => {
  cy.intercept("https://api.mapbox.com/**", { forceNetworkError: true });
  cy.intercept("**/mapbox-gl*.js", { forceNetworkError: true });
  cy.intercept("**/mapbox-gl*.css", { forceNetworkError: true });
});

// Stub Mapbox at the window level
Cypress.on("window:before:load", (win) => {
  // Create a mock that allows assignment but always returns the stub
  let mockMapbox = {
    supported: () => false,
    Map: function () {
      return {
        on: () => {},
        off: () => {},
        remove: () => {},
        addControl: () => {},
        resize: () => {},
        getCanvas: () => document.createElement("canvas")
      };
    },
    accessToken: ""
  };

  Object.defineProperty(win, "mapboxgl", {
    get() {
      return mockMapbox;
    },
    set(val) {
      // Allow assignment but ignore it
      return true;
    },
    configurable: true
  });
});

// Alternatively you can use CommonJS syntax:
// require('./commands')
