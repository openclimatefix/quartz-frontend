import "cypress-real-events/support";

describe("P-levels settings snapshot", () => {
  beforeEach(function () {
    cy.loginToAuth0(Cypress.env("auth0_username"), Cypress.env("auth0_password"));

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

    cy.visit("http://localhost:3002/");

    cy.get(".mapboxgl-canvas", { timeout: 15000 }).should("be.visible");
  });

  it("matches the snapshot with all P-levels enabled", () => {
    // time delay to render the boundaries and colours on the map
    cy.wait(16000);

    // Open settings
    cy.contains("button", "Open user menu", { timeout: 10000 }).should("be.visible").click();

    cy.get("#UserMenu-SettingsBtn").should("be.visible").click();

    cy.get('[data-cy="settings-modal"]').should("be.visible");

    // Select all P-levels
    ["2-98", "10-90", "25-75"].forEach((pair) => {
      cy.get(`[data-cy="p-level-toggle-${pair}"]`)
        .find("input[type=checkbox]")
        .then(($checkbox) => {
          if (!$checkbox.prop("checked")) {
            cy.wrap($checkbox).click();
          }
        });
    });

    // Close settings
    cy.get('[aria-label="Close settings modal"]').click();

    cy.get('[data-cy="settings-modal"]').should("not.exist");

    // Capture visual snapshot
    cy.matchImageSnapshot("Home - pLevels");
  });
});
