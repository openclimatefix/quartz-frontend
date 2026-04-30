import "./commands";
import "@percy/cypress";

beforeEach(() => {
  // Global beforeEach - stubs are registered in each test file's beforeEach after login
});

Cypress.on("uncaught:exception", () => {
  // Ignore all uncaught exceptions from application code
  // TODO make it more spefic
  return false;
});