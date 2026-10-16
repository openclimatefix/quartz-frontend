describe("DE delta", () => {
  it("matches the snapshot", () => {
    cy.mockApi();
    cy.login();
    cy.visit("/");

    // The page opens on GB: switch to DE, then the map (and the chart with it) to the delta view.
    cy.get('[data-cy="country-toggle-DE"]').click().should("have.attr", "aria-checked", "true");
    cy.get('[data-cy="map-mode-delta"]').click().should("have.attr", "aria-pressed", "true");

    cy.get("body").type("{leftArrow}".repeat(96));

    // Loaded: the delta header is up, nothing is still loading.
    cy.get('[data-test="delta-header-figure"]').should("be.visible");
    cy.get('[aria-busy="true"], [title^="Loading"]').should("not.exist");
    cy.document().its("fonts.status").should("equal", "loaded");
    cy.waitForMap();

    cy.matchImageSnapshot("de_delta");
  });
});
