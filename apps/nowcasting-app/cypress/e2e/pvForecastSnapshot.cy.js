import "cypress-real-events/support";

describe("Load the page", () => {
  beforeEach(() => {
    cy.loginToAuth0(Cypress.env("auth0_username"), Cypress.env("auth0_password"));

    // Mock the clock before visiting the page
    cy.fixture("manifest.json").then((manifest) => {
      if (manifest?.referenceTime) {
        const now = new Date(manifest.referenceTime);
        cy.clock(now.getTime(), ["Date"]);
      }
    });

    cy.useApiFixtures();

    cy.intercept("GET", "/api/get_token", {
      accessToken: "FAKE_TOKEN"
    });
  });

  it("successfully loads", () => {
    cy.visit("http://localhost:3002/");

    cy.location("href").should("equal", "http://localhost:3002/");
  });

  it("matches the snapshot", () => {
    cy.visit("http://localhost:3002/");

    cy.location("href").should("equal", "http://localhost:3002/");

    // time delay to render the boundaries and colours on the map
    cy.wait(16000); //16 sec

    cy.matchImageSnapshot("Home - pvForecast");
  });
});
