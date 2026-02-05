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

// Intercept at the network level
beforeEach(() => {
  cy.intercept("https://api.mapbox.com/**", { forceNetworkError: true });
  cy.intercept("**/mapbox-gl*.js", { forceNetworkError: true });
  cy.intercept("**/mapbox-gl*.css", { forceNetworkError: true });
});

// Stub Mapbox at the window level
Cypress.on("window:before:load", (win) => {
  // Delete any existing mapboxgl
  delete win.mapboxgl;

  Object.defineProperty(win, "mapboxgl", {
    value: {
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
    },
    writable: false,
    configurable: false
  });
});

// Alternatively you can use CommonJS syntax:
// require('./commands')
