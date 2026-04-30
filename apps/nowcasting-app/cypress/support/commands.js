// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
// Import auth0 login command
import "./auth-provider-commands/auth0";

const compileFixtureRoutes = (manifest) => {
  if (!manifest?.routes?.length) {
    throw new Error(
      "Fixture manifest is missing or empty. Run `yarn fixtures:update` before Cypress tests."
    );
  }
  const sorted = [...manifest.routes].sort(
    (a, b) => b.pattern.length - a.pattern.length
  );
  return sorted.map((route) => {
    const rawPattern = route.pattern.replace(/^\/|\/$/g, "");
    return {
      ...route,
      regex: new RegExp(rawPattern)
    };
  });
};

Cypress.Commands.add("useApiFixtures", () => {
  cy.fixture("manifest.json").then((manifest) => {
    const routes = compileFixtureRoutes(manifest);
    cy.intercept(
      {
        method: /GET|POST|PUT|PATCH|DELETE/,
        url: /\/v0\/|\/sites(?:\/|\?|$)|\/api_status(?:\?|$)/
      },
      (req) => {
        const match = routes.find(
          (route) => route.method === req.method && route.regex.test(req.url)
        );
        if (!match) {
          req.reply({
            statusCode: 501,
            body: { error: "Unmocked API request", url: req.url }
          });
          return;
        }
        console.log("Matched fixture:", match.fixture, "| URL:", req.url);
        req.reply({ fixture: match.fixture });
      }
    );
  });
});