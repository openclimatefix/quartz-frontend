describe("UK delta", () => {
  it("matches the snapshot", () => {
    cy.mockApi();
    cy.login();
    cy.visit("/");

    // Switch the map (and the chart with it) to the delta view.
    cy.get('[data-cy="map-mode-delta"]').click().should("have.attr", "aria-pressed", "true");

    cy.get("body").type("{leftArrow}".repeat(48));

    // Loaded: the delta header is up, nothing is still loading.
    cy.get('[data-test="delta-header-figure"]').should("be.visible");
    cy.get('[aria-busy="true"], [title^="Loading"]').should("not.exist");
    cy.document().its("fonts.status").should("equal", "loaded");
    cy.waitForMap();

    cy.matchImageSnapshot("uk_delta");
  });
});
