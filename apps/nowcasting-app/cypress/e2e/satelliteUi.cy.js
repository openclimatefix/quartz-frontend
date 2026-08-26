import "cypress-real-events/support";

describe("Satellite / clouds overlay snapshot", () => {
  beforeEach(function () {
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

  it("matches the snapshot with Clouds enabled on the VIS006 channel", () => {
    cy.visit("http://localhost:3002/");
    cy.get(".mapboxgl-canvas", { timeout: 15000 }).should("be.visible");

    // time delay to render the boundaries and colours on the map
    cy.wait(16000);

    // Turn on Clouds
    cy.get('[data-cy="clouds-toggle-button"]').click();

    // "VIS006" is the exact <option value> (see SATELLITE_CHANNELS[0] in
    // satelliteLayer.ts)
    cy.get('[data-cy="satellite-channel-select"]')
      .should("be.visible")
      .and("not.be.disabled")
      .select("VIS006");

    // extra delay so the satellite tile has time to fetch/decode/paint
    cy.wait(5000);

    // Capture visual snapshot
    cy.matchImageSnapshot("Home - satelliteVis006");
  });
});
