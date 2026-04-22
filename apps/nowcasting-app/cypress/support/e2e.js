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
import "@percy/cypress";

// Ignore known React hydration mismatches that can happen in test runs.
Cypress.on("uncaught:exception", (err) => {
	const message = err?.message || "";
	if (
		message.includes("Text content does not match server-rendered HTML") ||
		message.includes("Hydration failed") ||
		message.includes("hydrating")
	) {
		return false;
	}
});

// Alternatively you can use CommonJS syntax:
// require('./commands')
