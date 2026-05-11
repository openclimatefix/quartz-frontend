import "cypress-real-events/support";

describe("Dashboard Mode Snapshot", () => {
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

  it("matches the dashboard mode snapshot", () => {
    cy.visit("http://localhost:3002/");

    // enable dashboard mode
    cy.setCookie("dashboardMode", "true");
    cy.reload();

    // verify dashboard mode cookie is set
    cy.getCookie("dashboardMode")
      .should("exist")
      .its("value")
      .should("eq", "true");

    // make sure loader is gone
    cy.get("div.chart-data-loading-message", {
      timeout: 30000,
    }).should("not.exist");

    // make sure map is rendered
    cy.get(".mapboxgl-canvas", {
      timeout: 15000,
    }).should("be.visible");

    // time delay to render the boundaries and colours on the map
    cy.wait(16000);

    // Capture visual snapshot
    cy.matchImageSnapshot("Home - dashboardMode");
  });
});