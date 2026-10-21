describe("NL forecast", () => {
  it("matches the snapshot", () => {
    cy.mockApi();
    cy.login();
    cy.visit("/");

    // toogle to NL
    cy.get('[data-cy="country-toggle-NL"]').click().should("have.attr", "aria-checked", "true");
    cy.waitForMap();
    cy.matchImageSnapshot("nl_forecast");
  });
});
