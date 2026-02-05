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

// Block Mapbox globally before any test runs
Cypress.on("window:before:load", (win) => {
  // Stub mapboxgl globally
  Object.defineProperty(win, "mapboxgl", {
    get() {
      return {
        supported: () => false,
        Map: class MockMap {
          on() {
            return this;
          }
          off() {
            return this;
          }
          remove() {}
          addControl() {}
          resize() {}
          getCanvas() {
            return document.createElement("canvas");
          }
        },
        accessToken: ""
      };
    },
    set() {} // Prevent overwriting
  });
});

// Also intercept Mapbox API calls
beforeEach(() => {
  cy.intercept("https://api.mapbox.com/**", { statusCode: 204 });
  cy.intercept("**/mapbox-gl*.js", { statusCode: 204 });
  cy.intercept("**/mapbox-gl*.css", { statusCode: 204 });
});

// Alternatively you can use CommonJS syntax:
// require('./commands')
