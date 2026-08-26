import "cypress-real-events/support";

describe("Delta Tab Snapshot", () => {
  beforeEach(() => {
    cy.loginToAuth0(
      Cypress.env("auth0_username"),
      Cypress.env("auth0_password")
    );

    // Mock the clock before visiting the page
    cy.fixture("manifest.json").then((manifest) => {
      if (manifest?.referenceTime) {
        const now = new Date(manifest.referenceTime);
        cy.clock(now.getTime(), ["Date"]);
      }
    });

    cy.useApiFixtures();

    cy.intercept("GET", "/api/get_token", {
      accessToken: "FAKE_TOKEN",
    });
  });

  it("successfully loads", () => {
    cy.visit("http://localhost:3002/");

    cy.location("href").should(
      "equal",
      "http://localhost:3002/"
    );
  });

  it("matches the delta tab snapshot", () => {
    cy.visit("http://localhost:3002/");

    // switch to delta tab
    cy.get('[data-cy="delta-tab"]').click();

    // make sure map is rendered
    cy.get(".mapboxgl-canvas", {
      timeout: 15000,
    }).should("be.visible");

    // time delay to render the boundaries and colours on the map
    cy.wait(16000);

    // Capture visual snapshot
    cy.matchImageSnapshot("Home - deltaTab");
  });
});